# Weather & AQI Dashboard - Group 7 (Web Design and Programming)

A web dashboard for current weather, forecasts and air quality (US EPA AQI) in 15 cities across Vietnam. All data comes from [Open-Meteo](https://open-meteo.com/); the project does not train its own models.

Live demo: https://group-7-web-design-02.onrender.com/

## Features

- **Map** of the 15 cities (Leaflet / OpenStreetMap) with markers coloured by the current AQI category.
- **Current conditions** for the selected city, plus AQI health advice for the general population and for sensitive groups.
- **48-hour chart** of temperature and chance of rain (Chart.js), with a **rain alert** banner based on the next 12 hours.
- **7-day forecast** cards on the home page, each linking to a **forecast page** (`forecast.html`) for that day: summary, hourly temperature (actual / feels like) with weather icons, chance of rain, humidity and wind, UV index and hourly air quality charts.
- **Remembered location:** the last selected city is stored in the browser, and `?city=<id>` in the URL opens a specific city (deep link).
- **Auto refresh** of the current-conditions card and the map markers every 10 minutes.
- **Resilient loading:** skeleton placeholders while loading, a request timeout, and a retry button when loading data fails.
- **Mock mode:** add `?mock=1` to the URL to run the frontend on static JSON files, without the weather data source.

## Screenshots

Actual browser captures of the frontend with the bundled mock data (`?mock=1&city=1`), not live weather. Desktop viewport: **1280 × 900**; mobile viewport: **375 × 900**, captured at full page height.

![Full desktop dashboard](environmental-system/docs/images/screenshots/ui-desktop-home.png)

The desktop dashboard places the city picker and AQI map beside current conditions, the 48-hour chart and the seven-day forecast. The current card includes advice for sensitive groups.

![Full mobile dashboard at 375px](environmental-system/docs/images/screenshots/ui-mobile-home.png)

At 375px, the weather panels appear above the city picker and map. The seven-day forecast scrolls horizontally within its panel.

![Desktop forecast page](environmental-system/docs/images/screenshots/ui-desktop-forecast-page.png)

The forecast page for one day shows the day bar, a summary card and charts for temperature (with hourly weather icons), chance of rain, humidity and wind, UV index and hourly AQI.

See [section 3.2: interface screenshots](environmental-system/docs/UI_Screenshots.md) for all 18 captures (plus two cropped 375 × 812 mobile versions for print), including the map, current/AQI advice, 48-hour chart, seven-day forecast, the forecast page and its cards, rain alert, and error/Retry, all in the fixed dark theme, with captions and reproduction instructions.

The captures include the geographic basemap and AQI markers. When OpenStreetMap tiles are unavailable, the application uses CARTO Voyager with the project's browser basemap key.

## Architecture

```text
+---------------------------------------------------------------+
|        Frontend (plain HTML/CSS/JS, ES modules, no build)     |
|  - Leaflet map, markers coloured by AQI category              |
|  - Current card, 48 h Chart.js chart, 7-day forecast,         |
|    per-day forecast page (forecast.html)                      |
+---------------------------------------------------------------+
                               |
                               | HTTP GET (JSON, same origin)
                               v
+---------------------------------------------------------------+
|                         FastAPI backend                       |
|  Routers:                                                     |
|    GET /api/health                                            |
|    GET /api/locations                                         |
|    GET /api/locations/{id}                                    |
|    GET /api/locations/{id}/current                            |
|    GET /api/locations/{id}/forecast                           |
|    GET /api/current   (summary of all cities, for the map)    |
|                                                               |
|  In-memory TTL caches (weather 15 min, air quality 1 h)       |
|  SQLite (location metadata for the 15 cities)                 |
+---------------------------------------------------------------+
                               |
            +------------------+------------------+
            | cache hit                           | cache miss
            v                                     v
   [ In-memory TTL caches ]             +-----------------------+
                                        |    Open-Meteo APIs    |
                                        |  - Weather forecast   |
                                        |  - Air quality        |
                                        +-----------------------+
```

The backend also serves the static frontend, so the app runs from a single process on one origin.

## Quick start

Requires Python 3.12 or newer (and Node.js 21+ for the frontend tests, which use glob support in `node --test`). Run everything from the `environmental-system` folder.

Windows (PowerShell):

```powershell
cd environmental-system
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

macOS / Linux (bash):

```bash
cd environmental-system
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open:

- Web app: http://127.0.0.1:8000
- Mock mode: http://127.0.0.1:8000/?mock=1
- Interactive API docs (Swagger UI): http://127.0.0.1:8000/docs

The SQLite database (`weather.db`) and the 15 default locations are created automatically on first start. No API key is needed. See [`environmental-system/README.md`](environmental-system/README.md) for configuration.

## Testing

Lighthouse mobile/desktop scores, screenshots, original reports and measurement limitations are documented in [section 4.1](environmental-system/docs/Lighthouse_Results.md). Both measured runs encountered weather API HTTP 502 responses; the scores describe that observed error state.

Run from `environmental-system` with the virtual environment active. The backend and frontend suites need no network access.

```bash
# Backend (pytest, in-memory SQLite and a fake weather service)
pytest

# Frontend unit tests (Node's built-in test runner)
node --test frontend/tests/*.test.mjs
```

Latest results: 100 backend and 51 frontend tests passed; a manual browser checklist is also included; see [`docs/test-catalog.md`](environmental-system/docs/test-catalog.md).

## Project structure

```text
.
├── README.md                      # this file
└── environmental-system/
    ├── README.md                  # developer guide
    ├── requirements.txt
    ├── pytest.ini
    ├── .env.example               # optional configuration template
    ├── app/                       # FastAPI backend (routers, services, models, config)
    ├── frontend/                  # static frontend, no build step
    │   ├── index.html             # dashboard (map, current, 48 h, 7 days)
    │   ├── forecast.html          # per-day forecast page
    │   ├── css/                   # style.css, map.css, forecast.css, forecast-page.css
    │   ├── js/                    # main.js, forecast-page.js, api.js, day-detail.js,
    │   │                          #   day-summary-text.js, uv-index.js, page-links.js, ...
    │   │   └── components/        # chart, card, day-bar, day-view, day-charts, ... modules
    │   ├── mock/                  # sample JSON for ?mock=1
    │   └── tests/                 # node --test unit tests
    ├── tests/                     # backend tests
    ├── collector/                 # phase 2 placeholder (not implemented)
    ├── scripts/                   # check_open_meteo.py
    └── docs/
        ├── API.md                 # API contract
        ├── Architecture.md        # section 2.3: architecture and request flow
        ├── Design_Description.md  # section 2.2: UI/UX and wireframes
        ├── ER_Diagram_Explanation.md  # section 2.4: database design
        ├── UI_Screenshots.md      # section 3.2: interface screenshots
        ├── test-catalog.md        # section 4.1: automated tests and manual browser checklist
        ├── diagrams/              # Mermaid sources (architecture, ER)
        ├── wireframes/            # HTML sources of the wireframes
        ├── test-output/           # raw output of the latest test runs
        ├── images/                # diagrams, wireframes, test captures, screenshots
        ├── issues/                # per-role task descriptions
        └── plans/                 # design and implementation plans
```

## Team members (Group 7)

1. Member 1: _TODO: full name – student ID – role_
2. Member 2: _TODO: full name – student ID – role_
3. Member 3: _TODO: full name – student ID – role_
4. Member 4: _TODO: full name – student ID – role_

Phase 2 (periodic collector, history, anomaly detection) is not implemented; `environmental-system/collector/` is only a placeholder.
