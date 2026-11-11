# Test Case Catalog

This catalog covers the backend suite in `tests/`, the frontend unit suite in `frontend/tests/` plus a manual browser checklist. Each pytest parameterized AQI boundary is listed as its own test case. Results come from the actual runs of 2026-11-11: **100 backend tests passed** and **51 frontend tests passed** (151 automated tests, TC-001 to TC-151); the manual checklist is in the last section. Backend line coverage (pytest-cov, `--cov=app`): **94%** (682 statements, 38 missed).

Raw outputs are in `docs/test-output/` (`backend-pytest.txt`, `frontend-node.txt`, `backend-coverage.txt`); the images `docs/images/test_results.png` and `docs/images/frontend_tests.png` show the backend (with coverage total) and frontend summaries.

How to run (from `environmental-system/`):

```
pytest                                                    # backend
node --test frontend/tests/*.test.mjs                     # frontend (use the glob on Windows)
pip install -r requirements-dev.txt                       # once: pytest-cov
pytest --cov=app --cov-report=term                        # backend coverage
```

## Per-file overview

| File | What it checks | Tests |
|---|---|---|
| `test_core.py` | AQI category boundaries, TTL cache, health, OpenAPI docs, error format, same-origin frontend | 22 |
| `test_locations.py` | Locations endpoints: envelope, region filter, 404/400 errors | 6 |
| `test_overview.py` | `/api/current` all-locations summary: partial/total failures and caching | 4 |
| `test_weather.py` | Weather endpoints: current/forecast envelope, parameter validation, cache, upstream error mapping (502/503) | 11 |
| `test_weather_service.py` | Open-Meteo service: mapping, Vietnam-day to UTC conversion, AQI join by time, request parameters, new fields, caching, error mapping; air-quality cache, single-flight, cooldown, last-good, malformed replies; service singleton | 50 |
| `test_weather_router_air_quality.py` | Current and forecast routers with air quality: merged AQI and `meta.cached` flag | 2 |
| `test_pages.py` | Static pages, script and mock JSON served by the app | 5 |
| `day-detail.test.mjs` | Vietnam-day grouping, day summaries, day building, sunrise/sunset/UV max, daylight | 15 |
| `day-summary-text.test.mjs` | Day summary sentences, temperature/feels-like extremes, humidity & wind text, peak AQI | 11 |
| `health.test.mjs` | AQI health advice lookup | 3 |
| `location-memory.test.mjs` | Initial location choice (URL, stored ID, default) | 6 |
| `page-links.test.mjs` | `forecast.html` / `index.html` link builder | 2 |
| `rain-alert.test.mjs` | Rain alert logic and banner text | 7 |
| `ui-errors.test.mjs` | User-facing error messages | 4 |
| `uv-index.test.mjs` | UV category and peak UV hour | 3 |
| **Total (automated, TC-001 to TC-151)** | | **151** |

## Backend tests (`tests/`)

Test IDs are stable: existing IDs are never renumbered. Tests added later are appended with the next free ID, so the 29 air-quality, cooldown and singleton tests (TC-123 to TC-151) are listed at the end of this backend section, after TC-071.

| ID | Feature | Expected Result | Result |
|---|---|---|---|
| TC-001 | AQI categorization: missing value (`None`) | Returns no category (`None`). | PASS |
| TC-002 | AQI categorization: negative value (`-1`) | Returns no category (`None`). | PASS |
| TC-003 | AQI categorization: lower good boundary (`0`) | Returns `good`. | PASS |
| TC-004 | AQI categorization: upper good boundary (`50`) | Returns `good`. | PASS |
| TC-005 | AQI categorization: lower moderate boundary (`51`) | Returns `moderate`. | PASS |
| TC-006 | AQI categorization: upper moderate boundary (`100`) | Returns `moderate`. | PASS |
| TC-007 | AQI categorization: lower unhealthy-for-sensitive-groups boundary (`101`) | Returns `unhealthy_sensitive`. | PASS |
| TC-008 | AQI categorization: upper unhealthy-for-sensitive-groups boundary (`150`) | Returns `unhealthy_sensitive`. | PASS |
| TC-009 | AQI categorization: lower unhealthy boundary (`151`) | Returns `unhealthy`. | PASS |
| TC-010 | AQI categorization: upper unhealthy boundary (`200`) | Returns `unhealthy`. | PASS |
| TC-011 | AQI categorization: lower very-unhealthy boundary (`201`) | Returns `very_unhealthy`. | PASS |
| TC-012 | AQI categorization: upper very-unhealthy boundary (`300`) | Returns `very_unhealthy`. | PASS |
| TC-013 | AQI categorization: lower hazardous boundary (`301`) | Returns `hazardous`. | PASS |
| TC-014 | AQI categorization: upper hazardous boundary (`500`) | Returns `hazardous`. | PASS |
| TC-015 | TTL cache expiration | A value is returned from cache before its TTL expires and recomputed at the expiration time. | PASS |
| TC-016 | TTL cache failure handling | A failing factory raises its exception and the failed value is not cached. | PASS |
| TC-017 | Unknown API route error format | An unknown route returns HTTP 404 with the standard `NOT_FOUND` error code. | PASS |
| TC-018 | Health endpoint | Health response reports application and database status as `ok`. | PASS |
| TC-019 | Health cache count | Requesting current weather adds one cache entry, reflected by the health endpoint. | PASS |
| TC-020 | OpenAPI forecast validation documentation | Forecast documents HTTP 400, not 422, and the API docs endpoint responds successfully. | PASS |
| TC-021 | OpenAPI examples and operation descriptions | Required schemas include examples and every documented operation includes a summary and description. | PASS |
| TC-022 | Same-origin frontend serving | Root route responds with HTTP 200 and an HTML content type. | PASS |
| TC-023 | Location list response envelope | List endpoint returns `data` and `meta`, correct count/timestamp, and required location fields. | PASS |
| TC-024 | Location region filter | Filtering by `south` returns a non-empty list containing only south-region locations. | PASS |
| TC-025 | Invalid location region | Unsupported region returns HTTP 400 with `VALIDATION_ERROR`. | PASS |
| TC-026 | Read a known location | A location detail response matches the corresponding item in the location list. | PASS |
| TC-027 | Read an unknown location | Unknown ID returns HTTP 404 and the expected `LOCATION_NOT_FOUND` error body. | PASS |
| TC-028 | Non-integer location ID | Invalid path ID returns HTTP 400 with `VALIDATION_ERROR` on `path.location_id`. | PASS |
| TC-029 | Current weather for all locations | Returns one timestamped item per seeded location, ordered by ID, with matching metadata count. | PASS |
| TC-030 | Current weather skips one failing location | A single upstream location failure is omitted; remaining items and metadata count are correct. | PASS |
| TC-031 | Current weather when all locations fail | Returns HTTP 503 using the standard `UPSTREAM_UNAVAILABLE` error format. | PASS |
| TC-032 | Current weather aggregate caching | First response is uncached and the repeated response reports a cache hit. | PASS |
| TC-033 | Current weather response and caching | Current endpoint returns the expected envelope, location/AQI/time fields, null for missing wind, and a cache hit on repeat. | PASS |
| TC-034 | Forecast respects hours and days parameters | Requesting 12 hours and three days returns those exact hourly and daily counts. | PASS |
| TC-035 | Forecast hours upper bound | An out-of-range hours value returns HTTP 400 and identifies `query.hours`. | PASS |
| TC-036 | Forecast hours lower bound | Zero hours returns HTTP 400 and identifies `query.hours`. | PASS |
| TC-037 | Unknown location weather request | Current weather request for an unknown location returns `LOCATION_NOT_FOUND`. | PASS |
| TC-038 | Forecast days upper bound | Requesting more than seven days returns HTTP 400 and identifies `query.days`. | PASS |
| TC-039 | Forecast requests share cache across parameters | Different valid hours/days parameters reuse a cache entry and invoke the service once. | PASS |
| TC-040 | Current endpoint upstream error | Upstream failure maps to HTTP 502 and `UPSTREAM_ERROR`, retaining the diagnostic message. | PASS |
| TC-041 | Current endpoint upstream unavailable | Upstream unavailability maps to HTTP 503 and `UPSTREAM_UNAVAILABLE`, retaining the diagnostic message. | PASS |
| TC-042 | Forecast endpoint upstream error | Upstream failure maps to HTTP 502 and `UPSTREAM_ERROR`, retaining the diagnostic message. | PASS |
| TC-043 | Forecast endpoint upstream unavailable | Upstream unavailability maps to HTTP 503 and `UPSTREAM_UNAVAILABLE`, retaining the diagnostic message. | PASS |
| TC-044 | Map current weather and air quality | Maps weather fields and AQI correctly, including observation time and `unhealthy_sensitive` category. | PASS |
| TC-045 | Missing current weather values | Missing/null wind and precipitation remain `None`, rather than being converted to zero. | PASS |
| TC-046 | Current weather survives air-quality failure | Weather data remains available while AQI fields become `None`. | PASS |
| TC-047 | Forecast starts at current hour and returns 168 hours | Hourly results start at the current hour, include 168 points, and daily results include seven days. | PASS |
| TC-048 | Hourly forecast length is independent of requested daily length | Requesting 168 hours and three daily values returns all 168 hourly points and three daily points. | PASS |
| TC-049 | Forecast trims requested hours and days | A 12-hour/two-day request returns exactly 12 hourly and two daily points. | PASS |
| TC-050 | Shorter AQI forecast aligns by time | AQI is present only for covered timestamps; later weather points remain present with null AQI. | PASS |
| TC-051 | Offset AQI forecast aligns by timestamp | AQI values beginning at a later timestamp are matched to weather points by time, not array index. | PASS |
| TC-052 | Forecast API call count and cache sharing | Forecast and air-quality APIs are each called once; different forecast parameters reuse the cached result. | PASS |
| TC-053 | Upstream timeout mapping | A client connection timeout raises `UpstreamUnavailable`. | PASS |
| TC-054 | Upstream HTTP error mapping | An upstream HTTP 500 response raises `UpstreamError`. | PASS |
| TC-055 | Malformed upstream payload mapping | Malformed current-weather and forecast payloads each raise `UpstreamError`. | PASS |
| TC-056 | Injected empty cache is retained | `WeatherService` uses the caller-provided empty cache instance. | PASS |
| TC-057 | Injected HTTP client is retained | `WeatherService` uses the caller-provided Open-Meteo client instance. | PASS |
| TC-058 | Forecast requests an extra weather day | A 168-hour forecast requests eight forecast days so enough future hourly data is available. | PASS |
| TC-059 | Cached forecast rolls forward to serve-time hour | A second request within cache TTL starts at the updated current hour, returns 168 points, and makes no extra API calls. | PASS |
| TC-060 | Vietnam-local times converted to UTC | Local timestamps from the upstream (UTC+7) are returned as UTC (`observed_at`, hourly times); daily dates stay as sent. | PASS |
| TC-061 | Air-quality join by UTC time after conversion | Air-quality values (GMT) are still matched to the converted weather hours by time; hours before the AQI range get null AQI. | PASS |
| TC-062 | Request time zones per upstream | The forecast call requests `timezone=Asia/Ho_Chi_Minh` and the air-quality call requests `timezone=GMT`. | PASS |
| TC-063 | Extra hourly and daily fields mapped | Hourly feels-like, humidity, wind speed and UV index, and daily sunrise/sunset (converted to UTC) and `uv_index_max` are mapped; days without sunrise/sunset give `None`. | PASS |
| TC-064 | Missing extra columns stay `None` | When the upstream omits the new columns, those hourly and daily fields are `None`, not zero. | PASS |
| TC-065 | Forecast asks upstream for the extra variables | The forecast request lists `apparent_temperature`, `relative_humidity_2m`, `wind_speed_10m`, `uv_index` (hourly) and `sunrise`, `sunset`, `uv_index_max` (daily). | PASS |
| TC-066 | Separate current and forecast requests | The current call sends a `current` block only (no `hourly`/`daily`) with the Vietnam time zone; the forecast call sends `hourly` and `daily` only (no `current`). | PASS |
| TC-067 | Home page served | `GET /` returns HTTP 200 and an HTML content type. | PASS |
| TC-068 | Forecast page script | `GET /forecast.html` returns HTTP 200 and references `js/forecast-page.js`. | PASS |
| TC-069 | JavaScript served | `GET /js/forecast-page.js` returns HTTP 200 and a JavaScript content type. | PASS |
| TC-070 | More details link | `index.html` contains the `daily-more` link. | PASS |
| TC-071 | Mock forecast served | `GET /mock/forecast.json` returns HTTP 200 and 7 daily entries. | PASS |
| TC-123 | Router: current uses air quality; cached flag | `/current` returns the merged AQI, and `meta.cached` is false while an air-quality call was made and true when none was. | PASS |
| TC-124 | Router: forecast merges hourly air quality | `/forecast` returns hourly AQI values merged into the hourly weather points. | PASS |
| TC-125 | Current and forecast share one air-quality call | Requesting current and forecast for one location triggers a single air-quality request. | PASS |
| TC-126 | Air-quality forecast days configurable | The air-quality request uses `forecast_days` from settings (default 5). | PASS |
| TC-127 | Air-quality 429 not cached, recovers after cooldown | An HTTP 429 gives null AQI, is not cached, and a new call is made only after the 300 s cooldown. | PASS |
| TC-128 | Cooldown applies to all locations | After an air-quality failure, no air-quality call is made for any location until the cooldown ends. | PASS |
| TC-129 | `meta.cached` true when no call was made | During a cooldown the response is flagged as cached, because no upstream call was made. | PASS |
| TC-130 | Last-good air quality served on failure | After a failure the last good AQI is served until `AIR_QUALITY_STALE_MAX_SECONDS` (6 h) is exceeded. | PASS |
| TC-131 | Stale air quality expires inside cooldown | Last-good data older than the maximum age is dropped without a new call while the cooldown lasts. | PASS |
| TC-132 | Air quality refetched after TTL | Air quality is requested again once its 1-hour cache entry has expired. | PASS |
| TC-133 | Malformed air quality: case 1 of 5 | A malformed air-quality payload counts as a failure and is not cached (case `bad0`). | PASS |
| TC-134 | Malformed air quality: case 2 of 5 | A malformed air-quality payload counts as a failure and is not cached (case `bad1`). | PASS |
| TC-135 | Malformed air quality: case 3 of 5 | A malformed air-quality payload counts as a failure and is not cached (case `bad2`). | PASS |
| TC-136 | Malformed air quality: case 4 of 5 | A malformed air-quality payload counts as a failure and is not cached (case `bad3`). | PASS |
| TC-137 | Malformed air quality: case 5 of 5 | A malformed air-quality payload counts as a failure and is not cached (case `bad4`). | PASS |
| TC-138 | Empty air quality keeps last-good: case 1 of 3 | An empty air-quality reply does not overwrite the last good data (case `empty0`). | PASS |
| TC-139 | Empty air quality keeps last-good: case 2 of 3 | An empty air-quality reply does not overwrite the last good data (case `empty1`). | PASS |
| TC-140 | Empty air quality keeps last-good: case 3 of 3 | An empty air-quality reply does not overwrite the last good data (case `empty2`). | PASS |
| TC-141 | Air-quality timeout starts cooldown | A timeout from the air-quality API starts the global cooldown; weather is still returned. | PASS |
| TC-142 | Non-429 4xx backs off one location only | An air-quality 4xx other than 429 backs off only that location; other locations are still requested. | PASS |
| TC-143 | Air-quality 5xx starts cooldown | An air-quality 5xx reply starts the global cooldown. | PASS |
| TC-144 | `current_many` skips air quality during cooldown | The all-cities summary makes no air-quality calls while the cooldown is active. | PASS |
| TC-145 | Cached weather objects not mutated | Merging air quality never changes the cached weather objects. | PASS |
| TC-146 | Current AQI from the current hour | Current AQI comes from the hourly value of the current hour, not from the older `current` block. | PASS |
| TC-147 | Current AQI fallback only when fresh | The `current` block AQI is used as a fallback only when it is fresh. | PASS |
| TC-148 | Concurrent requests: one air-quality call | Concurrent current and forecast requests for one location make a single air-quality call (single-flight). | PASS |
| TC-149 | Non-finite air-quality numbers | NaN or infinite air-quality values are treated as missing. | PASS |
| TC-150 | Hourly AQI null falls back to current block | When the hourly AQI at the current hour is null, the `current` block value is used. | PASS |
| TC-151 | Service singleton created once under concurrency | `get_weather_service` creates one instance even when called from many threads. | PASS |

## Frontend tests (`frontend/tests/`)

| ID | Feature | Expected Result | Result |
|---|---|---|---|
| TC-072 | UTC evening belongs to the next local day | `localDateKey` maps 16:59Z to the same Vietnam date and 17:00Z to the next date (UTC+7). | PASS |
| TC-073 | Group hours by local date | `groupByLocalDate` splits across the UTC boundary and keeps hour order. | PASS |
| TC-074 | Group ignores invalid input | Null input or points with invalid times give no groups. | PASS |
| TC-075 | Day summary computation | `summarizeDay` returns high/low, max rain chance and total precipitation. | PASS |
| TC-076 | Day summary with nulls | Nulls are skipped; a day with no valid values returns `null` fields, not 0. | PASS |
| TC-077 | Day summary of empty input | Empty or undefined input gives an all-null summary. | PASS |
| TC-078 | Seven local days from 168 hours | 168 hours starting 03:00 Vietnam time give 7 non-empty days; day 1 starts at hour 3, day 2 at hour 0. | PASS |
| TC-079 | Day weather code selection | The daily weather code wins, else the maximum hourly code, else `null`. | PASS |
| TC-080 | Day summary from own points | Summary comes from the day's own hourly points; empty input gives no days. | PASS |
| TC-081 | `maxDays` limit | `buildDays` returns at most the requested number of days. | PASS |
| TC-082 | Pick the requested day | `pickDayIndex` selects the matching date, otherwise index 0 (also for an empty list). | PASS |
| TC-083 | Daily values override hourly summary | Daily entry values win for the summary and each field falls back to hourly data independently. | PASS |
| TC-084 | Partial first-day note | The " · from HH:00" note appears only for a partial first day. | PASS |
| TC-085 | Sunrise, sunset and UV max per day | Daily sunrise/sunset/UV max are carried over; UV max falls back to the hourly maximum, else `null`. | PASS |
| TC-086 | Daylight detection | `isDaylight` uses sunrise/sunset when known, otherwise the 06:00-18:00 rule. | PASS |
| TC-087 | Temperature extremes | Hourly high and low are found, skipping nulls; empty input gives null points. | PASS |
| TC-088 | Summary text: normal day | Text reads "Low of 23° around 04:00 and high of 31° around 13:00. Chance of rain up to 88%, total 4.0 mm." | PASS |
| TC-089 | Time shown when the extreme rounds to the shown value | The hour is included when the hourly extreme rounds to the displayed daily number. | PASS |
| TC-090 | Time omitted for partial-day extremes | The hour is omitted when the daily value is more extreme than every hourly point. | PASS |
| TC-091 | Plateau: earliest hour wins | For equal extremes the earliest hour is used for both high and low. | PASS |
| TC-092 | Peak AQI hour | `peakAqi` returns the earliest highest hour, or `null` when none. | PASS |
| TC-093 | Null parts omitted | Missing high, low, rain or precipitation parts are left out of the sentence. | PASS |
| TC-094 | Empty summary text | Null/empty input gives an empty string. | PASS |
| TC-095 | Extremes for another field | `temperatureExtremes` works on `apparent_temperature_c` (feels like). | PASS |
| TC-096 | Humidity and wind text | Range text such as "Humidity 62–88% · Wind up to 18 km/h"; parts without data are omitted. | PASS |
| TC-097 | Feels-like text | "Feels like up to 36° around 13:00, down to 27° around 04:00."; empty string when no data. | PASS |
| TC-098 | Health advice exists for every AQI level | Every known AQI category returns non-empty advice for both the general and sensitive groups. | PASS |
| TC-099 | Unknown or missing AQI health-advice category | Unknown, missing, null, and inherited-property-like categories return `null`. | PASS |
| TC-100 | Health advice text for representative AQI levels | Advice text matches US EPA guidance for `good` and `hazardous`. | PASS |
| TC-101 | Initial location URL priority | A valid `?city` URL value takes priority over a stored location ID. | PASS |
| TC-102 | Initial location stored-ID fallback | When no URL city is supplied, a valid stored ID is selected. | PASS |
| TC-103 | Initial location default | With neither URL city nor stored ID, the first available location is selected. | PASS |
| TC-104 | Invalid URL location fallback | Invalid, unknown, fractional, and empty URL values fall back to a valid stored ID. | PASS |
| TC-105 | Invalid URL and stored location fallback | When both URL and stored IDs are invalid, the first available location is selected. | PASS |
| TC-106 | Empty location list | No available locations returns `null`. | PASS |
| TC-107 | Page URL with city and day | `pageUrl("forecast.html", {city, day})` builds `forecast.html?city=3&day=2026-11-05`; city only and no params also work. | PASS |
| TC-108 | Page URL keeps `mock=1` only when requested | `mock=1` is appended only when `mock` is true. | PASS |
| TC-109 | Rain probability threshold | Probability 59 does not alert; probability 60 produces a rain alert with matching time and probability. | PASS |
| TC-110 | Rain weather-code trigger without probability | A rain weather code triggers an alert even when probability is null; it is marked as code-triggered. | PASS |
| TC-111 | Rain alert text and probability display | Code-triggered rain omits the percentage, while threshold-triggered rain includes it. | PASS |
| TC-112 | Thunderstorm severity | Thunderstorm weather codes 95-99 produce a `storm` alert. | PASS |
| TC-113 | Rain alert look-ahead window | Events after the first 12 hours are ignored; an event within the window triggers an alert. | PASS |
| TC-114 | Empty or invalid rain-alert input | Empty, missing, or non-array hourly input returns `null`. | PASS |
| TC-115 | Rain alert text variants | Rain, storm, no-rain, and null-probability alerts produce their expected text. | PASS |
| TC-116 | Known frontend error-code messages | Every listed known error code maps to a non-empty user-facing message distinct from the raw backend message. | PASS |
| TC-117 | Unknown frontend error-code message | Unknown codes use the generic message and do not expose the raw error message. | PASS |
| TC-118 | Frontend TypeError message | A plain `TypeError` maps to the generic user-facing message. | PASS |
| TC-119 | Null or undefined frontend error | Null and undefined errors map to the generic user-facing message. | PASS |
| TC-120 | UV category boundaries | `uvCategory` uses the rounded value: 0-2 low, 3-5 moderate, 6-7 high, 8-10 very high, 11+ extreme. | PASS |
| TC-121 | UV category missing values, labels and colours | Null, undefined and non-numeric input give `null`; 8 is labelled "Very high"; colours are hex codes. | PASS |
| TC-122 | Peak UV hour | `peakUv` returns the earliest highest hour, or `null` when none. | PASS |

## Manual browser test cases (report 4.1)

These cases are checked by hand in Google Chrome with the bundled mock data: from `environmental-system`, run `python -m http.server 8000 --directory frontend` and open `http://127.0.0.1:8000/index.html?mock=1&city=1`. Use the DevTools device toolbar for 375 px, the Rendering tab to emulate `prefers-color-scheme: light`, and Network request blocking on `forecast.json` for the error case. The mock forecast covers 2026-10-21 to 2026-10-27 (location 1). Results below were recorded on 2026-11-04; re-check them before submitting.
| ID | Feature | Expected Result | Result |
|---|---|---|---|
| M-01 | Home loads: 15 cities, map markers, current card | Dropdown lists 15 cities, 15 map markers are drawn and the current card shows a temperature. | PASS |
| M-02 | ?city=<id> selects that city | `?city=5` selects city 5 in the dropdown and URL, and exactly one marker is pressed. | PASS |
| M-03 | Reload without ?city remembers the last city (localStorage) | Opening the page without `?city` after visiting city 7 selects city 7 again (localStorage). | PASS |
| M-04 | Rain alert banner is shown with mock data | The 48-hour card shows a rain alert banner ("Rain likely at ..."). | PASS |
| M-05 | Forecast HTTP 503 shows an error with Retry; Retry after restore reloads | A 503 on the forecast shows an error text and Retry buttons while the current card still renders; after restoring the server, Retry reloads the chart and cards. | PASS |
| M-06 | 7-day cards link to forecast.html with city and day; "More details" link present | 7 day cards are links to `forecast.html?city=1&day=<date>`; "More details" links to `forecast.html?city=1`. | PASS |
| M-07 | Forecast page opens on the requested day | `forecast.html?day=2026-10-25` shows 7 tabs with the 5th tab selected. | PASS |
| M-08 | Day bar keyboard: ArrowRight/Home/End move the selection and update URL day= | ArrowRight, End, Home and ArrowLeft move the selected tab and update `day=` in the URL. | PASS |
| M-09 | Actual / Feels like toggle switches aria-pressed and persists across day switch | Clicking "Feels like" sets `aria-pressed`; the choice stays after selecting another day. | PASS |
| M-10 | Forecast page renders 5 chart canvases and the hourly icon row | 5 chart canvases (temperature, rain, humidity and wind, UV, AQI) and the hourly icon row are rendered. | PASS |
| M-11 | Back link returns to the home page with the same city | The Back link opens `index.html` with the same `city` and the dropdown shows it. | PASS |
| M-12 | 375px viewport: no horizontal overflow on both pages | At 375 px width `scrollWidth` does not exceed the viewport on either page. | PASS |
| M-13 | Theme is always dark | Both pages use background `rgb(15, 21, 32)` even when DevTools emulates `prefers-color-scheme: light`. | PASS |
| M-14 | No console errors or uncaught exceptions on either page | No `console.error` call and no uncaught exception on either page. | PASS |

API-level error cases (404 unknown location or route, 400 invalid parameters, 502/503 upstream failures) are not repeated in the browser; they are covered by the backend tests TC-017, TC-025, TC-027, TC-028, TC-031, TC-035 to TC-038 and TC-040 to TC-043 above.
