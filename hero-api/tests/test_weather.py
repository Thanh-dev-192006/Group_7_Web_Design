"""Test router thời tiết với FakeWeatherService (conftest.py).

Test service thật (ghép dữ liệu Open-Meteo) nằm ở test_weather_service.py.
"""
from app.errors import UpstreamError, UpstreamUnavailable


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


def test_forecast_hours_zero_is_400(client):
    response = client.get("/api/locations/1/forecast", params={"hours": 0})
    assert response.status_code == 400
    assert response.json()["error"]["details"][0]["field"] == "query.hours"


def test_weather_unknown_location_is_404(client):
    assert client.get("/api/locations/9999/current").json()["error"]["code"] == "LOCATION_NOT_FOUND"


def test_forecast_days_above_7_is_400(client):
    response = client.get("/api/locations/1/forecast", params={"days": 8})
    assert response.status_code == 400
    assert response.json()["error"]["details"][0]["field"] == "query.days"


def test_forecast_different_params_share_one_cache_entry(client, weather_service):
    client.get("/api/locations/1/forecast", params={"hours": 24, "days": 1})
    second = client.get("/api/locations/1/forecast", params={"hours": 168, "days": 7})
    assert second.json()["meta"]["cached"] is True
    assert weather_service.calls == 1


def test_current_upstream_error_is_502(client, weather_service):
    weather_service.fail_for = {1: UpstreamError("Open-Meteo returned 500")}
    response = client.get("/api/locations/1/current")
    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "UPSTREAM_ERROR"
    assert "Open-Meteo returned 500" in body["error"]["message"]


def test_current_upstream_unavailable_is_503(client, weather_service):
    weather_service.fail_for = {1: UpstreamUnavailable("Connection timed out")}
    response = client.get("/api/locations/1/current")
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert "Connection timed out" in body["error"]["message"]


def test_forecast_upstream_error_is_502(client, weather_service):
    weather_service.fail_for = {1: UpstreamError("Open-Meteo returned invalid json")}
    response = client.get("/api/locations/1/forecast")
    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "UPSTREAM_ERROR"
    assert "Open-Meteo returned invalid json" in body["error"]["message"]


def test_forecast_upstream_unavailable_is_503(client, weather_service):
    weather_service.fail_for = {1: UpstreamUnavailable("DNS resolution failed")}
    response = client.get("/api/locations/1/forecast")
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert "DNS resolution failed" in body["error"]["message"]
