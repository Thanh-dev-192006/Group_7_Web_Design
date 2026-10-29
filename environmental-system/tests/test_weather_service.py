"""Test WeatherService thật với payload Open-Meteo giả (httpx.MockTransport) — không gọi mạng."""
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.errors import UpstreamError, UpstreamUnavailable
from app.models import Location
from app.services.cache import TTLCache
from app.services.open_meteo import OpenMeteoClient
from app.services.weather import WeatherService

# "Bây giờ" cố định: 2026-10-28 14:30 UTC → dự báo phải bắt đầu từ 14:00.
NOW = datetime(2026, 10, 28, 14, 30, tzinfo=timezone.utc)
FIRST_HOUR = datetime(2026, 10, 28, 0, 0)          # payload bắt đầu từ 00:00 cùng ngày
LOCATION = Location(id=1, name="Hà Nội", slug="ha-noi", region="north", lat=21.0, lon=105.8)


def hours(n: int):
    return [(FIRST_HOUR + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(n)]


def forecast_payload(n_hours: int = 168, n_days: int = 7) -> dict:
    return {
        "current": {
            "time": "2026-10-28T14:30", "temperature_2m": 30.5, "relative_humidity_2m": 70,
            "apparent_temperature": 34.0, "is_day": 1, "precipitation": 0.0, "weather_code": 2,
            "wind_speed_10m": 9.4, "wind_direction_10m": 120,
        },
        "hourly": {
            "time": hours(n_hours),
            "temperature_2m": [20 + i * 0.1 for i in range(n_hours)],
            "precipitation_probability": [10] * n_hours,
            "precipitation": [0.0] * n_hours,
            "weather_code": [1] * n_hours,
        },
        "daily": {
            "time": [(FIRST_HOUR + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n_days)],
            "weather_code": [61] * n_days,
            "temperature_2m_max": [32.0] * n_days,
            "temperature_2m_min": [24.0] * n_days,
            "precipitation_sum": [1.5] * n_days,
            "precipitation_probability_max": [60] * n_days,
        },
    }


def air_payload(n_hours: int = 168) -> dict:
    return {
        "current": {"time": "2026-10-28T14:30", "pm2_5": 40.0, "us_aqi": 108},
        "hourly": {"time": hours(n_hours), "pm2_5": [40.0] * n_hours, "us_aqi": [108] * n_hours},
    }


def make_service(handler, calls=None) -> WeatherService:
    def wrapped(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request.url.host)
        return handler(request)

    http = httpx.Client(transport=httpx.MockTransport(wrapped))
    return WeatherService(client=OpenMeteoClient(http), cache=TTLCache(60), clock=lambda: NOW)


def ok_handler(forecast=None, air=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host.startswith("air-quality"):
            return httpx.Response(200, json=air if air is not None else air_payload())
        return httpx.Response(200, json=forecast if forecast is not None else forecast_payload())
    return handler


def test_current_maps_weather_and_air_quality():
    data, cached = make_service(ok_handler()).current(LOCATION)
    assert cached is False
    assert data.temperature_c == 30.5
    assert data.humidity_pct == 70
    assert data.is_day is True
    assert data.observed_at == datetime(2026, 10, 28, 14, 30, tzinfo=timezone.utc)
    assert data.us_aqi == 108 and data.aqi_category == "unhealthy_sensitive"


def test_current_missing_value_stays_none_not_zero():
    payload = forecast_payload()
    payload["current"]["wind_speed_10m"] = None
    del payload["current"]["precipitation"]
    data, _ = make_service(ok_handler(forecast=payload)).current(LOCATION)
    assert data.wind_speed_kmh is None
    assert data.precipitation_mm is None


def test_current_survives_air_quality_failure():
    def handler(request):
        if request.url.host.startswith("air-quality"):
            return httpx.Response(500, text="boom")
        return httpx.Response(200, json=forecast_payload())

    data, _ = make_service(handler).current(LOCATION)
    assert data.temperature_c == 30.5
    assert data.us_aqi is None and data.aqi_category is None


def test_forecast_starts_at_current_hour_and_has_168_points():
    data, _ = make_service(ok_handler()).forecast(LOCATION, hours=168, days=7)
    # payload 168 giờ từ 00:00; bỏ 14 giờ đầu (00:00–13:00) → còn 154
    assert data.hourly[0].time == datetime(2026, 10, 28, 14, 0, tzinfo=timezone.utc)
    assert len(data.hourly) == 154
    assert len(data.daily) == 7


def test_forecast_hours_168_with_days_3_is_not_truncated_by_days():
    data, _ = make_service(ok_handler()).forecast(LOCATION, hours=168, days=3)
    assert len(data.hourly) == 154       # không bị giới hạn bởi days
    assert len(data.daily) == 3


def test_forecast_trims_hours_and_days():
    data, _ = make_service(ok_handler()).forecast(LOCATION, hours=12, days=2)
    assert len(data.hourly) == 12
    assert len(data.daily) == 2


def test_forecast_air_quality_shorter_than_weather_gives_null_by_time_not_index():
    # Air quality chỉ có 24 giờ đầu (00:00–23:00): giờ 14:00–23:00 có AQI, từ 00:00 hôm sau là null.
    data, _ = make_service(ok_handler(air=air_payload(24))).forecast(LOCATION, hours=48, days=7)
    by_hour = {p.time.hour + 24 * (p.time.day - 28): p for p in data.hourly}
    assert by_hour[14].us_aqi == 108 and by_hour[14].aqi_category == "unhealthy_sensitive"
    assert by_hour[23].us_aqi == 108
    assert by_hour[24].us_aqi is None and by_hour[24].aqi_category is None
    assert by_hour[24].temperature_c is not None


def test_forecast_air_quality_offset_start_is_matched_by_time():
    air = air_payload(24)
    # Air quality bắt đầu muộn 14 giờ (14:00) → index 0 của air tương ứng 14:00, không phải 00:00.
    air["hourly"]["time"] = hours(168)[14:38]
    air["hourly"]["us_aqi"] = list(range(1000, 1024))
    data, _ = make_service(ok_handler(air=air)).forecast(LOCATION, hours=3, days=1)
    assert [p.us_aqi for p in data.hourly] == [1000, 1001, 1002]


def test_forecast_uses_one_http_call_per_api_and_caches_across_params():
    calls: list[str] = []
    service = make_service(ok_handler(), calls)
    service.forecast(LOCATION, hours=48, days=7)
    _, cached = service.forecast(LOCATION, hours=24, days=1)
    assert cached is True
    assert len(calls) == 2               # 1 forecast + 1 air quality


def test_timeout_becomes_upstream_unavailable():
    def handler(request):
        raise httpx.ConnectTimeout("timeout")

    with pytest.raises(UpstreamUnavailable):
        make_service(handler).current(LOCATION)


def test_http_error_becomes_upstream_error():
    with pytest.raises(UpstreamError):
        make_service(lambda request: httpx.Response(500, text="boom")).forecast(LOCATION, hours=1, days=1)


def test_malformed_payload_becomes_upstream_error():
    with pytest.raises(UpstreamError):
        make_service(ok_handler(forecast={"unexpected": True})).current(LOCATION)
    with pytest.raises(UpstreamError):
        make_service(ok_handler(forecast={"unexpected": True})).forecast(LOCATION, hours=1, days=1)
