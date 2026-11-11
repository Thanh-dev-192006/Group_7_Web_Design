# 2.3 System architecture

**Figure caption:** System architecture of the Weather & AQI dashboard (client, FastAPI server, third-party data source).

![System architecture](images/system-architecture.png)

Source: [`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd) (Mermaid). To re-render, paste it into <https://mermaid.live> or run `npx -y @mermaid-js/mermaid-cli@11.4.2 -i docs/diagrams/system-architecture.mmd -o docs/images/system-architecture.png -w 900 -s 2 -b white`. The figure is a vertical (top-to-bottom) flowchart so that it stays readable at A4 text width; the theme and font size are set inside the `.mmd` file.

## Client–server model

The application is a classic client–server web app deployed as **one service**. A single FastAPI process serves both the static frontend (`/`, `/forecast.html`, `/js`, `/css`) and a read-only JSON REST API under `/api`. There is no separate frontend host and no build step.

- **Client (browser):** two pages written in plain HTML, CSS and JavaScript ES modules.
  - `index.html` is the dashboard: city picker, Leaflet map with AQI-coloured markers, current conditions with AQI health advice, a 48-hour Chart.js chart and seven day cards.
  - `forecast.html` is the per-day forecast page. It opens in the same tab from a day card or the "More details" link (`?city=<id>&day=<YYYY-MM-DD>`) and shows a day bar, a summary, and temperature, rain, humidity and wind, UV and AQI charts.
  - `api.js` is the only module that calls the backend. The last selected city is kept in `localStorage`.
  - Leaflet, Chart.js and the map tiles are loaded from public CDNs.
- **Server (FastAPI, Python 3.12):** routers validate input and return `{data, meta}` or `{error: {code, message}}`.
  - The SQLite database holds only the `Location` table (15 cities, seeded at start-up).
  - `WeatherService` merges, normalises and caches weather and air-quality data.
  - `OpenMeteoClient` (httpx, 10 s timeout) is the only component that talks to the outside world.
- **Third-party data source: Open-Meteo.** No API key is needed. All weather and air-quality values come from Open-Meteo; the application does not measure or model anything itself. Its added value is aggregation, caching, normalisation (UTC datetimes, missing values kept as `null`), AQI classification and visualisation.

## Request flow (numbers match the figure)

1. The browser loads `index.html` or `forecast.html` and the static assets from FastAPI. Leaflet, Chart.js and the map tiles (OpenStreetMap, with CARTO as fallback) come from public CDNs, not from the server.
2. `api.js` calls an endpoint, for example `GET /api/locations/1/forecast?hours=168&days=7`.
3. The router looks up the city in SQLite (`deps`); an unknown id returns `404 LOCATION_NOT_FOUND`.
4. The router asks `WeatherService` for the data.
5. `WeatherService` checks its caches. Weather: same city, less than 15 minutes old. Air quality: less than 1 hour old, cached separately, one upstream call at a time per location (single-flight). On a hit no call to Open-Meteo is made.
6. On a miss, `WeatherService` calls `OpenMeteoClient` (httpx, 10 s timeout).
7. The client sends HTTPS GET requests to Open-Meteo:
   - **Forecast API, current conditions:** 8 variables. Used by `/current` and `/api/current`.
   - **Forecast API, hourly and daily:** 16 variables over 8 days, requested in `Asia/Ho_Chi_Minh` so daily values are Vietnam calendar days. Used by `/forecast`.
   - **Air Quality API:** `pm2_5` and `us_aqi` for 5 days, in GMT.

After step 7 the service builds the response and the router returns the `{data, meta}` JSON envelope (or `{error: {code, message}}`); the frontend converts UTC to Vietnam time for display.

- Local times are converted to UTC with `utc_offset_seconds`, and air quality is joined to weather by timestamp.
- If the air-quality call fails (HTTP 429, 5xx, timeout or an unusable reply), weather is still returned. A global cooldown of 5 minutes pauses all air-quality calls, and the last good AQI (up to 6 hours old) is served, or `null` AQI fields if there is none. A 4xx other than 429 backs off only that location.
- If the forecast call fails, the API returns 502 or 503.

## Design notes and trade-offs

- **One service instance per process.** The `WeatherService` singleton (and so its caches) is created once per process, guarded by a lock against concurrent first requests.
- **Cache instead of a weather table.** Weather data changes continuously and Open-Meteo already stores the source data. The in-memory caches (15 minutes for weather, 1 hour for air quality, which also falls back to the last good data when Open-Meteo rate-limits us) cut upstream calls and keeps the database small.
  - The cache is lost on restart.
  - Each process has its own cache.
  - No history is kept. A `Reading` table is planned for Phase 2 and is not implemented.
- **Split forecast requests.** Open-Meteo counts a request with more than 10 variables as several calls, so current conditions and hourly+daily data are requested separately. This uses less quota than one 24-variable request.
- **Shared quota.** The Open-Meteo free limit is per IP address. On a shared host such as Render, the air-quality quota can run out and the UI then shows "No data" for AQI. This is a known limitation.
