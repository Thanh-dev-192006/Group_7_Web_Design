import test from "node:test";
import assert from "node:assert/strict";
import { pickInitialLocation } from "../js/location-memory.js";

const locations = [{ id: 1 }, { id: 2 }, { id: 7 }];

test("?city in the URL takes priority", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: "7", storedId: "2" }), 7);
});

test("uses the stored id when the URL has no city", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: null, storedId: "2" }), 2);
});

test("defaults to the first location", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: null, storedId: null }), 1);
});

test("invalid URL value falls back to the stored id", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: "abc", storedId: "2" }), 2);
    assert.equal(pickInitialLocation(locations, { urlCity: "99", storedId: "2" }), 2);
    assert.equal(pickInitialLocation(locations, { urlCity: "2.5", storedId: "7" }), 7);
    assert.equal(pickInitialLocation(locations, { urlCity: "", storedId: "7" }), 7);
});

test("both invalid falls back to the first location", () => {
    assert.equal(pickInitialLocation(locations, { urlCity: "x", storedId: "99" }), 1);
    assert.equal(pickInitialLocation(locations, { urlCity: "1e0", storedId: "-3" }), 1);
});

test("empty list returns null", () => {
    assert.equal(pickInitialLocation([], { urlCity: "1", storedId: "1" }), null);
});
