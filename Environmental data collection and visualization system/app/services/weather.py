"""Service thời tiết: ghép Open-Meteo (forecast + air quality) → schema của mình.

Router chỉ gọi `current()` / `forecast()`; cache được xử lý ở đây.

Quyết định thiết kế:
- Dự báo luôn lấy đủ 7 ngày / 168 giờ cho mỗi địa điểm và cache MỘT bản duy nhất;
  `hours` / `days` chỉ cắt bớt khi trả ra → mọi tổ hợp tham số dùng chung 1 cache
  và không bao giờ thiếu dữ liệu khi `hours` lớn hơn `days * 24`.
- Hai API (forecast / air quality) có thể lệch số giờ → ghép theo `time`, không theo index.
- Thiếu giá trị → None (không đổi thành 0).
- Air Quality API lỗi thì vẫn trả thời tiết, các trường AQI là null (AQI là phần phụ).
  Forecast API lỗi thì báo lỗi 502/503 như bình thường.
- Mọi thời gian là UTC (Open-Meteo gọi với timezone=GMT); `daily[].date` là ngày theo UTC.
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

MAX_DAYS = 7                 # Open-Meteo Air Quality chỉ dự báo tối đa ~7 ngày
MAX_HOURS = MAX_DAYS * 24    # 168


def _parse_time(value: str) -> datetime:
    """'2026-10-28T14:00' (không tz, là GMT) → datetime UTC."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _at(block: dict, key: str, index: int):
    """Phần tử `index` của cột `key` trong block dạng cột; thiếu → None."""
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
        self.client = client or OpenMeteoClient()
        self.cache = cache or TTLCache(settings.cache_ttl_seconds)
        self._clock = clock          # inject được trong test

    # ----- API dùng bởi router -----
    def current(self, location: Location) -> tuple[CurrentWeather, bool]:
        """Trả (dữ liệu, cached)."""
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
            # Tất cả đều lỗi -> raise lại lỗi đầu tiên theo thứ tự location.id
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
        trimmed = Forecast(location_id=full.location_id, hourly=full.hourly[:hours], daily=full.daily[:days])
        return trimmed, cached

    # ----- chuyển đổi dữ liệu -----
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
        """Bản dự báo đầy đủ (tối đa 168 giờ, 7 ngày), bắt đầu từ giờ hiện tại (UTC)."""
        weather = self.client.fetch_forecast(location.lat, location.lon, forecast_days=MAX_DAYS)
        air = self._fetch_air_quality(location)
        try:
            hourly = self._build_hourly(weather["hourly"], air.get("hourly") or {})
            daily = self._build_daily(weather["daily"])
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError("Weather data source returned an invalid response") from exc
        return Forecast(location_id=location.id, hourly=hourly, daily=daily)

    def _build_hourly(self, hourly: dict, air_hourly: dict) -> list[HourlyPoint]:
        start = self._clock().astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        # Ghép air quality theo thời gian, không theo index.
        air_by_time = {
            _parse_time(t): i for i, t in enumerate(air_hourly.get("time") or [])
        }
        points: list[HourlyPoint] = []
        for i, raw_time in enumerate(hourly["time"]):
            time = _parse_time(raw_time)
            if time < start:
                continue
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
            if len(points) >= MAX_HOURS:
                break
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
    """Dependency FastAPI. Test override bằng app.dependency_overrides."""
    global _service
    if _service is None:
        _service = WeatherService()
    return _service
