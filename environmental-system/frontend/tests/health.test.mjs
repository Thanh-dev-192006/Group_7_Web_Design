import { test } from "node:test";
import assert from "node:assert/strict";
import { healthAdvice } from "../js/health.js";
import { AQI_LEVELS } from "../js/aqi.js";

test("every AQI level has advice for both groups", () => {
    for (const category of Object.keys(AQI_LEVELS)) {
        const advice = healthAdvice(category);
        assert.equal(typeof advice?.general, "string", category);
        assert.ok(advice.general.length > 0, category);
        assert.equal(typeof advice.sensitive, "string", category);
        assert.ok(advice.sensitive.length > 0, category);
    }
});

test("unknown or missing level returns null", () => {
    assert.equal(healthAdvice("unknown"), null);
    assert.equal(healthAdvice(undefined), null);
    assert.equal(healthAdvice(null), null);
    assert.equal(healthAdvice("toString"), null);
});

test("advice text matches US EPA guidance", () => {
    assert.deepEqual(healthAdvice("good"), {
        general: "Air quality is good. Enjoy outdoor activities.",
        sensitive: "No special precautions needed.",
    });
    assert.deepEqual(healthAdvice("hazardous"), {
        general: "Emergency conditions: everyone should stay indoors.",
        sensitive: "Sensitive groups must not go outside.",
    });
});
