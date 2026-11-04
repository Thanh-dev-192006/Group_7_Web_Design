"""The backend serves the static frontend pages and the mock JSON files."""


def test_home_page_is_html(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_forecast_page_uses_forecast_script(client):
    response = client.get("/forecast.html")
    assert response.status_code == 200
    assert "js/forecast-page.js" in response.text


def test_forecast_script_is_javascript(client):
    response = client.get("/js/forecast-page.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]


def test_home_page_has_more_details_link(client):
    assert 'id="daily-more"' in client.get("/").text


def test_mock_forecast_has_seven_days(client):
    response = client.get("/mock/forecast.json")
    assert response.status_code == 200
    assert len(response.json()["data"]["daily"]) == 7
