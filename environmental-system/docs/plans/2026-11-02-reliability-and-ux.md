# Plan: Reliability fixes + frontend UX (2026-11-02)

Branch: `fix/reliability-and-ux`. Project root: `environmental-system/`.
Spec: no separate spec — this plan is the authority. Source: code review on 2026-11-02.

## Global Constraints

- Python 3.12, FastAPI, SQLModel. Run backend tests with
  `../hero-api/.venv/Scripts/python.exe -m pytest` from `environmental-system/` (that venv has all deps).
- Frontend: plain ES modules, no framework, no bundler, no new npm dependencies.
  Pure-logic JS modules get unit tests with Node's built-in runner: `node --test frontend/tests/`
  (Node v24 available). Test files: `frontend/tests/*.test.mjs`. A module that is unit-tested must
  NOT import `config.js` (it reads `window`) — pass needed values as parameters.
- DOM: only `el()` / `textContent` / `createElement`. Never `innerHTML` with data.
- All user-facing text is Vietnamese.
- API response field names are fixed by `app/schemas.py` and `docs/API.md`; do not rename.
- Do not change files outside the task's file list unless the task says so.
- Commit at the end of each task with a conventional-commit message (`fix:`, `feat:`, `test:`).

---

## Task 1: Backend — forecast cache correctness

Files: `app/services/weather.py`, `tests/test_weather_service.py`, `docs/API.md` (only if wording needs to change).

Bugs to fix (TDD: write a failing test for each first):

1. **Injected empty cache is discarded.** `self.cache = cache or TTLCache(...)` — `TTLCache` defines
   `__len__`, so an empty injected cache is falsy and replaced by the default. Same pattern on
   `self.client`. Fix both to `x if x is not None else Default(...)`.
   Test: inject `TTLCache(60)`, assert `service.cache is injected`.
2. **Cached forecast keeps a stale start hour.** `_build_hourly` filters `time < floor(now)` at build
   time, and the result is cached for 15 min. Served from cache at a later hour, hourly[0] is in the
   past. Fix: the cached Forecast keeps all hourly points from the payload (no "now" filter at build
   time); `forecast()` filters `p.time >= floor_to_hour(self._clock())` at serve time, then slices
   `[:hours]`. Test: build with clock at 13:50, advance injected clock to 14:05 (still within TTL),
   call again — hourly[0].time == 14:00 and the second call is a cache hit (no new HTTP call).
3. **`hours=168` returns only 154 points.** The payload starts 00:00 today, so dropping past hours
   leaves fewer than 168. Fix: fetch the weather forecast with `forecast_days=MAX_DAYS + 1` so at least
   168 future hours exist; cap hourly at `MAX_HOURS` at serve time; daily stays capped at `MAX_DAYS`
   (7). Air quality fetch stays as is — hours beyond its range keep AQI null (already the documented
   behavior). Update existing tests that assert 154 so they assert 168, and extend the test payload
   helper to 192 hours / 8 days where needed.

Acceptance: all backend tests pass (55 existing, adjusted + new). `docs/API.md` statements
"bắt đầu từ giờ hiện tại" and "hours 1–168" are now true.

---

## Task 2: Frontend — reliability fixes

Files: `frontend/js/main.js`, `frontend/js/api.js`, `frontend/js/config.js`,
`frontend/js/components/hourly-chart.js`, `frontend/js/components/daily-list.js`, `frontend/css/forecast.css`.

1. **Render errors leave panels stuck in "loading".** In `selectLocation` and `refreshCurrent`
   (main.js), wrap each render branch (current; forecast) in try/catch. On an exception, set that
   panel(s) to the error state with `"Dữ liệu trả về không hợp lệ"` and `console.error` the cause.
   Also `init()` at the bottom must not produce an unhandled rejection: `init().catch(...)` that logs.
2. **Fetch timeout.** Add `REQUEST_TIMEOUT_MS: 15000` to CONFIG. In `api.js` use `AbortController`
   (or `AbortSignal.timeout`) and on timeout throw `new ApiError(0, "TIMEOUT", "Máy chủ phản hồi quá lâu")`.
   Network failures stay `NETWORK_ERROR`. Add a `TIMEOUT` case to `errorMessage` in `ui.js`
   (`"Máy chủ phản hồi quá lâu. Vui lòng thử lại."`) — ui.js is allowed for this one line.
3. **Chart not destroyed on loading/error.** Export `destroyHourlyChart()` from hourly-chart.js; call it
   in main.js before setting `#hourly` to loading or error.
4. **aria-label not applied.** daily-list.js passes `"aria-label"` to `el()` (Object.assign → expando
   property). Use `ariaLabel` (as hourly-chart.js already does).
5. **Rain bar colour.** `color-mix(...)` is passed to Chart.js. Replace with a CSS token
   `--chart-rain: rgb(31 95 191 / 28%)` (= `--primary` #1f5fbf at 28%) defined in forecast.css under
   `:root`, read via `getComputedStyle` like the other tokens.
6. **Mock mode paints wrong marker.** Mock `current.json` is always location 1. In mock mode, do not
   call `mapView.setMarkerAqi(...)` from the current-card path (markers come from current-all.json).

Acceptance: `node --check` passes on every changed file; manual/Playwright check in Task 7.

---

## Task 3: Feature — AQI health advice

Files: new `frontend/js/health.js`, new `frontend/tests/health.test.mjs`,
`frontend/js/components/current-card.js`, `frontend/css/style.css`.

- `health.js` exports `healthAdvice(category)` → `{ general: string, sensitive: string } | null`
  (null for unknown/missing category). Pure, no imports. Text (US EPA guidance, Vietnamese):
  - good: general "Không khí trong lành, thoải mái hoạt động ngoài trời." / sensitive "Không cần biện pháp đặc biệt."
  - moderate: "Chất lượng không khí chấp nhận được." / "Người rất nhạy cảm nên hạn chế gắng sức lâu ngoài trời."
  - unhealthy_sensitive: "Người khỏe mạnh vẫn có thể hoạt động bình thường." / "Trẻ em, người già, người có bệnh hô hấp/tim mạch nên hạn chế ra ngoài lâu."
  - unhealthy: "Hạn chế hoạt động gắng sức ngoài trời, nên đeo khẩu trang khi ra ngoài." / "Nhóm nhạy cảm nên ở trong nhà."
  - very_unhealthy: "Tránh hoạt động ngoài trời, đóng cửa sổ, đeo khẩu trang N95 nếu phải ra ngoài." / "Nhóm nhạy cảm cần ở trong nhà, cân nhắc dùng máy lọc không khí."
  - hazardous: "Cảnh báo khẩn cấp: mọi người nên ở trong nhà." / "Nhóm nhạy cảm tuyệt đối không ra ngoài."
- current-card renders, below the stats `dl`, a block `.advice.aqi-advice--<category>` with a heading
  "Lời khuyên sức khỏe" and the two lines (labelled "Mọi người:" and "Nhóm nhạy cảm:"). Not rendered
  when advice is null. Styling: subtle left border in the AQI colour (use existing `--aqi-*` tokens).
- Tests: every category in `AQI_LEVELS` keys has advice; unknown → null.

---

## Task 4: Feature — rain alert for the next 12 hours

Files: new `frontend/js/rain-alert.js`, new `frontend/tests/rain-alert.test.mjs`,
`frontend/js/main.js`, `frontend/js/components/hourly-chart.js` (or a new small component), `frontend/css/forecast.css`.

- `rain-alert.js` exports `rainAlert(hourly, { windowHours = 12, threshold = 60 } = {})` → pure:
  looks at the first `windowHours` points; returns the first point where
  `precipitation_probability_pct >= threshold` OR `weather_code` is in rain/thunder codes
  (51–67, 80–82, 95–99) as `{ level: "rain" | "storm", time, probability }` (`storm` when code 95–99);
  returns `{ level: "none" }` if none; returns `null` when `hourly` is empty/not an array.
- Rendered as a one-line banner at the top of the `#hourly` panel, above the chart:
  rain → "☔ Có khả năng mưa lúc HH:mm (xx%)"; storm → "⛈ Có dông lúc HH:mm"; none →
  "Không có mưa đáng kể trong 12 giờ tới". Time formatted with `fmt.time` (pass a formatter in;
  rain-alert.js must not import format.js/config.js). Probability null → omit "(xx%)".
- Tests: threshold boundary (59 vs 60), weather-code trigger with null probability, storm level,
  window limit (event at hour 13 ignored), empty input.

---

## Task 5: Feature — remember selected location

Files: `frontend/js/main.js`, new `frontend/js/location-memory.js`, new `frontend/tests/location-memory.test.mjs`.

- `location-memory.js` exports pure `pickInitialLocation(locations, { urlCity, storedId })`:
  priority URL `?city=<id>` → stored id → `locations[0].id`; ignores ids not present in `locations`
  or non-numeric values. Plus thin wrappers `readStoredId()` / `storeId(id)` around
  `localStorage` key `"weather.locationId"` wrapped in try/catch (storage may be unavailable).
- main.js: on init use `pickInitialLocation`; on every `selectLocation` store the id and update the URL
  with `history.replaceState`, setting `city=<id>` and preserving all other query params (e.g. `mock=1`).
- Tests cover the priority order and invalid values.

---

## Task 6: Frontend — skeleton loading, retry button, Vietnamese errors

Files: `frontend/js/ui.js`, `frontend/js/main.js`, `frontend/css/style.css`, new `frontend/tests/ui-errors.test.mjs`
(if `errorMessage` is moved into a pure module, e.g. `frontend/js/errors.js`, re-export it from ui.js).

- `setState(container, "loading")` renders skeleton bars (2–3 `.skeleton` divs) plus a visually-hidden
  "Đang tải…" text for screen readers; shimmer animation disabled under `prefers-reduced-motion`.
- `setState(container, "error", message, { onRetry })`: when `onRetry` is given, append a button
  "Thử lại" that calls it. main.js passes retry callbacks: current/forecast panels → re-run
  `selectLocation(selectedLocationId)`; the init failure → re-run `init()`.
- `errorMessage`: map every error code that `app/errors.py` can emit, plus `NETWORK_ERROR`, `TIMEOUT`,
  `HTTP_ERROR`, to Vietnamese text. The default branch returns a generic Vietnamese message
  ("Đã xảy ra lỗi. Vui lòng thử lại.") — never the raw `error.message` (it can be English backend text
  or a JS TypeError).
- Tests: each known code maps to a non-empty Vietnamese string; unknown code and a plain `TypeError`
  return the generic message.

---

## Task 7: Validation (controller, Playwright MCP)

Not dispatched to an implementer. Controller runs the app and validates with the Playwright MCP:
mock mode (`?mock=1`) and live backend, desktop 1280px and mobile 390px; error paths via route
interception (500, malformed 200 body, timeout); `?city=` deep link and reload persistence; console
free of errors. Findings go back through a fix dispatch.
