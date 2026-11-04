// WHO UV index categories (pure, Node-testable). UV is reported as integers, so values are rounded first.
const LEVELS = [
    { max: 2, key: "low", label: "Low", color: "#3ea72d" },
    { max: 5, key: "moderate", label: "Moderate", color: "#fff300" },
    { max: 7, key: "high", label: "High", color: "#f18b00" },
    { max: 10, key: "very_high", label: "Very high", color: "#e53210" },
    { max: Infinity, key: "extreme", label: "Extreme", color: "#b567a4" },
];

const isNumber = (value) => value != null && Number.isFinite(Number(value));

/** { key, label, color } for a UV value, or null when the value is missing. */
export function uvCategory(value) {
    if (!isNumber(value)) return null;
    const rounded = Math.round(Number(value));
    return LEVELS.find((level) => rounded <= level.max);
}

/** Hourly point with the highest UV index (earliest hour on ties), or null when no hour has a value. */
export function peakUv(points) {
    let peak = null;
    for (const point of Array.isArray(points) ? points : []) {
        if (isNumber(point.uv_index) && (peak === null || Number(point.uv_index) > Number(peak.uv_index))) peak = point;
    }
    return peak;
}
