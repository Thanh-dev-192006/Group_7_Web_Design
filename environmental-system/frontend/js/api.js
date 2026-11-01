// Lớp gọi API duy nhất của frontend. Component KHÔNG gọi fetch() trực tiếp.
// Hợp đồng: docs/API.md — thành công {data, meta}, lỗi {error: {code, message}}.
import { CONFIG } from "./config.js";

export class ApiError extends Error {
    constructor(status, code, message, details = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;   // HTTP status, 0 nếu lỗi mạng
        this.code = code;       // VD "LOCATION_NOT_FOUND", "NOT_IMPLEMENTED"
        this.details = details;
    }
}

async function request(path, { mockFile } = {}) {
    const url = CONFIG.USE_MOCK && mockFile ? `mock/${mockFile}` : `${CONFIG.API_BASE}${path}`;

    // Một timer cho cả request, gồm cả lúc đọc body.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, CONFIG.REQUEST_TIMEOUT_MS);
    const timeoutError = () => new ApiError(0, "TIMEOUT", "Máy chủ phản hồi quá lâu");

    let response;
    let body = null;
    try {
        try {
            response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
        } catch {
            throw timedOut ? timeoutError() : new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ");
        }

        try {
            body = await response.json();
        } catch {
            // body không phải JSON (hoặc quá thời gian khi đọc body)
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

    // Tóm tắt thời tiết + AQI của TẤT CẢ địa điểm (tô màu marker bản đồ). Backend: GET /api/current (issue B).
    getCurrentAll: () => request("/api/current", { mockFile: "current-all.json" }),

    getForecast: (locationId, { hours = CONFIG.FORECAST_HOURS, days = CONFIG.FORECAST_DAYS } = {}) =>
        request(`/api/locations/${locationId}/forecast?hours=${hours}&days=${days}`, { mockFile: "forecast.json" }),
};
