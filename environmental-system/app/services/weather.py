"""Weather service: merges Open-Meteo forecast + air quality into our schemas, with caching.

Design notes:
- The cache holds one full 7-day / 168-hour payload per location; `hours` / `days`
  only trim at serve time, and hourly points are filtered by the current hour then.
- The two APIs can differ in hour count, so air quality is joined by `time`, not index.
- Missing values stay None (never 0).
- If air quality fails, weather is still returned with null AQI fields; a forecast failure is a 502/503.
- All times are UTC (timezone=GMT); `daily[].date` is the UTC date.
"""
import concurrent.futures
import logging
from collections.abc import Callable
from datetime import date, datetime, timezone

from app.config import settings
from app.errors import AppError, UpstreamError
from app.models import Location
from app.schemas import CurrentSummary, CurrentWeather, DailyPoint, Forecast, HourlyPoint, utc_now
from app.services.aqi import category_from_us_aqi
from app.services.cache import TTLCache
from app.services.open_meteo import OpenMeteoClient

logger = logging.getLogger(__name__)

MAX_DAYS = 7                 # Open-Meteo Air Quality forecasts at most ~7 days
MAX_HOURS = MAX_DAYS * 24    # 168


def _parse_time(value: str) -> datetime:
    """Parse '2026-10-28T14:00' (naive, GMT) into a UTC datetime."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


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
    ):
        self.client = client if client is not None else OpenMeteoClient()
        self.cache = cache if cache is not None else TTLCache(settings.cache_ttl_seconds)
        self._clock = clock          # injectable in tests

    def current(self, location: Location) -> tuple[CurrentWeather, bool]:
        """Return (data, cached)."""
        return self.cache.get_or_set(
            ("current", location.id),
            lambda: self._build_current(location),
        )

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
        full, cached = self.cache.get_or_set(
            ("forecast", location.id),
            lambda: self._build_forecast(location),
        )
        start = self._clock().astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        upcoming = [p for p in full.hourly if p.time >= start]
        trimmed = Forecast(
            location_id=full.location_id,
            hourly=upcoming[:min(hours, MAX_HOURS)],
            daily=full.daily[:days],
        )
        return trimmed, cached

    def _fetch_air_quality(self, location: Location) -> dict:
        try:
            return self.client.fetch_air_quality(location.lat, location.lon, forecast_days=MAX_DAYS)
        except AppError as exc:
            logger.warning("Air quality unavailable for %s: %s", location.slug, exc.message)
            return {}

    def _build_current(self, location: Location) -> CurrentWeather:
        weather = self.client.fetch_forecast(location.lat, location.lon, forecast_days=1)
        air = self._fetch_air_quality(location)
        try:
            cur = weather["current"]
            observed_at = _parse_time(cur["time"])
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError("Weather data source returned an invalid response") from exc

        air_cur = air.get("current") or {}
        us_aqi = air_cur.get("us_aqi")
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
            pm2_5=air_cur.get("pm2_5"),
            us_aqi=us_aqi,
            aqi_category=category_from_us_aqi(us_aqi),
        )

    def _build_forecast(self, location: Location) -> Forecast:
        """Full forecast (every payload hour, up to 7 days); trimmed at serve time."""
        # One extra day: the payload starts at 00:00 today, so 168 future hours remain.
        weather = self.client.fetch_forecast(location.lat, location.lon, forecast_days=MAX_DAYS + 1)
        air = self._fetch_air_quality(location)
        try:
            hourly = self._build_hourly(weather["hourly"], air.get("hourly") or {})
            daily = self._build_daily(weather["daily"])
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError("Weather data source returned an invalid response") from exc
        return Forecast(location_id=location.id, hourly=hourly, daily=daily)

    def _build_hourly(self, hourly: dict, air_hourly: dict) -> list[HourlyPoint]:
        air_by_time = {
            _parse_time(t): i for i, t in enumerate(air_hourly.get("time") or [])
        }
        points: list[HourlyPoint] = []
        for i, raw_time in enumerate(hourly["time"]):
            time = _parse_time(raw_time)
            j = air_by_time.get(time)
            us_aqi = _at(air_hourly, "us_aqi", j) if j is not None else None
            points.append(HourlyPoint(
                time=time,
                temperature_c=_at(hourly, "temperature_2m", i),
                precipitation_probability_pct=_at(hourly, "precipitation_probability", i),
                precipitation_mm=_at(hourly, "precipitation", i),
                weather_code=_at(hourly, "weather_code", i),
                pm2_5=_at(air_hourly, "pm2_5", j) if j is not None else None,
                us_aqi=us_aqi,
                aqi_category=category_from_us_aqi(us_aqi),
            ))
        return points

    @staticmethod
    def _build_daily(daily: dict) -> list[DailyPoint]:
        return [
            DailyPoint(
                date=date.fromisoformat(raw_date),
                temperature_max_c=_at(daily, "temperature_2m_max", i),
                temperature_min_c=_at(daily, "temperature_2m_min", i),
                precipitation_sum_mm=_at(daily, "precipitation_sum", i),
                precipitation_probability_max_pct=_at(daily, "precipitation_probability_max", i),
                weather_code=_at(daily, "weather_code", i),
            )
            for i, raw_date in enumerate(daily["time"])
        ][:MAX_DAYS]


_service: WeatherService | None = None


def get_weather_service() -> WeatherService:
    """FastAPI dependency; tests override it via app.dependency_overrides."""
    global _service
    if _service is None:
        _service = WeatherService()
    return _service
