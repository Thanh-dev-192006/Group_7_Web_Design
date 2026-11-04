import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDays, groupByLocalDate, isDaylight, localDateKey, partialDayNote, pickDayIndex, summarizeDay } from "../js/day-detail.js";

const TZ = "Asia/Ho_Chi_Minh";
const point = (time, temperature_c = null, chance = null, mm = null) => ({
    time, temperature_c, precipitation_probability_pct: chance, precipitation_mm: mm,
});

test("UTC evening belongs to the next local day (UTC+7)", () => {
    assert.equal(localDateKey("2026-11-05T16:59:00Z", TZ), "2026-11-05");
    assert.equal(localDateKey("2026-11-05T17:00:00Z", TZ), "2026-11-06");
});

test("groupByLocalDate splits across the UTC boundary and keeps order", () => {
    const groups = groupByLocalDate([
        point("2026-11-05T15:00:00Z"), point("2026-11-05T17:00:00Z"), point("2026-11-06T02:00:00Z"),
    ], TZ);
    assert.deepEqual([...groups.keys()], ["2026-11-05", "2026-11-06"]);
    assert.equal(groups.get("2026-11-05").length, 1);
    assert.equal(groups.get("2026-11-06").length, 2);
});

test("groupByLocalDate ignores invalid input", () => {
    assert.equal(groupByLocalDate(null, TZ).size, 0);
    assert.equal(groupByLocalDate([{ time: "nope" }, null], TZ).size, 0);
});

test("summarizeDay computes high/low, max chance and total precipitation", () => {
    const summary = summarizeDay([point("a", 25, 10, 0.5), point("b", 31, 70, 1.25), point("c", 22, 40, 0)]);
    assert.deepEqual(summary, { high: 31, low: 22, rainChanceMax: 70, precipitationTotal: 1.75 });
});

test("summarizeDay skips nulls and returns null (not 0) when nothing is valid", () => {
    assert.deepEqual(summarizeDay([point("a", null, 20, null), point("b", 28, null, 2)]),
        { high: 28, low: 28, rainChanceMax: 20, precipitationTotal: 2 });
    assert.deepEqual(summarizeDay([point("a")]),
        { high: null, low: null, rainChanceMax: null, precipitationTotal: null });
});

test("summarizeDay handles empty input", () => {
    const empty = { high: null, low: null, rainChanceMax: null, precipitationTotal: null };
    assert.deepEqual(summarizeDay([]), empty);
    assert.deepEqual(summarizeDay(undefined), empty);
});

const hours = (startIso, count, extra = () => ({})) => Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.parse(startIso) + i * 3600e3).toISOString(),
    temperature_c: 25, precipitation_probability_pct: 0, precipitation_mm: 0, weather_code: 0, ...extra(i),
}));

test("buildDays: 168 hours from 03:00 VN give 7 non-empty local days", () => {
    const days = buildDays(hours("2026-11-04T20:00:00Z", 168), [], TZ);
    assert.equal(days.length, 7);
    assert.ok(days.every((day) => day.points.length >= 1));
    assert.equal(days[0].date, "2026-11-05");
    assert.equal(days[0].startHour, 3);
    assert.equal(days[1].startHour, 0);
});

test("buildDays: weatherCode prefers the daily entry, else the max hourly code, else null", () => {
    const codes = [1, null, 61, 3];
    const points = hours("2026-11-04T17:00:00Z", 4, (i) => ({ weather_code: codes[i] }));
    const empty = hours("2026-11-05T17:00:00Z", 2, () => ({ weather_code: null }));
    const daily = [{ date: "2026-11-05", weather_code: 3 }, { date: "2026-11-06", weather_code: 45 }];
    const days = buildDays([...points, ...empty], daily, TZ);
    assert.equal(days[0].weatherCode, 3);
    assert.equal(buildDays(points, [], TZ)[0].weatherCode, 61);
    assert.equal(days[1].date, "2026-11-06");
    assert.equal(days[1].weatherCode, 45);
    assert.equal(buildDays(empty, [], TZ)[0].weatherCode, null);
});

test("buildDays: summary comes from the day's own points; empty input gives no days", () => {
    const days = buildDays(hours("2026-11-04T17:00:00Z", 2, (i) => ({ temperature_c: 20 + i })), null, TZ);
    assert.deepEqual(days[0].summary.high, 21);
    assert.deepEqual(buildDays([], [], TZ), []);
    assert.deepEqual(buildDays(undefined, undefined, TZ), []);
});

test("buildDays respects maxDays", () => {
    assert.equal(buildDays(hours("2026-11-04T17:00:00Z", 96), [], TZ, 2).length, 2);
});

test("pickDayIndex selects the matching date, else 0", () => {
    const days = [{ date: "2026-11-05" }, { date: "2026-11-06" }];
    assert.equal(pickDayIndex(days, "2026-11-06"), 1);
    assert.equal(pickDayIndex(days, "2026-12-01"), 0);
    assert.equal(pickDayIndex([], "2026-11-06"), 0);
});

test("buildDays: daily entry values win for the summary, each field falls back independently", () => {
    const points = hours("2026-11-04T17:00:00Z", 2, (i) => ({
        temperature_c: 22 + i * 6, precipitation_probability_pct: 10, precipitation_mm: 0.5,
    }));
    const full = { date: "2026-11-05", temperature_max_c: 29, temperature_min_c: 21, precipitation_probability_max_pct: 40, precipitation_sum_mm: 3.2 };
    assert.deepEqual(buildDays(points, [full], TZ)[0].summary,
        { high: 29, low: 21, rainChanceMax: 40, precipitationTotal: 3.2 });

    const partial = { date: "2026-11-05", temperature_max_c: null, temperature_min_c: 21, precipitation_probability_max_pct: null, precipitation_sum_mm: 0 };
    assert.deepEqual(buildDays(points, [partial], TZ)[0].summary,
        { high: 28, low: 21, rainChanceMax: 10, precipitationTotal: 0 });

    assert.deepEqual(buildDays(points, [], TZ)[0].summary,
        { high: 28, low: 22, rainChanceMax: 10, precipitationTotal: 1 });
});

test("partialDayNote only applies to a partial first day", () => {
    assert.equal(partialDayNote({ startHour: 13 }, 0), " · from 13:00");
    assert.equal(partialDayNote({ startHour: 9 }, 0), " · from 09:00");
    assert.equal(partialDayNote({ startHour: 0 }, 0), "");
    assert.equal(partialDayNote({ startHour: 13 }, 1), "");
});

test("buildDays carries sunrise, sunset and UV max (daily first, hourly fallback)", () => {
    const points = hours("2026-11-04T17:00:00Z", 2, (i) => ({ uv_index: [1.5, 6.2][i] }));
    const daily = [{ date: "2026-11-05", sunrise: "2026-11-04T22:58:00Z", sunset: "2026-11-05T10:12:00Z", uv_index_max: 8.1 }];
    const [day] = buildDays(points, daily, TZ);
    assert.deepEqual([day.sunrise, day.sunset, day.uvMax], ["2026-11-04T22:58:00Z", "2026-11-05T10:12:00Z", 8.1]);
    const [bare] = buildDays(points, [], TZ);
    assert.deepEqual([bare.sunrise, bare.sunset, bare.uvMax], [null, null, 6.2]);
    assert.equal(buildDays(hours("2026-11-04T17:00:00Z", 1), [], TZ)[0].uvMax, null);
});

test("isDaylight uses sunrise/sunset when known, else the 06-18 rule", () => {
    const rise = "2026-11-04T23:00:00Z";   // 06:00 local
    const set = "2026-11-05T10:19:00Z";    // 17:19 local
    assert.equal(isDaylight("2026-11-05T10:00:00Z", rise, set, 17), true);
    assert.equal(isDaylight("2026-11-05T10:30:00Z", rise, set, 17), false);
    assert.equal(isDaylight("2026-11-04T22:00:00Z", rise, set, 5), false);
    assert.equal(isDaylight("x", null, null, 17), true);
    assert.equal(isDaylight("x", null, set, 18), false);
    assert.equal(isDaylight("x", null, null, 3), false);
});
