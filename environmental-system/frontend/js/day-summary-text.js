// One-sentence summary of a day (pure; the time formatter is injected so Node can test it).

const isNumber = (value) => value != null && Number.isFinite(Number(value));

/** Hourly points holding the day's highest and lowest temperature (earliest hour on ties; null when no valid temperature). */
export function temperatureExtremes(points, field = "temperature_c") {
    let highPoint = null;
    let lowPoint = null;
    for (const point of Array.isArray(points) ? points : []) {
        if (!isNumber(point[field])) continue;
        const temp = Number(point[field]);
        if (highPoint === null || temp > Number(highPoint[field])) highPoint = point;
        if (lowPoint === null || temp < Number(lowPoint[field])) lowPoint = point;
    }
    return { highPoint, lowPoint };
}

/** Hourly point with the highest US AQI (earliest hour on ties), or null when no hour has a value. */
export function peakAqi(points) {
    let peak = null;
    for (const point of Array.isArray(points) ? points : []) {
        if (isNumber(point.us_aqi) && (peak === null || Number(point.us_aqi) > Number(peak.us_aqi))) peak = point;
    }
    return peak;
}

/** "Feels like up to 36° around 13:00, down to 27° around 04:00."; "" when no hour has a feels-like value. */
export function feelsLikeText(points, formatTime) {
    const { highPoint, lowPoint } = temperatureExtremes(points, "apparent_temperature_c");
    if (!highPoint) return "";
    const part = (prefix, point) => `${prefix} ${Math.round(Number(point.apparent_temperature_c))}° around ${formatTime(point.time)}`;
    return `Feels like ${part("up to", highPoint)}, ${part("down to", lowPoint)}.`;
}

const valuesOf = (points, field) => (Array.isArray(points) ? points : [])
    .map((point) => point[field]).filter(isNumber).map(Number);

/** "Humidity 62-88% · Wind up to 18 km/h"; parts without data are omitted, "" when there is none. */
export function humidityWindText(points) {
    const humidity = valuesOf(points, "relative_humidity_pct");
    const wind = valuesOf(points, "wind_speed_kmh");
    const parts = [];
    if (humidity.length) {
        const [min, max] = [Math.round(Math.min(...humidity)), Math.round(Math.max(...humidity))];
        parts.push(min === max ? `Humidity ${min}%` : `Humidity ${min}–${max}%`);
    }
    if (wind.length) parts.push(`Wind up to ${Math.round(Math.max(...wind))} km/h`);
    return parts.join(" · ");
}

// The time is only given when the hourly extreme agrees with the number shown (daily values can be more extreme).
function temperaturePart(label, value, point, formatTime) {
    if (!isNumber(value)) return null;
    const agrees = point != null && Math.round(Number(point.temperature_c)) === Math.round(Number(value));
    return `${label} of ${Math.round(value)}°${agrees ? ` around ${formatTime(point.time)}` : ""}`;
}

function rainPart(summary) {
    const chance = isNumber(summary.rainChanceMax) ? `Chance of rain up to ${Math.round(summary.rainChanceMax)}%` : null;
    const total = isNumber(summary.precipitationTotal) ? `${Number(summary.precipitationTotal).toFixed(1)} mm` : null;
    if (chance && total) return `${chance}, total ${total}.`;
    if (chance) return `${chance}.`;
    return total ? `Total precipitation ${total}.` : null;
}

/** "Low of 23° around 04:00 and high of 31° around 13:00. Chance of rain up to 88%, total 4.0 mm." */
export function summaryText(day, formatTime) {
    if (!day) return "";
    const { highPoint, lowPoint } = temperatureExtremes(day.points);
    const temps = [
        temperaturePart("Low", day.summary?.low, lowPoint, formatTime),
        temperaturePart("High", day.summary?.high, highPoint, formatTime),
    ].filter(Boolean);
    const tempSentence = temps.length ? `${temps.join(" and ").replace(/ and H/, " and h")}.` : null;
    return [tempSentence, rainPart(day.summary ?? {})].filter(Boolean).join(" ");
}
