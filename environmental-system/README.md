# Weather & AQI - developer guide

Backend and frontend of the Group 7 weather and air-quality dashboard for 15 Vietnamese cities. For a project overview see the [root README](../README.md).

- Backend: **FastAPI** + SQLModel + SQLite, with a 15-minute in-memory cache.
- Frontend: plain HTML/CSS/JS (ES modules) + Leaflet + Chart.js, served by FastAPI from the same origin.
- Data: [Open-Meteo](https://open-meteo.com/) forecast and air-quality APIs (no API key).
- API contract: [`docs/API.md`](docs/API.md). Team workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Setup

Requires Python 3.12 or newer (and Node.js 21+ for the frontend tests, which use glob support in `node --test`). Run all commands from this folder (`environmental-system`).

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Optional: copy the configuration template.

```powershell
copy .env.example .env              # macOS/Linux: cp .env.example .env
```

Every variable has a default in `app/config.py`, so the app runs without a `.env` file. `.env` is git-ignored.

### Configuration

Values are read from environment variables or `.env` (names are case-insensitive).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///<project>/weather.db` | SQLAlchemy URL of the database. By default a SQLite file next to the code. |
| `CACHE_TTL_SECONDS` | `900` | Lifetime of cached Open-Meteo results, in seconds. |
| `HTTP_TIMEOUT_SECONDS` | `10` | Timeout of each request to Open-Meteo, in seconds. |
| `LOG_LEVEL` | `INFO` | Python logging level. |
| `CORS_ORIGINS` | `[]` | JSON list of allowed origins, e.g. `["http://localhost:5500","http://127.0.0.1:5500"]`. Only needed when the frontend is served from another port (such as VS Code Live Server); the default same-origin setup does not need it. Only `GET` is allowed. |

`app/config.py` also defines `OPEN_METEO_FORECAST_URL`, `OPEN_METEO_AIR_QUALITY_URL` and `OVERVIEW_MAX_WORKERS` (default `8`, the number of parallel workers used by `/api/current`). They are not listed in `.env.example`, but can be overridden the same way.

If you serve the frontend separately, also set `API_BASE` in `frontend/js/config.js` to the backend URL (for example `http://127.0.0.1:8000`).

## Run

```powershell
uvicorn app.main:app --reload
```

| URL | Content |
|---|---|
| http://127.0.0.1:8000/ | Web app |
| http://127.0.0.1:8000/?mock=1 | Web app on the static data in `frontend/mock/*.json` (always location id 1 for the detail views) |
| http://127.0.0.1:8000/docs | Swagger UI |
| http://127.0.0.1:8000/api/health | Health check: database status, app version, number of live cache entries |

On startup the app creates the tables and seeds the 15 locations (idempotent, matched by `slug`), so the first run needs no manual database step. `fastapi dev app/main.py` (from `fastapi[standard]`) works as well.

## Tests

```powershell
pytest                                       # backend
node --test frontend/tests/*.test.mjs        # frontend logic (Node's built-in runner)
```

Backend tests use an in-memory SQLite database and a fake weather service (`tests/conftest.py`). They need no network and do not touch `weather.db`. To check the real Open-Meteo API manually, run `python -m scripts.check_open_meteo` (optionally followed by a location slug such as `ha-noi`).

## Folder layout

```text
environmental-system/
├── app/
│   ├── main.py            # assembles the app: routers, error handlers, optional CORS, frontend mount
│   ├── config.py          # settings (environment / .env)
│   ├── database.py        # SQLite engine (WAL), get_session / SessionDep
│   ├── models.py          # DB tables (Location; Reading is commented out for phase 2)
│   ├── schemas.py         # API contract: Envelope, CurrentWeather, CurrentSummary, Forecast, ...
│   ├── errors.py          # AppError and handlers -> one error format
│   ├── seed.py            # the 15 locations
│   ├── routers/           # locations, overview, weather, health, shared deps
│   └── services/
│       ├── open_meteo.py  # HTTP client for Open-Meteo
│       ├── weather.py     # builds API schemas from Open-Meteo data; caching
│       ├── cache.py       # thread-safe TTL cache
│       └── aqi.py         # AQI category from the US AQI value
├── frontend/
│   ├── index.html
│   ├── css/               # style.css, map.css, forecast.css
│   ├── js/                # main.js (orchestration), api.js (only module that calls the API,
│   │                      #   incl. mock mode and timeout), config.js, rain-alert.js,
│   │                      #   location-memory.js, health.js, ... and components/
│   ├── mock/              # sample responses matching the API contract
│   └── tests/             # node --test unit tests
├── tests/                 # backend tests
├── collector/             # phase 2 placeholder (not implemented)
├── scripts/               # check_open_meteo.py
├── docs/                  # API.md, issues/, plans/
├── requirements.txt
├── pytest.ini
└── .env.example
```

## Endpoints

All endpoints are `GET`. Successful responses are `{ "data": ..., "meta": ... }`; errors are `{ "error": { "code", "message" } }`. Details are in [`docs/API.md`](docs/API.md).

| Endpoint | Purpose |
|---|---|
| `/api/health` | Database and cache status |
| `/api/locations` | List of locations (optional `region=north\|central\|south`) |
| `/api/locations/{id}` | One location |
| `/api/locations/{id}/current` | Current weather and AQI |
| `/api/locations/{id}/forecast?hours=48&days=7` | Hourly and daily forecast |
| `/api/current` | Summary of all locations, used to colour the map markers |

## Data flow and caching

1. The router validates the request and resolves the location from SQLite (unknown id -> 404).
2. `WeatherService` (`app/services/weather.py`) looks in the in-memory `TTLCache`. On a miss it calls the Open-Meteo forecast API and air-quality API and maps the result to the project's schemas.
3. The cache key is per location and kind (`current` or `forecast`), with a TTL of `CACHE_TTL_SECONDS` (15 minutes). The cache lives in the process, so each uvicorn worker has its own. A forecast-API failure stores nothing; an air-quality failure still caches the result, with null AQI fields, for the TTL.
4. `meta.cached` tells the client whether the response came from the cache.

Rules worth knowing:

- **One forecast per location is cached**, always covering the maximum range (7 days / 168 hours). `hours` (1-168, default 48) and `days` (1-7, default 7) only trim the cached copy when responding, so every parameter combination shares one cache entry.
- **Hourly data is filtered at serve time:** only points at or after the current UTC hour are returned, so an older cached forecast does not start in the past.
- **AQI is optional.** If the air-quality API fails, weather is still returned and all AQI fields (`pm2_5`, `us_aqi`, `aqi_category`) are `null`. The same happens for hours beyond the range of the air-quality data. If the weather API fails, the endpoint returns 502/503.
- **Missing values are `null`**, never `0`. Air-quality and weather hours are joined by timestamp, not by index.
- **Times are UTC** (`daily[].date` is the UTC date); the frontend converts to Vietnam time for display.
- **AQI categories are decided by the backend** (`app/services/aqi.py`, US EPA scale from the `us_aqi` value). The frontend only displays them.
- **`/api/current`** fetches all locations in parallel and skips locations that fail. It returns an error only when every location fails.

## Frontend notes

- `js/api.js` is the only module that makes requests. `?mock=1` makes it read `frontend/mock/*.json` instead.
- The current card and the map markers refresh every 10 minutes (`REFRESH_MINUTES` in `js/config.js`), skipped while the tab is hidden. Requests time out after 25 s (`REQUEST_TIMEOUT_MS`).
- The selected location is stored in `localStorage` and mirrored to `?city=<id>`; the URL value wins on load, then the stored one, then the first location.
- The rain alert looks at the next 12 hours of the hourly forecast (chance of rain of at least 60 % or a rain/thunderstorm weather code).

## Known limitations

- **Daily forecast cards use UTC days.** Open-Meteo is called with `timezone=GMT` and the frontend formats the weekday in UTC, so between 00:00 and 06:59 Vietnam time the first card is the previous Vietnam date.
- **The cache is per process.** Each uvicorn worker has its own copy.
- **No single-flight on a cold cache.** Concurrent requests for the same uncached location each call Open-Meteo.

## Not implemented yet

Phase 2 (periodic collector, history, anomaly detection) is a placeholder: `collector/run.py` and the commented-out `Reading` model.
