// The only API layer in the frontend; components must not call fetch() directly.
// Contract: docs/API.md — success {data, meta}, failure {error: {code, message}}.
import { CONFIG } from "./config.js";

export class ApiError extends Error {
    constructor(status, code, message, details = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;   // HTTP status, 0 on network error
        this.code = code;       // e.g. "LOCATION_NOT_FOUND", "NOT_IMPLEMENTED"
        this.details = details;
    }
}

async function request(path, { mockFile } = {}) {
    const url = CONFIG.USE_MOCK && mockFile ? `mock/${mockFile}` : `${CONFIG.API_BASE}${path}`;

    // One timer covers the whole request, including reading the body.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, CONFIG.REQUEST_TIMEOUT_MS);
    const timeoutError = () => new ApiError(0, "TIMEOUT", "Server took too long to respond");

    let response;
    let body = null;
    try {
        try {
            response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
        } catch {
            throw timedOut ? timeoutError() : new ApiError(0, "NETWORK_ERROR", "Could not connect to the server");
        }

        try {
            body = await response.json();
        } catch {
            // body is not JSON (or the timeout hit while reading it)
            if (timedOut) throw timeoutError();
        }
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const err = body?.error ?? {};
        throw new ApiError(response.status, err.code ?? "HTTP_ERROR", err.message ?? response.statusText, err.details);
    }
    return body;   // { data, meta }
}

export const api = {
    getLocations: () => request("/api/locations", { mockFile: "locations.json" }),

    getCurrent: (locationId) =>
        request(`/api/locations/${locationId}/current`, { mockFile: "current.json" }),

    // Weather + AQI summary for ALL locations (colours the map markers). Backend: GET /api/current.
    getCurrentAll: () => request("/api/current", { mockFile: "current-all.json" }),

    getForecast: (locationId, { hours = CONFIG.FORECAST_HOURS, days = CONFIG.FORECAST_DAYS } = {}) =>
        request(`/api/locations/${locationId}/forecast?hours=${hours}&days=${days}`, { mockFile: "forecast.json" }),
};
