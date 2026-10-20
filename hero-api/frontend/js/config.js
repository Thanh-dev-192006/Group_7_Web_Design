// Cấu hình frontend.
// - API_BASE rỗng = gọi cùng origin (frontend do FastAPI phục vụ).
//   Nếu chạy frontend bằng Live Server (port 5500) thì đặt "http://127.0.0.1:8000"
//   và bật CORS_ORIGINS trong .env của backend.
// - Mock mode: thêm ?mock=1 vào URL để dùng frontend/mock/*.json (không cần backend
//   làm xong phần thời tiết). Dữ liệu mock luôn là của địa điểm id=1.
const params = new URLSearchParams(window.location.search);

export const CONFIG = {
    API_BASE: "",
    USE_MOCK: params.get("mock") === "1",
    FORECAST_HOURS: 48,
    FORECAST_DAYS: 7,
    TIMEZONE: "Asia/Ho_Chi_Minh",   // API trả UTC, hiển thị theo giờ VN
};
