import { test } from "node:test";
import assert from "node:assert/strict";
import { pageUrl } from "../js/page-links.js";

test("pageUrl builds city and day parameters", () => {
    assert.equal(pageUrl("forecast.html", { city: 3, day: "2026-11-05" }), "forecast.html?city=3&day=2026-11-05");
    assert.equal(pageUrl("forecast.html", { city: 3 }), "forecast.html?city=3");
    assert.equal(pageUrl("forecast.html"), "forecast.html");
});

test("pageUrl keeps mock=1 only when requested", () => {
    assert.equal(pageUrl("index.html", { city: 1, mock: true }), "index.html?city=1&mock=1");
    assert.equal(pageUrl("index.html", { city: 1, mock: false }), "index.html?city=1");
});
