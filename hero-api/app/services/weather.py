"""Service thời tiết: ghép Open-Meteo (forecast + air quality) → schema của mình.

Router chỉ gọi `current()` / `forecast()`; cache đã được xử lý ở đây.
Phần cần làm (TODO) là 2 hàm `_build_current` và `_build_forecast`:
đọc JSON thô từ OpenMeteoClient và trả về `CurrentWeather` / `Forecast`.

Gợi ý khi làm:
- JSON Open-Meteo dạng cột: `hourly = {"time": [...], "temperature_2m": [...], ...}`
  → zip theo index để ra từng HourlyPoint. Hai API (forecast/air) có thể lệch
  số giờ → ghép theo `time`, không ghép theo index.
- Giá trị thiếu để None (không đổi thành 0).
- Gắn `aqi_category` bằng `category_from_us_aqi` (app/services/aqi.py).
- `hours`: chỉ lấy các giờ từ thời điểm hiện tại (UTC) trở đi, tối đa `hours` điểm.
"""
from app.config import settings
from app.errors import NotImplementedFeature
from app.models import Location
from app.schemas import CurrentWeather, Forecast
from app.services.cache import TTLCache
from app.services.open_meteo import OpenMeteoClient


class WeatherService:
    def __init__(self, client: OpenMeteoClient | None = None, cache: TTLCache | None = None):
        self.client = client or OpenMeteoClient()
        self.cache = cache or TTLCache(settings.cache_ttl_seconds)

    # ----- API dùng bởi router (đã xong, không cần sửa) -----
    def current(self, location: Location) -> tuple[CurrentWeather, bool]:
        """Trả (dữ liệu, cached)."""
        return self.cache.get_or_set(
            ("current", location.id),
            lambda: self._build_current(location),
        )

    def forecast(self, location: Location, *, hours: int, days: int) -> tuple[Forecast, bool]:
        return self.cache.get_or_set(
            ("forecast", location.id, hours, days),
            lambda: self._build_forecast(location, hours=hours, days=days),
        )

    # ----- TODO: phần chuyển đổi dữ liệu -----
    def _build_current(self, location: Location) -> CurrentWeather:
        # weather = self.client.fetch_forecast(location.lat, location.lon, forecast_days=1)
        # air = self.client.fetch_air_quality(location.lat, location.lon, forecast_days=1)
        # return CurrentWeather(location_id=location.id, observed_at=..., ...)
        raise NotImplementedFeature("Current weather is not implemented yet")

    def _build_forecast(self, location: Location, *, hours: int, days: int) -> Forecast:
        # weather = self.client.fetch_forecast(location.lat, location.lon, forecast_days=days)
        # air = self.client.fetch_air_quality(location.lat, location.lon, forecast_days=days)
        # return Forecast(location_id=location.id, hourly=[...], daily=[...])
        raise NotImplementedFeature("Forecast is not implemented yet")


_service: WeatherService | None = None


def get_weather_service() -> WeatherService:
    """Dependency FastAPI. Test override bằng app.dependency_overrides."""
    global _service
    if _service is None:
        _service = WeatherService()
    return _service
