"""Client gọi Open-Meteo. Chỉ lo phần HTTP và trả JSON thô.

- Không cần API key. Tài liệu: https://open-meteo.com/en/docs
  và https://open-meteo.com/en/docs/air-quality-api
- Luôn gọi với `timezone=GMT` → mọi thời gian trả về là UTC (không kèm tz),
  `UTCDatetime` trong schemas sẽ gắn tz khi serialize.
- Lỗi mạng/timeout → UpstreamUnavailable (503); HTTP lỗi/JSON hỏng → UpstreamError (502).

Việc chuyển JSON thô → schema của mình nằm ở app/services/weather.py.
"""
import logging

import httpx

from app.config import settings
from app.errors import UpstreamError, UpstreamUnavailable

logger = logging.getLogger(__name__)

# Biến xin từ Forecast API. Đổi ở đây nếu cần thêm/bớt trường.
FORECAST_CURRENT_VARS = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
    "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m",
]
FORECAST_HOURLY_VARS = ["temperature_2m", "precipitation_probability", "precipitation", "weather_code"]
FORECAST_DAILY_VARS = [
    "weather_code", "temperature_2m_max", "temperature_2m_min",
    "precipitation_sum", "precipitation_probability_max",
]
# Biến xin từ Air Quality API (dự báo chất lượng không khí tối đa ~7 ngày)
AIR_CURRENT_VARS = ["pm2_5", "us_aqi"]
AIR_HOURLY_VARS = ["pm2_5", "us_aqi"]


class OpenMeteoClient:
    def __init__(self, http: httpx.Client | None = None):
        self._http = http or httpx.Client(timeout=settings.http_timeout_seconds)

    def _get(self, url: str, params: dict) -> dict:
        try:
            response = self._http.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            logger.warning("Open-Meteo unreachable: %s", exc)
            raise UpstreamUnavailable("Weather data source is unavailable") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("Open-Meteo HTTP %s: %s", exc.response.status_code, exc.response.text[:200])
            raise UpstreamError("Weather data source returned an error") from exc
        except (httpx.HTTPError, ValueError) as exc:   # ValueError: JSON hỏng
            logger.warning("Open-Meteo bad response: %s", exc)
            raise UpstreamError("Weather data source returned an invalid response") from exc

    def fetch_forecast(self, lat: float, lon: float, *, forecast_days: int = 7) -> dict:
        return self._get(settings.open_meteo_forecast_url, {
            "latitude": lat,
            "longitude": lon,
            "current": ",".join(FORECAST_CURRENT_VARS),
            "hourly": ",".join(FORECAST_HOURLY_VARS),
            "daily": ",".join(FORECAST_DAILY_VARS),
            "forecast_days": forecast_days,
            "timezone": "GMT",
            "wind_speed_unit": "kmh",
        })

    def fetch_air_quality(self, lat: float, lon: float, *, forecast_days: int = 7) -> dict:
        return self._get(settings.open_meteo_air_quality_url, {
            "latitude": lat,
            "longitude": lon,
            "current": ",".join(AIR_CURRENT_VARS),
            "hourly": ",".join(AIR_HOURLY_VARS),
            "forecast_days": min(forecast_days, 7),
            "timezone": "GMT",
        })

    def close(self) -> None:
        self._http.close()
