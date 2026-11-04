// Day-detail logic (pure, no DOM/config dependency): group hourly points by local date and summarise a day.
// Hourly times are UTC ISO strings; `timeZone` is passed in (CONFIG.TIMEZONE) so this stays testable.

const keyFormatters = new Map();

function keyFormatter(timeZone) {
    if (!keyFormatters.has(timeZone)) {
        keyFormatters.set(timeZone, new Intl.DateTimeFormat("en-CA", {
            timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        }));
    }
    return keyFormatters.get(timeZone);
}

/** UTC ISO time → "YYYY-MM-DD" in the given time zone. */
export function localDateKey(iso, timeZone) {
    const parts = Object.fromEntries(keyFormatter(timeZone).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Hourly points → Map("YYYY-MM-DD" → points[]), keeping input order. */
export function groupByLocalDate(hourly, timeZone) {
    const groups = new Map();
    if (!Array.isArray(hourly)) return groups;
    for (const point of hourly) {
        if (!point || Number.isNaN(new Date(point.time).getTime())) continue;
        const key = localDateKey(point.time, timeZone);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(point);
    }
    return groups;
}

const numbers = (points, field) => points
    .map((point) => point[field])
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map(Number);

/** Day summary from hourly points; a field with no valid values is null (never 0). */
export function summarizeDay(points) {
    const list = Array.isArray(points) ? points : [];
    const temps = numbers(list, "temperature_c");
    const chances = numbers(list, "precipitation_probability_pct");
    const rain = numbers(list, "precipitation_mm");
    return {
        high: temps.length ? Math.max(...temps) : null,
        low: temps.length ? Math.min(...temps) : null,
        rainChanceMax: chances.length ? Math.max(...chances) : null,
        precipitationTotal: rain.length ? rain.reduce((sum, value) => sum + value, 0) : null,
    };
}

const hourFormatters = new Map();

/** Local hour (0-23) of a UTC ISO time in the given time zone. */
export function localHour(iso, timeZone) {
    if (!hourFormatters.has(timeZone)) {
        hourFormatters.set(timeZone, new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }));
    }
    return Number(hourFormatters.get(timeZone).format(new Date(iso)));
}

// Most severe code of the day = highest WMO code (Open-Meteo's daily convention); falls back to the daily entry.
function dayWeatherCode(points, dailyEntry) {
    const codes = numbers(points, "weather_code");
    if (codes.length) return Math.max(...codes);
    return dailyEntry?.weather_code ?? null;
}

/**
 * Up to `maxDays` local days (in order, empty days skipped):
 * { date, points, summary, weatherCode, startHour } where startHour is the local hour of the first point.
 */
export function buildDays(hourly, daily, timeZone, maxDays = 7) {
    const dailyByDate = new Map((Array.isArray(daily) ? daily : []).map((entry) => [entry.date, entry]));
    return [...groupByLocalDate(hourly, timeZone)]
        .filter(([, points]) => points.length > 0)
        .slice(0, maxDays)
        .map(([date, points]) => ({
            date,
            points,
            summary: summarizeDay(points),
            weatherCode: dayWeatherCode(points, dailyByDate.get(date)),
            startHour: localHour(points[0].time, timeZone),
        }));
}

/** Index of the day with `date`, else 0. */
export function pickDayIndex(days, date) {
    return Math.max(0, days.findIndex((day) => day.date === date));
}
