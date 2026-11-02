import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage } from "../js/errors.js";

const GENERIC = "Something went wrong. Please try again.";
const KNOWN_CODES = [
    "NETWORK_ERROR", "TIMEOUT", "HTTP_ERROR",
    "NOT_IMPLEMENTED", "UPSTREAM_UNAVAILABLE", "UPSTREAM_ERROR", "LOCATION_NOT_FOUND",
    "INTERNAL_ERROR", "VALIDATION_ERROR",
    "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "METHOD_NOT_ALLOWED",
];

test("every known error code returns a non-empty message that differs from the raw message", () => {
    for (const code of KNOWN_CODES) {
        const text = errorMessage({ code, message: "English backend text" });
        assert.ok(text.length > 0, code);
        assert.notEqual(text, "English backend text", code);
    }
});

test("unknown code returns the generic message and does not leak error.message", () => {
    assert.equal(errorMessage({ code: "SOMETHING_NEW", message: "Internal server error" }), GENERIC);
});

test("plain TypeError returns the generic message", () => {
    assert.equal(errorMessage(new TypeError("x is undefined")), GENERIC);
});

test("null/undefined returns the generic message", () => {
    assert.equal(errorMessage(undefined), GENERIC);
    assert.equal(errorMessage(null), GENERIC);
});
