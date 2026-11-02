import { test } from "node:test";
import assert from "node:assert/strict";
import { rainAlert, rainAlertText } from "../js/rain-alert.js";

const point = (hour, probability = 0, code = 0) => ({
    time: `2026-11-02T${String(hour % 24).padStart(2, "0")}:00:00Z`,
    precipitation_probability_pct: probability,
    weather_code: code,
});
const dry = (count) => Array.from({ length: count }, (_, i) => point(i));

test("probability threshold: 59 gives no alert, 60 alerts for rain", () => {
    assert.deepEqual(rainAlert([point(0, 59)]), { level: "none" });
    const alert = rainAlert([point(0, 59), point(1, 60)]);
    assert.deepEqual(alert, { level: "rain", time: "2026-11-02T01:00:00Z", probability: 60, byProbability: true });
});

test("rain weather code alerts even when probability is null", () => {
    const alert = rainAlert([point(0, null, 61)]);
    assert.equal(alert.level, "rain");
    assert.equal(alert.probability, null);
    assert.equal(alert.byProbability, false);
});

test("rainAlertText: shows % only when probability reached the trigger threshold", () => {
    const time = () => "14:00";
    const byCode = rainAlert([point(0, 15, 51)]);
    assert.equal(byCode.byProbability, false);
    assert.equal(rainAlertText(byCode, time), "☔ Rain likely at 14:00");
    const byProb = rainAlert([point(0, 60, 0)]);
    assert.equal(byProb.byProbability, true);
    assert.equal(rainAlertText(byProb, time), "☔ Rain likely at 14:00 (60%)");
});

test("thunderstorm codes 95-99 give level storm", () => {
    assert.equal(rainAlert([point(0, 10, 95)]).level, "storm");
    assert.equal(rainAlert([point(0, 10, 99)]).level, "storm");
});

test("only the first 12 hours are considered", () => {
    const hourly = [...dry(12), point(12, 90, 61)];
    assert.deepEqual(rainAlert(hourly), { level: "none" });
    const inside = [...dry(11), point(11, 90)];
    assert.equal(rainAlert(inside).level, "rain");
});

test("empty or non-array input returns null", () => {
    assert.equal(rainAlert([]), null);
    assert.equal(rainAlert(undefined), null);
    assert.equal(rainAlert(null), null);
});

test("rainAlertText: rain, storm, no rain, null probability", () => {
    const time = () => "14:00";
    assert.equal(rainAlertText({ level: "rain", time: "x", probability: 70, byProbability: true }, time), "☔ Rain likely at 14:00 (70%)");
    assert.equal(rainAlertText({ level: "rain", time: "x", probability: null }, time), "☔ Rain likely at 14:00");
    assert.equal(rainAlertText({ level: "storm", time: "x", probability: 10 }, time), "⛈ Thunderstorm expected at 14:00");
    assert.equal(rainAlertText({ level: "none" }, time), "No significant rain in the next 12 hours");
});
