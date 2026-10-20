from app.seed import LOCATIONS


def test_list_locations_uses_envelope(client):
    response = client.get("/api/locations")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"data", "meta"}
    assert body["meta"]["count"] == len(LOCATIONS) == len(body["data"])
    assert body["meta"]["generated_at"].endswith("Z")
    assert {"id", "name", "slug", "region", "lat", "lon"} <= set(body["data"][0])


def test_filter_locations_by_region(client):
    body = client.get("/api/locations", params={"region": "south"}).json()
    assert body["data"] and all(loc["region"] == "south" for loc in body["data"])


def test_invalid_region_is_400(client):
    response = client.get("/api/locations", params={"region": "west"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_read_location(client):
    first = client.get("/api/locations").json()["data"][0]
    response = client.get(f"/api/locations/{first['id']}")
    assert response.status_code == 200
    assert response.json()["data"] == first


def test_unknown_location_is_404_with_error_format(client):
    response = client.get("/api/locations/9999")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "LOCATION_NOT_FOUND", "message": "Location 9999 does not exist"}
    }


def test_non_integer_id_is_400(client):
    response = client.get("/api/locations/abc")
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"][0]["field"] == "path.location_id"
