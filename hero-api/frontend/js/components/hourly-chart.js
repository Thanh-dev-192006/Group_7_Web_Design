// Biểu đồ 48 giờ (Chart.js) — TODO (frontend).
//
// Yêu cầu (claude/project-context.md mục 8):
// - Trục X: giờ theo giờ VN (fmt.time(point.time)).
// - Đường nhiệt độ (temperature_c) + cột xác suất mưa (precipitation_probability_pct, trục Y thứ 2).
// - null giữ nguyên là null để Chart.js tạo khoảng trống (KHÔNG đổi thành 0).
// - Gọi lại hàm này khi đổi địa điểm → nhớ destroy chart cũ.
// - Nếu Chart chưa tải được: setState(container, "error", "...").
import { fmt } from "../format.js";
import { setState } from "../ui.js";

let chart = null;

export function renderHourly(container, hourly) {
    chart?.destroy();
    chart = null;

    if (!hourly.length) {
        setState(container, "empty", "Không có dữ liệu dự báo theo giờ");
        return;
    }

    // Placeholder tạm thời — thay bằng <canvas> + new Chart(...)
    setState(container, "empty",
        `[TODO] ${hourly.length} điểm dữ liệu, từ ${fmt.dateTime(hourly[0].time)} đến ${fmt.dateTime(hourly.at(-1).time)}`);
}
