"""Test router /api/current với FakeWeatherService (conftest.py)."""
from app.errors import UpstreamError, UpstreamUnavailable


def test_current_all_returns_one_item_per_location(client):
    response = client.get("/api/current")
    assert response.status_code == 200
    body = response.json()
    data = body["data"]
    meta = body["meta"]

    # Đếm = số địa điểm seed (15)
    assert len(data) == 15
    # meta.count khớp
    assert meta["count"] == 15
    # Thứ tự theo id
    ids = [item["location_id"] for item in data]
    assert ids == sorted(ids)
    assert ids == list(range(1, 16))
    # observed_at kết thúc bằng Z
    for item in data:
        assert item["observed_at"].endswith("Z")


def test_current_all_skips_failing_location(client, weather_service):
    # Cho weather_service raise UpstreamError với location.id = 3
    weather_service.fail_for = {3: UpstreamError("Upstream failure for location 3")}

    response = client.get("/api/current")
    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    # Danh sách thiếu đúng 1 phần tử (còn 14)
    assert len(data) == 14
    assert body["meta"]["count"] == 14
    ids = [item["location_id"] for item in data]
    assert 3 not in ids
    assert ids == [i for i in range(1, 16) if i != 3]


def test_current_all_all_fail_returns_error_format(client, weather_service):
    # Tất cả raise UpstreamUnavailable
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
