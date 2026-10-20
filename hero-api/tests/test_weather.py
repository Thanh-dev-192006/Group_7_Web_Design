"""Test router thời tiết với FakeWeatherService (conftest.py).

Khi làm xong `_build_current/_build_forecast` thật, thêm test riêng cho
service bằng JSON Open-Meteo mẫu (lưu ở tests/fixtures/) — không gọi mạng.
"""
from app.errors import NotImplementedFeature
from app.services.weather import WeatherService


def test_current_returns_envelope_and_uses_cache(client, weather_service):
    first = client.get("/api/locations/1/current")
    assert first.status_code == 200
    body = first.json()
    assert body["data"]["location_id"] == 1
    assert body["data"]["aqi_category"] == "moderate"
    assert body["data"]["observed_at"].endswith("Z")
    assert body["data"]["wind_speed_kmh"] is None      # thiếu → null, không phải 0
    assert body["meta"]["cached"] is False

    second = client.get("/api/locations/1/current")
    assert second.json()["meta"]["cached"] is True
    assert weather_service.calls == 1


def test_forecast_respects_hours_and_days(client):
    body = client.get("/api/locations/1/forecast", params={"hours": 12, "days": 3}).json()
    assert len(body["data"]["hourly"]) == 12
    assert len(body["data"]["daily"]) == 3


def test_forecast_hours_out_of_range_is_400(client):
    response = client.get("/api/locations/1/forecast", params={"hours": 500})
    assert response.status_code == 400
    assert response.json()["error"]["details"][0]["field"] == "query.hours"


def test_weather_unknown_location_is_404(client):
    assert client.get("/api/locations/9999/current").json()["error"]["code"] == "LOCATION_NOT_FOUND"


def test_unimplemented_service_returns_501(client):
    """Khi service chưa làm xong, frontend nhận 501 rõ ràng thay vì 500.
    XÓA test này khi đã triển khai _build_current/_build_forecast."""
    from app.main import app
    from app.services.weather import get_weather_service

    class Stub(WeatherService):
        def __init__(self):
            super().__init__(client=object())

    app.dependency_overrides[get_weather_service] = Stub
    response = client.get("/api/locations/1/current")
    assert response.status_code == 501
    assert response.json()["error"]["code"] == NotImplementedFeature.code
