def test_create_and_read_hero(client):
    team = client.post("/teams", json={"name": "Avengers", "headquarters": "New York"})
    assert team.status_code == 201
    response = client.post(
        "/heroes",
        json={"name": "Tony", "age": 45, "power": "powered armor", "secret_name": "Iron Man", "team_id": team.json()["id"]},
    )
    assert response.status_code == 201
    hero = response.json()
    assert hero["name"] == "Tony"
    assert hero["status"] == "active"
    assert "secret_name" not in hero
    assert "created_at" in hero
    assert client.get(f"/heroes/{hero['id']}").json()["id"] == hero["id"]


def test_filter_update_and_delete_hero(client):
    client.post("/heroes", json={"name": "Tony", "age": 45, "secret_name": "Iron Man"})
    client.post("/heroes", json={"name": "Peter", "age": 16, "secret_name": "Spider-Man"})
    filtered = client.get("/heroes", params={"min_age": 18, "name": "ton"})
    assert [hero["name"] for hero in filtered.json()] == ["Tony"]
    hero_id = filtered.json()[0]["id"]
    updated = client.patch(f"/heroes/{hero_id}", json={"status": "retired", "power": "technology"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "retired"
    assert client.delete(f"/heroes/{hero_id}").status_code == 204
    assert client.get(f"/heroes/{hero_id}").status_code == 404


def test_team_duplicate_and_unknown_team_are_client_errors(client):
    payload = {"name": "X-Men", "headquarters": "Westchester"}
    assert client.post("/teams", json=payload).status_code == 201
    assert client.post("/teams", json=payload).status_code == 409
    assert client.post("/heroes", json={"name": "Logan", "secret_name": "Wolverine", "team_id": 999}).status_code == 404


def test_missions_can_be_assigned_to_a_hero(client):
    hero = client.post("/heroes", json={"name": "Jean", "secret_name": "Phoenix"}).json()
    mission = client.post("/missions", json={"title": "Stop the Sentinels"}).json()
    assert client.post(f"/heroes/{hero['id']}/missions/{mission['id']}").status_code == 204
    assert client.get(f"/heroes/{hero['id']}/missions").json() == [mission]


def test_cors_and_validation(client):
    response = client.get("/heroes?limit=101", headers={"Origin": "http://localhost:5500"})
    assert response.status_code == 422
    assert response.headers["access-control-allow-origin"] == "http://localhost:5500"
