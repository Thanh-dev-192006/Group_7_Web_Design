import { test } from "node:test";
import assert from "node:assert/strict";
import { healthAdvice } from "../js/health.js";
import { AQI_LEVELS } from "../js/aqi.js";

test("mọi mức AQI đều có lời khuyên cho cả hai nhóm", () => {
    for (const category of Object.keys(AQI_LEVELS)) {
        const advice = healthAdvice(category);
        assert.equal(typeof advice?.general, "string", category);
        assert.ok(advice.general.length > 0, category);
        assert.equal(typeof advice.sensitive, "string", category);
        assert.ok(advice.sensitive.length > 0, category);
    }
});

test("mức không xác định hoặc thiếu trả về null", () => {
    assert.equal(healthAdvice("unknown"), null);
    assert.equal(healthAdvice(undefined), null);
    assert.equal(healthAdvice(null), null);
    assert.equal(healthAdvice("toString"), null);
});

test("nội dung lời khuyên khớp hướng dẫn US EPA", () => {
    assert.deepEqual(healthAdvice("good"), {
        general: "Không khí trong lành, thoải mái hoạt động ngoài trời.",
        sensitive: "Không cần biện pháp đặc biệt.",
    });
    assert.deepEqual(healthAdvice("hazardous"), {
        general: "Cảnh báo khẩn cấp: mọi người nên ở trong nhà.",
        sensitive: "Nhóm nhạy cảm tuyệt đối không ra ngoài.",
    });
});
