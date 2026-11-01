import { test } from "node:test";
import assert from "node:assert/strict";
import { rainAlert, rainAlertText } from "../js/rain-alert.js";

const point = (hour, probability = 0, code = 0) => ({
    time: `2026-11-02T${String(hour % 24).padStart(2, "0")}:00:00Z`,
    precipitation_probability_pct: probability,
    weather_code: code,
});
const dry = (count) => Array.from({ length: count }, (_, i) => point(i));

test("ngưỡng xác suất: 59 không báo, 60 báo mưa", () => {
    assert.deepEqual(rainAlert([point(0, 59)]), { level: "none" });
    const alert = rainAlert([point(0, 59), point(1, 60)]);
    assert.deepEqual(alert, { level: "rain", time: "2026-11-02T01:00:00Z", probability: 60, byProbability: true });
});

test("mã thời tiết mưa báo dù xác suất null", () => {
    const alert = rainAlert([point(0, null, 61)]);
    assert.equal(alert.level, "rain");
    assert.equal(alert.probability, null);
    assert.equal(alert.byProbability, false);
});

test("rainAlertText: chỉ hiện % khi xác suất đạt ngưỡng kích hoạt", () => {
    const time = () => "14:00";
    const byCode = rainAlert([point(0, 15, 51)]);
    assert.equal(byCode.byProbability, false);
    assert.equal(rainAlertText(byCode, time), "☔ Có khả năng mưa lúc 14:00");
    const byProb = rainAlert([point(0, 60, 0)]);
    assert.equal(byProb.byProbability, true);
    assert.equal(rainAlertText(byProb, time), "☔ Có khả năng mưa lúc 14:00 (60%)");
});

test("mã dông 95-99 cho level storm", () => {
    assert.equal(rainAlert([point(0, 10, 95)]).level, "storm");
    assert.equal(rainAlert([point(0, 10, 99)]).level, "storm");
});

test("chỉ xét trong cửa sổ 12 giờ đầu", () => {
    const hourly = [...dry(12), point(12, 90, 61)];
    assert.deepEqual(rainAlert(hourly), { level: "none" });
    const inside = [...dry(11), point(11, 90)];
    assert.equal(rainAlert(inside).level, "rain");
});

test("đầu vào rỗng hoặc không phải mảng trả về null", () => {
    assert.equal(rainAlert([]), null);
    assert.equal(rainAlert(undefined), null);
    assert.equal(rainAlert(null), null);
});

test("rainAlertText: mưa, dông, không mưa, xác suất null", () => {
    const time = () => "14:00";
    assert.equal(rainAlertText({ level: "rain", time: "x", probability: 70, byProbability: true }, time), "☔ Có khả năng mưa lúc 14:00 (70%)");
    assert.equal(rainAlertText({ level: "rain", time: "x", probability: null }, time), "☔ Có khả năng mưa lúc 14:00");
    assert.equal(rainAlertText({ level: "storm", time: "x", probability: 10 }, time), "⛈ Có dông lúc 14:00");
    assert.equal(rainAlertText({ level: "none" }, time), "Không có mưa đáng kể trong 12 giờ tới");
});
