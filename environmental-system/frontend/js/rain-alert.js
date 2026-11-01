// Cảnh báo mưa trong các giờ tới (logic thuần, không phụ thuộc DOM/config).
const isRainCode = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
const isStormCode = (code) => code >= 95 && code <= 99;

export function rainAlert(hourly, { windowHours = 12, threshold = 60 } = {}) {
    if (!Array.isArray(hourly) || hourly.length === 0) return null;

    for (const point of hourly.slice(0, windowHours)) {
        const probability = point.precipitation_probability_pct;
        const code = point.weather_code;
        const likely = probability != null && probability >= threshold;
        if (likely || isRainCode(code)) {
            return {
                level: isStormCode(code) ? "storm" : "rain",
                time: point.time,
                probability: probability ?? null,
            };
        }
    }
    return { level: "none" };
}

// Nội dung banner; formatTime nhận từ bên ngoài (fmt.time).
export function rainAlertText(alert, formatTime) {
    if (!alert) return "";
    if (alert.level === "storm") return `⛈ Có dông lúc ${formatTime(alert.time)}`;
    if (alert.level === "rain") {
        const chance = alert.probability != null ? ` (${Math.round(alert.probability)}%)` : "";
        return `☔ Có khả năng mưa lúc ${formatTime(alert.time)}${chance}`;
    }
    return "Không có mưa đáng kể trong 12 giờ tới";
}
