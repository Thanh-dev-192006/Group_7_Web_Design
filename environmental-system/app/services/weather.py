"""Weather service: merges Open-Meteo forecast + air quality into our schemas, with caching.

Design notes:
- Only the weather part is cached (TTL `cache_ttl_seconds`). Air quality has its own cache keyed by location
  (TTL `air_quality_cache_ttl_seconds`) and is merged at serve time, so current and forecast share one AQ fetch.
  An AQ failure is never cached: it starts a service-wide cooldown (no AQ calls at all, limits are per IP) and
  the last-good AQ payload is served while younger than `air_quality_stale_max_seconds`.
- The cache holds one full 7-day / 168-hour payload per location; `hours` / `days`
  only trim at serve time, and hourly points are filtered by the current hour then.
  The full 168 h are cached, so `hours` is never truncated by `days`.
- The two APIs can differ in hour count, so air quality is joined by `time`, not index.
- Missing values stay None (never 0).
- If air quality fails, weather is still returned with null AQI fields; a forecast failure is a 502/503.
- API datetimes are UTC. The forecast is requested in `forecast_timezone`, so its naive local times are converted
  to UTC with `utc_offset_seconds`, and `daily[].date` is a local calendar day. Air quality is requested in GMT.
"""
import concurrent.futures
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

from app.config import settings
from app.errors import AppError, UpstreamError
from app.models import Location
from app.schemas import CurrentSummary, CurrentWeather, DailyPoint, Forecast, HourlyPoint, utc_now
from app.services.air_quality import NO_AIR_QUALITY, AirQuality, normalise
from app.services.aqi import category_from_us_aqi
from app.services.cache import TTLCache
from app.services.open_meteo import OpenMeteoClient

logger = logging.getLogger(__name__)

MAX_DAYS = 7                 # Open-Meteo Air Quality forecasts at most ~7 days
MAX_HOURS = MAX_DAYS * 24    # 168


def _parse_time(value: str, utc_offset_seconds: int = 0) -> datetime:
    """Parse '2026-10-28T14:00' into a UTC datetime; naive values are local time at the given UTC offset."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return (parsed - timedelta(seconds=utc_offset_seconds)).replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _utc_offset(payload: dict) -> int:
    """Forecast payload's `utc_offset_seconds` (0 when absent, e.g. GMT)."""
    return int(payload.get("utc_offset_seconds") or 0)


def _at(block: dict, key: str, index: int):
    """Element `index` of column `key` in a columnar block; None if missing."""
    values = block.get(key)
    if not values or index >= len(values):
        return None
    return values[index]


def _to_summary(current: CurrentWeather) -> CurrentSummary:
    return CurrentSummary(
        location_id=current.location_id,
        observed_at=current.observed_at,
        temperature_c=current.temperature_c,
        weather_code=current.weather_code,
        is_day=current.is_day,
        us_aqi=current.us_aqi,
        aqi_category=current.aqi_category,
    )


class SummaryList(list):
    cached: bool | None = None


class WeatherService:
    def __init__(
        self,
        client: OpenMeteoClient | None = None,
        cache: TTLCache | None = None,
        clock: Callable[[], datetime] = utc_now,
        air_quality_cache: TTLCache | None = None,
        monotonic: Callable[[], float] = time.monotonic,
        air_quality_stale_max_seconds: float | None = None,
        air_quality_failure_cooldown_seconds: float | None = None,
    ):
        self.client = client if client is not None else OpenMeteoClient()
        self.cache = cache if cache is not None else TTLCache(settings.cache_ttl_seconds)
        self.air_quality_cache = (
            air_quality_cache if air_quality_cache is not None
            else TTLCache(settings.air_quality_cache_ttl_seconds, clock=monotonic)
        )
        self._clock = clock          # injectable in tests
        self._monotonic = monotonic  # injectable in tests; used for cooldown and stale age
        self._stale_max = (
            settings.air_quality_stale_max_seconds
            if air_quality_stale_max_seconds is None else air_quality_stale_max_seconds
        )
        self._cooldown = (
            settings.air_quality_failure_cooldown_seconds
            if air_quality_failure_cooldown_seconds is None else air_quality_failure_cooldown_seconds
        )
        self._aq_lock = threading.Lock()
        self._aq_last_good: dict[int, tuple[float, AirQuality]] = {}   # location id -> (fetched_at, data)
        self._aq_locks: dict[int, threading.Lock] = {}               # per-location single-flight
        self._aq_rejected_until: dict[int, float] = {}           # location id -> backoff after a non-429 4xx
        self._aq_cooldown_until = 0.0                            # global: limits are per IP

    def current(self, location: Location) -> tuple[CurrentWeather, bool]:
        """Return (data, cached).

        `cached` is True iff no upstream HTTP call was made for this request: the weather part came
        from the cache and air quality was served from its cache, last-good data or a cooldown skip.
        """
        weather, weather_cached = self.cache.get_or_set(
            ("current", location.id),
            lambda: self._build_current(location),
        )
        air, aq_called = self._air_quality(location)
        return self._merge_current(weather, air), weather_cached and not aq_called

    def current_many(self, locations: list[Location]) -> list[CurrentSummary]:
        if not locations:
            return SummaryList([])

        sorted_locations = sorted(locations, key=lambda loc: loc.id)
        loc_results: dict[int, tuple[CurrentWeather, bool]] = {}
        loc_errors: dict[int, Exception] = {}

        with concurrent.futures.ThreadPoolExecutor(max_workers=settings.overview_max_workers) as executor:
            future_to_loc = {executor.submit(self.current, loc): loc for loc in sorted_locations}
            for future in concurrent.futures.as_completed(future_to_loc):
                loc = future_to_loc[future]
                try:
                    data, cached = future.result()
                    loc_results[loc.id] = (data, cached)
                except AppError as exc:
                    loc_errors[loc.id] = exc
                    logger.warning("Weather unavailable for %s (id=%s): %s", loc.slug, loc.id, exc.message)
                except Exception as exc:
                    loc_errors[loc.id] = UpstreamError("Weather data source returned an invalid response")
                    logger.warning("Weather error for %s (id=%s): %s", loc.slug, loc.id, exc)

        if len(loc_errors) == len(sorted_locations):
            # All failed: re-raise the first error by location.id
            raise loc_errors[sorted_locations[0].id]

        results: list[CurrentSummary] = []
        cached_flags: list[bool] = []
        for loc in sorted_locations:
            if loc.id in loc_results:
                data, cached = loc_results[loc.id]
                results.append(_to_summary(data))
                cached_flags.append(cached)

        out = SummaryList(results)
        out.cached = bool(cached_flags) and all(cached_flags)
        return out

    def forecast(self, location: Location, *, hours: int, days: int) -> tuple[Forecast, bool]:
        """Return (data, cached); `cached` has the same meaning as in `current`."""
        full, cached = self._forecast_full(location)
        start = self._clock().astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        upcoming = [p for p in full.hourly if p.time >= start]
        trimmed = Forecast(
            location_id=full.location_id,
            hourly=upcoming[:min(hours, MAX_HOURS)],
            daily=full.daily[:days],
        )
        return trimmed, cached

    def _forecast_full(self, location: Location) -> tuple[Forecast, bool]:
        """Full untrimmed forecast (weather from cache + air quality merged) and the `cached` flag."""
        weather, weather_cached = self.cache.get_or_set(
            ("forecast", location.id),
            lambda: self._build_forecast_weather(location),
        )
        air, aq_called = self._air_quality(location)
        return self._merge_forecast(weather, air), weather_cached and not aq_called

    # ---------- air quality: one fetch per location, global failure cooldown, stale fallback ----------
    def _air_quality(self, location: Location) -> tuple[AirQuality, bool]:
        """Return (air, http_called). Failures are never cached; `air` is empty when nothing usable.

        Single-flight per location: concurrent callers wait on the location lock and then reuse the cache.
        """
        hit, air = self.air_quality_cache.get(location.id)
        if hit:
            return air, False
        with self._location_lock(location.id):
            hit, air = self.air_quality_cache.get(location.id)
            if hit:
                return air, False
            with self._aq_lock:
                now = self._monotonic()
                cooling_down = now < self._aq_cooldown_until or now < self._aq_rejected_until.get(location.id, 0.0)
            if cooling_down:
                return self._stale_air_quality(location), False
            return self._fetch_air_quality(location), True

    def _location_lock(self, location_id: int) -> threading.Lock:
        with self._aq_lock:
            return self._aq_locks.setdefault(location_id, threading.Lock())

    def _fetch_air_quality(self, location: Location) -> AirQuality:
        """One upstream call (never under the global lock). Any failure, including an invalid or empty
        reply, is logged, not cached, and answered with last-good data."""
        try:
            raw = self.client.fetch_air_quality(
                location.lat, location.lon, forecast_days=settings.air_quality_forecast_days,
            )
            air = normalise(raw)
        except AppError as exc:
            self._air_quality_failed(location, exc)
            return self._stale_air_quality(location)
        except (AttributeError, KeyError, TypeError, ValueError) as exc:
            # On purpose: an unusable 200 reply (malformed or empty) starts the global cooldown like any failure,
            # so a misbehaving upstream is not hammered.
            self._air_quality_failed(location, UpstreamError(f"Air quality reply unusable: {exc}"))
            return self._stale_air_quality(location)
        with self._aq_lock:
            self._aq_last_good[location.id] = (self._monotonic(), air)
        self.air_quality_cache.set(location.id, air)
        return air

    def _air_quality_failed(self, location: Location, exc: AppError) -> None:
        """Log and start the global cooldown. A 4xx other than 429 (a bad request will not heal) only backs
        off that location, for the same duration."""
        status = getattr(exc, "upstream_status", None)
        if status is not None and 400 <= status < 500 and status != 429:
            logger.error("Air quality request rejected for %s (HTTP %s): %s", location.slug, status, exc.message)
            with self._aq_lock:
                self._aq_rejected_until[location.id] = self._monotonic() + self._cooldown
            return
        logger.warning("Air quality unavailable for %s: %s", location.slug, exc.message)
        with self._aq_lock:
            self._aq_cooldown_until = self._monotonic() + self._cooldown

    def _stale_air_quality(self, location: Location) -> AirQuality:
        """Last-good data if younger than the stale max, else empty. The `current` block is dropped: it is
        too old to be shown as current (only the hourly series is used for stale data)."""
        with self._aq_lock:
            item = self._aq_last_good.get(location.id)
            if item is None:
                return NO_AIR_QUALITY
            fetched_at, air = item
            if self._monotonic() - fetched_at < self._stale_max:
                return replace(air, current=None)
            del self._aq_last_good[location.id]
            return NO_AIR_QUALITY

    # ---------- weather only (cached) ----------
    def _build_current(self, location: Location) -> CurrentWeather:
        """Weather-only current conditions (AQI fields null); air quality is merged at serve time."""
        weather = self.client.fetch_current(location.lat, location.lon)
        try:
            cur = weather["current"]
            observed_at = _parse_time(cur["time"], _utc_offset(weather))
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError("Weather data source returned an invalid response") from exc

        is_day = cur.get("is_day")
        return CurrentWeather(
            location_id=location.id,
            observed_at=observed_at,
            temperature_c=cur.get("temperature_2m"),
            apparent_temperature_c=cur.get("apparent_temperature"),
            humidity_pct=cur.get("relative_humidity_2m"),
            wind_speed_kmh=cur.get("wind_speed_10m"),
            wind_direction_deg=cur.get("wind_direction_10m"),
            precipitation_mm=cur.get("precipitation"),
            weather_code=cur.get("weather_code"),
            is_day=None if is_day is None else bool(is_day),
            pm2_5=None,
            us_aqi=None,
            aqi_category=None,
        )

    def _build_forecast_weather(self, location: Location) -> Forecast:
        """Weather-only full forecast (every payload hour, up to 7 days; AQI null)."""
        # One extra day: the payload starts at 00:00 today, so 168 future hours remain.
        weather = self.client.fetch_forecast(location.lat, location.lon, forecast_days=MAX_DAYS + 1)
        try:
            hourly = self._build_hourly(weather["hourly"], _utc_offset(weather))
            daily = self._build_daily(weather["daily"], _utc_offset(weather))
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError("Weather data source returned an invalid response") from exc
        return Forecast(location_id=location.id, hourly=hourly, daily=daily)

    # ---------- serve-time merge (builds new objects; cached ones are never mutated) ----------
    def _merge_current(self, weather: CurrentWeather, air: AirQuality) -> CurrentWeather:
        """Current AQI is the hourly reading at the current UTC hour (the `current` block can be hours old);
        the `current` block is a fallback when that hour is missing or its us_aqi is None, and is absent for
        stale data."""
        hour = self._clock().astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        hourly = air.at(hour)
        if hourly is not None and hourly[1] is not None:
            pm2_5, us_aqi = hourly
        else:
            pm2_5, us_aqi = air.current or hourly or (None, None)
        return weather.model_copy(update={
            "pm2_5": pm2_5,
            "us_aqi": us_aqi,
            "aqi_category": category_from_us_aqi(us_aqi),
        })

    @staticmethod
    def _merge_forecast(weather: Forecast, air: AirQuality) -> Forecast:
        """New Forecast with new points (cached ones are never returned by reference or mutated);
        AQ is joined by UTC time."""
        hourly: list[HourlyPoint] = []
        for point in weather.hourly:
            reading = air.hourly.get(point.time)
            if reading is None:
                hourly.append(point.model_copy())
                continue
            pm2_5, us_aqi = reading
            hourly.append(point.model_copy(update={
                "pm2_5": pm2_5,
                "us_aqi": us_aqi,
                "aqi_category": category_from_us_aqi(us_aqi),
            }))
        return Forecast(location_id=weather.location_id, hourly=hourly, daily=list(weather.daily))

    def _build_hourly(self, hourly: dict, utc_offset_seconds: int = 0) -> list[HourlyPoint]:
        """Weather-only hourly points; AQI fields stay None until merged at serve time."""
        points: list[HourlyPoint] = []
        for i, raw_time in enumerate(hourly["time"]):
            points.append(HourlyPoint(
                time=_parse_time(raw_time, utc_offset_seconds),
                temperature_c=_at(hourly, "temperature_2m", i),
                precipitation_probability_pct=_at(hourly, "precipitation_probability", i),
                precipitation_mm=_at(hourly, "precipitation", i),
                weather_code=_at(hourly, "weather_code", i),
                apparent_temperature_c=_at(hourly, "apparent_temperature", i),
                relative_humidity_pct=_at(hourly, "relative_humidity_2m", i),
                wind_speed_kmh=_at(hourly, "wind_speed_10m", i),
                uv_index=_at(hourly, "uv_index", i),
                pm2_5=None,
                us_aqi=None,
                aqi_category=None,
            ))
        return points

    @staticmethod
    def _build_daily(daily: dict, utc_offset_seconds: int = 0) -> list[DailyPoint]:
        def local_time(key: str, index: int) -> datetime | None:
            raw = _at(daily, key, index)
            return _parse_time(raw, utc_offset_seconds) if raw else None

        return [
            DailyPoint(
                date=date.fromisoformat(raw_date),
                temperature_max_c=_at(daily, "temperature_2m_max", i),
                temperature_min_c=_at(daily, "temperature_2m_min", i),
                precipitation_sum_mm=_at(daily, "precipitation_sum", i),
                precipitation_probability_max_pct=_at(daily, "precipitation_probability_max", i),
                weather_code=_at(daily, "weather_code", i),
                sunrise=local_time("sunrise", i),
                sunset=local_time("sunset", i),
                uv_index_max=_at(daily, "uv_index_max", i),
            )
            for i, raw_date in enumerate(daily["time"])
        ][:MAX_DAYS]


_service: WeatherService | None = None
_service_lock = threading.Lock()


def get_weather_service() -> WeatherService:
    """FastAPI dependency; tests override it via app.dependency_overrides."""
    global _service
    if _service is None:
        with _service_lock:                 # endpoints run in a threadpool: build the singleton only once
            if _service is None:
                _service = WeatherService()
    return _service
