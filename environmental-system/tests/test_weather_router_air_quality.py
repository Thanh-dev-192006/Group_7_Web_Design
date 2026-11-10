"""Router tests through the REAL WeatherService + air-quality path (MockTransport); no network."""
import httpx
import pytest

from app.main import app
from app.routers.deps import get_weather_service
from app.services.cache import TTLCache
from app.services.open_meteo import OpenMeteoClient
from app.services.weather import WeatherService
from tests.test_weather_service import NOW, ok_handler


@pytest.fixture(name="real_calls")
def real_calls_fixture(client):
    calls: list[str] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        return ok_handler()(request)

    service = WeatherService(
        client=OpenMeteoClient(httpx.Client(transport=httpx.MockTransport(wrapped))),
        cache=TTLCache(60),
        clock=lambda: NOW,
    )
    app.dependency_overrides[get_weather_service] = lambda: service     # cleared by the client fixture teardown
    return calls


def test_current_goes_through_air_quality_and_cached_flag_reflects_it(client, real_calls):
    first = client.get("/api/locations/1/current").json()
    assert first["data"]["us_aqi"] == 108
    assert first["meta"]["cached"] is False
    assert real_calls.count("air-quality-api.open-meteo.com") == 1

    second = client.get("/api/locations/1/current").json()
    assert second["meta"]["cached"] is True
    assert len(real_calls) == 2                                          # 1 weather + 1 air quality, nothing new


def test_forecast_router_merges_hourly_air_quality(client, real_calls):
    body = client.get("/api/locations/1/forecast", params={"hours": 3, "days": 1}).json()
    assert [p["us_aqi"] for p in body["data"]["hourly"]] == [108, 108, 108]
    assert body["data"]["hourly"][0]["aqi_category"] == "unhealthy_sensitive"
    assert body["meta"]["cached"] is False
