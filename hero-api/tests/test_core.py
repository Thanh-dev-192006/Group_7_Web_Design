"""Test các thành phần dùng chung: AQI, cache, lỗi, health, OpenAPI, frontend."""
import pytest

from app.schemas import AqiCategory
from app.services.aqi import category_from_us_aqi
from app.services.cache import TTLCache


@pytest.mark.parametrize("value, expected", [
    (None, None), (-1, None),
    (0, AqiCategory.good), (50, AqiCategory.good),
    (51, AqiCategory.moderate), (100, AqiCategory.moderate),
    (101, AqiCategory.unhealthy_sensitive), (150, AqiCategory.unhealthy_sensitive),
    (151, AqiCategory.unhealthy), (200, AqiCategory.unhealthy),
    (201, AqiCategory.very_unhealthy), (300, AqiCategory.very_unhealthy),
    (301, AqiCategory.hazardous), (500, AqiCategory.hazardous),
])
def test_aqi_category_boundaries(value, expected):
    assert category_from_us_aqi(value) == expected


def test_cache_expires_after_ttl():
    now = [0.0]
    cache = TTLCache(ttl_seconds=10, clock=lambda: now[0])
    assert cache.get_or_set("k", lambda: "v1") == ("v1", False)
    assert cache.get_or_set("k", lambda: "v2") == ("v1", True)
    now[0] = 10
    assert cache.get_or_set("k", lambda: "v3") == ("v3", False)


def test_cache_does_not_store_failures():
    cache = TTLCache(ttl_seconds=10)

    def boom():
        raise RuntimeError

    with pytest.raises(RuntimeError):
        cache.get_or_set("k", boom)
    assert len(cache) == 0


def test_unknown_api_route_uses_error_format(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_health(client):
    body = client.get("/api/health").json()
    assert body["data"]["status"] == "ok"
    assert body["data"]["database"] == "ok"


def test_openapi_documents_400_not_422(client):
    schema = client.get("/openapi.json").json()
    forecast = schema["paths"]["/api/locations/{location_id}/forecast"]["get"]["responses"]
    assert "400" in forecast and "422" not in forecast
    assert client.get("/docs").status_code == 200


def test_frontend_is_served_same_origin(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
