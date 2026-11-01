import test from "node:test";
import assert from "node:assert/strict";
import { pickInitialLocation } from "../js/location-memory.js";

const locations = [{ id: 1 }, { id: 2 }, { id: 7 }];

test("ưu tiên ?city trong URL", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: "7", storedId: "2" }), 7);
});

test("dùng id đã lưu khi URL không có city", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: null, storedId: "2" }), 2);
});

test("mặc định là địa điểm đầu tiên", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: null, storedId: null }), 1);
});

test("URL không hợp lệ thì rơi về id đã lưu", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: "abc", storedId: "2" }), 2);
    assert.equal(pickInitialLocation(locations, { urlCity: "99", storedId: "2" }), 2);
    assert.equal(pickInitialLocation(locations, { urlCity: "2.5", storedId: "7" }), 7);
    assert.equal(pickInitialLocation(locations, { urlCity: "", storedId: "7" }), 7);
});

test("cả hai không hợp lệ thì lấy địa điểm đầu tiên", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: "x", storedId: "99" }), 1);
    assert.equal(pickInitialLocation(locations, { urlCity: "1e0", storedId: "-3" }), 1);
});

test("danh sách rỗng trả về null", () => {
    assert.equal(pickInitialLocation([], { urlCity: "1", storedId: "1" }), null);
});
