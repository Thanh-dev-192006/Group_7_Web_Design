"""Open-Meteo HTTP client; returns raw JSON (mapping to schemas is in app/services/weather.py).

- No API key. Docs: https://open-meteo.com/en/docs and /en/docs/air-quality-api
- Air quality uses `timezone=GMT` (naive UTC times). The forecast uses `settings.forecast_timezone` so daily
  values are local calendar days; its times are local and come with `utc_offset_seconds` (converted in weather.py).
- Network error/timeout -> UpstreamUnavailable (503); HTTP error/bad JSON -> UpstreamError (502).
"""
import logging

import httpx

from app.config import settings
from app.errors import UpstreamError, UpstreamUnavailable

logger = logging.getLogger(__name__)

# Variables requested from the Forecast API.
FORECAST_CURRENT_VARS = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
    "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m",
]
FORECAST_HOURLY_VARS = [
    "temperature_2m", "precipitation_probability", "precipitation", "weather_code",
    "apparent_temperature", "relative_humidity_2m", "wind_speed_10m", "uv_index",
]
FORECAST_DAILY_VARS = [
    "weather_code", "temperature_2m_max", "temperature_2m_min",
    "precipitation_sum", "precipitation_probability_max", "sunrise", "sunset", "uv_index_max",
]
# Variables requested from the Air Quality API (forecast limited to ~7 days)
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
        except (httpx.HTTPError, ValueError) as exc:   # ValueError: invalid JSON
            logger.warning("Open-Meteo bad response: %s", exc)
            raise UpstreamError("Weather data source returned an invalid response") from exc

    def fetch_current(self, lat: float, lon: float) -> dict:
        """Current conditions only (no hourly/daily blocks, so fewer variables count against the quota)."""
        return self._get(settings.open_meteo_forecast_url, {
            "latitude": lat,
            "longitude": lon,
            "current": ",".join(FORECAST_CURRENT_VARS),
            "timezone": settings.forecast_timezone,
            "wind_speed_unit": "kmh",
        })

    def fetch_forecast(self, lat: float, lon: float, *, forecast_days: int = 7) -> dict:
        """Hourly + daily blocks only; current conditions come from fetch_current."""
        return self._get(settings.open_meteo_forecast_url, {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(FORECAST_HOURLY_VARS),
            "daily": ",".join(FORECAST_DAILY_VARS),
            "forecast_days": forecast_days,
            "timezone": settings.forecast_timezone,
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
