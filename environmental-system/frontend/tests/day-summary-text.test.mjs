import { test } from "node:test";
import assert from "node:assert/strict";
import { feelsLikeText, humidityWindText, peakAqi, summaryText, temperatureExtremes } from "../js/day-summary-text.js";

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

test("temperatureExtremes can use another field (feels like)", () => {
    const points = [{ time: "a", apparent_temperature_c: 30 }, { time: "b", apparent_temperature_c: 35 }, { time: "c", apparent_temperature_c: null }];
    const { highPoint, lowPoint } = temperatureExtremes(points, "apparent_temperature_c");
    assert.equal(highPoint.time, "b");
    assert.equal(lowPoint.time, "a");
});

test("humidityWindText gives the range, and omits parts without data", () => {
    const points = [{ relative_humidity_pct: 62.2, wind_speed_kmh: 8 }, { relative_humidity_pct: 88, wind_speed_kmh: 17.6 }, {}];
    assert.equal(humidityWindText(points), "Humidity 62–88% · Wind up to 18 km/h");
    assert.equal(humidityWindText([{ relative_humidity_pct: 70 }]), "Humidity 70%");
    assert.equal(humidityWindText([{ wind_speed_kmh: 5 }]), "Wind up to 5 km/h");
    assert.equal(humidityWindText([{}]), "");
    assert.equal(humidityWindText(undefined), "");
});

test("feelsLikeText gives the feels-like high and low, or an empty string", () => {
    const at = (hour, apparent_temperature_c) => ({ time: `2026-11-05T${String(hour).padStart(2, "0")}:00:00Z`, apparent_temperature_c });
    assert.equal(feelsLikeText([at(4, 27.2), at(13, 35.6), at(14, null)], formatTime),
        "Feels like up to 36° around 13:00, down to 27° around 04:00.");
    assert.equal(feelsLikeText([at(4, null)], formatTime), "");
    assert.equal(feelsLikeText([], formatTime), "");
    assert.equal(feelsLikeText(undefined, formatTime), "");
});
