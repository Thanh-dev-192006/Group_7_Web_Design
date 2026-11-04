// Frontend configuration.
// - Empty API_BASE = same origin (FastAPI serves the frontend). With Live Server (port 5500),
//   set "http://127.0.0.1:8000" and enable CORS_ORIGINS in the backend .env.
// - Mock mode: add ?mock=1 to the URL to use frontend/mock/*.json. Mock data is always for location id=1.
const params = new URLSearchParams(window.location.search);

export const CONFIG = {
    API_BASE: "",
    USE_MOCK: params.get("mock") === "1",
    FORECAST_HOURS: 168,            // 7 days of hourly data, for the day-detail sheet
    CHART_HOURS: 48,                // length of the "Next 48 hours" chart (first N of the hourly points)
    FORECAST_DAYS: 7,
    REFRESH_MINUTES: 10,            // refresh interval for the current card + marker colours
    REQUEST_TIMEOUT_MS: 25000,      // cold cache: backend calls 2 upstreams in sequence, each with a 10 s httpx timeout
    TIMEZONE: "Asia/Ho_Chi_Minh",   // API returns UTC; display in Vietnam time
};
