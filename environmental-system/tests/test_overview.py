"""/api/current router tests with FakeWeatherService (conftest.py)."""
from app.errors import UpstreamError, UpstreamUnavailable


def test_current_all_returns_one_item_per_location(client):
    response = client.get("/api/current")
    assert response.status_code == 200
    body = response.json()
    data = body["data"]
    meta = body["meta"]

    # One item per seeded location (15)
    assert len(data) == 15
    assert meta["count"] == 15
    # Ordered by id
    ids = [item["location_id"] for item in data]
    assert ids == sorted(ids)
    assert ids == list(range(1, 16))
    for item in data:
        assert item["observed_at"].endswith("Z")


def test_current_all_skips_failing_location(client, weather_service):
    # Fail location 3 only
    weather_service.fail_for = {3: UpstreamError("Upstream failure for location 3")}

    response = client.get("/api/current")
    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    # Exactly one item is missing
    assert len(data) == 14
    assert body["meta"]["count"] == 14
    ids = [item["location_id"] for item in data]
    assert 3 not in ids
    assert ids == [i for i in range(1, 16) if i != 3]


def test_current_all_all_fail_returns_error_format(client, weather_service):
    # Every location fails
    weather_service.fail_for = {None: UpstreamUnavailable("Open-Meteo connection timeout")}

    response = client.get("/api/current")
    assert response.status_code == 503
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert "Open-Meteo connection timeout" in body["error"]["message"]


def test_current_all_uses_cache(client, weather_service):
    first = client.get("/api/current")
    assert first.status_code == 200
    assert first.json()["meta"]["cached"] is False

    second = client.get("/api/current")
    assert second.status_code == 200
    assert second.json()["meta"]["cached"] is True
