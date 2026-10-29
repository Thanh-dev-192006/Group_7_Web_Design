// Dải thẻ 7 ngày — TODO (frontend).
//
// Mỗi thẻ: thứ/ngày (fmt.weekday(day.date)), mô tả/icon (weatherText(day.weather_code)),
// max/min nhiệt độ, xác suất mưa. Responsive: cuộn ngang hoặc xuống dòng trên điện thoại.
// Viết theo mẫu current-card.js (el() + textContent).
import { setState } from "../ui.js";

export function renderDaily(container, daily) {
    if (!daily.length) {
        setState(container, "empty", "Không có dữ liệu dự báo theo ngày");
        return;
    }
    // Placeholder tạm thời
    setState(container, "empty", `[TODO] ${daily.length} ngày dự báo`);
}
