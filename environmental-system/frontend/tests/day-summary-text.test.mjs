import { test } from "node:test";
import assert from "node:assert/strict";
import { peakAqi, summaryText, temperatureExtremes } from "../js/day-summary-text.js";

const formatTime = (iso) => iso.slice(11, 16);
const point = (hour, temperature_c) => ({ time: `2026-11-05T${String(hour).padStart(2, "0")}:00:00Z`, temperature_c });
const summary = (over = {}) => ({ high: 31, low: 23, rainChanceMax: 88, precipitationTotal: 4, ...over });

test("temperatureExtremes finds the hourly high and low, skipping nulls", () => {
    const { highPoint, lowPoint } = temperatureExtremes([point(1, 24), point(2, null), point(3, 30), point(4, 22)]);
    assert.equal(highPoint.time.slice(11, 13), "03");
    assert.equal(lowPoint.time.slice(11, 13), "04");
    assert.deepEqual(temperatureExtremes([]), { highPoint: null, lowPoint: null });
});

test("normal day", () => {
    const day = { points: [point(4, 23), point(13, 31)], summary: summary() };
    assert.equal(summaryText(day, formatTime),
        "Low of 23° around 04:00 and high of 31° around 13:00. Chance of rain up to 88%, total 4.0 mm.");
});

test("time is shown when the hourly extreme rounds to the shown number", () => {
    const day = { points: [point(4, 22.6), point(13, 30.8)], summary: summary({ high: 31, low: 23 }) };
    assert.match(summaryText(day, formatTime), /^Low of 23° around 04:00 and high of 31° around 13:00\./);
});

test("time is omitted when the daily value is more extreme than every hourly point (partial day)", () => {
    const day = { points: [point(8, 29), point(15, 31)], summary: summary({ high: 33, low: 24 }) };
    assert.match(summaryText(day, formatTime), /^Low of 24° and high of 33°\./);
});

test("plateau: the earliest hour wins for both high and low", () => {
    const points = [point(3, 22), point(4, 22), point(12, 31), point(13, 31)];
    const { highPoint, lowPoint } = temperatureExtremes(points);
    assert.equal(highPoint.time.slice(11, 13), "12");
    assert.equal(lowPoint.time.slice(11, 13), "03");
    assert.match(summaryText({ points, summary: summary({ low: 22 }) }, formatTime), /^Low of 22° around 03:00 and high of 31° around 12:00./);
});

test("peakAqi returns the earliest highest hour, or null", () => {
    const aqi = (hour, us_aqi) => ({ time: `2026-11-05T${String(hour).padStart(2, "0")}:00:00Z`, us_aqi });
    assert.equal(peakAqi([aqi(1, 50), aqi(2, null), aqi(3, 90), aqi(4, 90)]).time.slice(11, 13), "03");
    assert.equal(peakAqi([aqi(1, null)]), null);
    assert.equal(peakAqi([]), null);
    assert.equal(peakAqi(undefined), null);
});

test("null parts are omitted", () => {
    const noTemp = { points: [], summary: summary({ high: null, low: null }) };
    assert.equal(summaryText(noTemp, formatTime), "Chance of rain up to 88%, total 4.0 mm.");
    const onlyLow = { points: [point(4, 23)], summary: summary({ high: null, rainChanceMax: null }) };
    assert.equal(summaryText(onlyLow, formatTime), "Low of 23° around 04:00. Total precipitation 4.0 mm.");
    const noRain = { points: [], summary: summary({ rainChanceMax: null, precipitationTotal: null, low: null }) };
    assert.equal(summaryText(noRain, formatTime), "High of 31°.");
});

test("empty input gives an empty string", () => {
    assert.equal(summaryText(null, formatTime), "");
    assert.equal(summaryText({ points: [], summary: summary({ high: null, low: null, rainChanceMax: null, precipitationTotal: null }) }, formatTime), "");
    assert.equal(summaryText({ points: [] }, formatTime), "");
});
