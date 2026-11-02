// Shared display formatting. All API times are UTC (ISO, with "Z").
import { CONFIG } from "./config.js";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

export const fmt = {
    time: (iso) => timeFmt.format(new Date(iso)),
    dateTime: (iso) => dateTimeFmt.format(new Date(iso)),
    // daily `date` is "YYYY-MM-DD" (no time), so format in UTC to avoid a day shift
    weekday: (isoDate) => weekdayFmt.format(new Date(`${isoDate}T00:00:00Z`)),
    /** Number → string with unit; null → "—" (null is never shown as 0) */
    num: (value, unit = "", digits = 0) => (value == null ? "—" : `${Number(value).toFixed(digits)}${unit}`),
};

// WMO weather code → description (https://open-meteo.com/en/docs, "WMO Weather interpretation codes")
const WMO = {
    0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
    80: "Light showers", 81: "Showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

export function weatherText(code) {
    return code == null ? "—" : (WMO[code] ?? `Code ${code}`);
}
