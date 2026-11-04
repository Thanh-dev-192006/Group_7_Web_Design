import { test } from "node:test";
import assert from "node:assert/strict";
import { peakUv, uvCategory } from "../js/uv-index.js";

test("uvCategory boundaries use the value rounded to an integer", () => {
    const key = (value) => uvCategory(value).key;
    assert.equal(key(0), "low");
    assert.equal(key(2.4), "low");
    assert.equal(key(2.9), "moderate");
    assert.equal(key(3), "moderate");
    assert.equal(key(5.4), "moderate");
    assert.equal(key(5.9), "high");
    assert.equal(key(7.4), "high");
    assert.equal(key(7.9), "very_high");
    assert.equal(key(10.4), "very_high");
    assert.equal(key(10.9), "extreme");
    assert.equal(key(14), "extreme");
});

test("uvCategory returns null for missing values and has labels and colours", () => {
    assert.equal(uvCategory(null), null);
    assert.equal(uvCategory(undefined), null);
    assert.equal(uvCategory("abc"), null);
    assert.equal(uvCategory(8).label, "Very high");
    assert.match(uvCategory(1).color, /^#[0-9a-f]{6}$/);
});

test("peakUv picks the earliest highest hour, or null", () => {
    const uv = (hour, uv_index) => ({ time: `2026-11-05T${String(hour).padStart(2, "0")}:00:00Z`, uv_index });
    assert.equal(peakUv([uv(1, 2), uv(2, null), uv(3, 9), uv(4, 9)]).time.slice(11, 13), "03");
    assert.equal(peakUv([uv(1, null)]), null);
    assert.equal(peakUv([]), null);
    assert.equal(peakUv(undefined), null);
});
