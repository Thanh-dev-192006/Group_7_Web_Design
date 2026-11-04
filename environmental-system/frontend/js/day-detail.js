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

// Daily dates are local days, so the daily entry's code wins; otherwise the most severe (highest WMO) hourly code.
function dayWeatherCode(points, dailyEntry) {
    if (dailyEntry?.weather_code != null) return dailyEntry.weather_code;
    const codes = numbers(points, "weather_code");
    return codes.length ? Math.max(...codes) : null;
}

// Daily values come from finer data than the hourly samples, so they win per field when present.
function daySummary(points, dailyEntry) {
    const hourly = summarizeDay(points);
    const pick = (value, fallback) => (value != null && Number.isFinite(Number(value)) ? Number(value) : fallback);
    return {
        high: pick(dailyEntry?.temperature_max_c, hourly.high),
        low: pick(dailyEntry?.temperature_min_c, hourly.low),
        rainChanceMax: pick(dailyEntry?.precipitation_probability_max_pct, hourly.rainChanceMax),
        precipitationTotal: pick(dailyEntry?.precipitation_sum_mm, hourly.precipitationTotal),
    };
}

// Highest UV of the day: the daily entry if present, else the highest hourly value.
function dayUvMax(points, dailyEntry) {
    if (dailyEntry?.uv_index_max != null) return Number(dailyEntry.uv_index_max);
    const values = numbers(points, "uv_index");
    return values.length ? Math.max(...values) : null;
}

/**
 * Up to `maxDays` local days (in order, empty days skipped):
 * { date, points, summary, weatherCode, startHour, sunrise, sunset, uvMax } where summary prefers the daily entry, and startHour is the local hour of the first point.
 */
export function buildDays(hourly, daily, timeZone, maxDays = 7) {
    const dailyByDate = new Map((Array.isArray(daily) ? daily : []).map((entry) => [entry.date, entry]));
    return [...groupByLocalDate(hourly, timeZone)]
        .filter(([, points]) => points.length > 0)
        .slice(0, maxDays)
        .map(([date, points]) => ({
            date,
            points,
            summary: daySummary(points, dailyByDate.get(date)),
            weatherCode: dayWeatherCode(points, dailyByDate.get(date)),
            startHour: localHour(points[0].time, timeZone),
            sunrise: dailyByDate.get(date)?.sunrise ?? null,
            sunset: dailyByDate.get(date)?.sunset ?? null,
            uvMax: dayUvMax(points, dailyByDate.get(date)),
        }));
}

/** Index of the day with `date`, else 0. */
export function pickDayIndex(days, date) {
    return Math.max(0, days.findIndex((day) => day.date === date));
}

/** Daylight at `iso`: between the day's sunrise and sunset when both are known, else a 06:00-18:00 local rule. */
export function isDaylight(iso, sunrise, sunset, localHourOfDay) {
    const [time, rise, set] = [iso, sunrise, sunset].map((value) => (value ? new Date(value).getTime() : NaN));
    if (Number.isFinite(rise) && Number.isFinite(set)) return time >= rise && time < set;
    return localHourOfDay >= 6 && localHourOfDay < 18;
}

/** " · from HH:00" for a partial first day (the backend drops past hours), else "". */
export function partialDayNote(day, index) {
    return index === 0 && day.startHour > 0 ? ` · from ${String(day.startHour).padStart(2, "0")}:00` : "";
}
