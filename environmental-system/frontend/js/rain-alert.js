// Rain alert for the coming hours (pure logic, no DOM/config dependency).
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
                byProbability: likely,   // true only when probability reached the threshold, so the % is shown
            };
        }
    }
    return { level: "none" };
}

// Banner text; formatTime is injected (fmt.time).
export function rainAlertText(alert, formatTime) {
    if (!alert) return "";
    if (alert.level === "storm") return `⛈ Thunderstorm expected at ${formatTime(alert.time)}`;
    if (alert.level === "rain") {
        const chance = alert.byProbability && alert.probability != null ? ` (${Math.round(alert.probability)}%)` : "";
        return `☔ Rain likely at ${formatTime(alert.time)}${chance}`;
    }
    return "No significant rain in the next 12 hours";
}
