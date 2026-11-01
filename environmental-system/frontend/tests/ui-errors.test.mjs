import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage } from "../js/errors.js";

const GENERIC = "Đã xảy ra lỗi. Vui lòng thử lại.";
const KNOWN_CODES = [
    "NETWORK_ERROR", "TIMEOUT", "HTTP_ERROR",
    "NOT_IMPLEMENTED", "UPSTREAM_UNAVAILABLE", "UPSTREAM_ERROR", "LOCATION_NOT_FOUND",
    "INTERNAL_ERROR", "VALIDATION_ERROR",
    "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "METHOD_NOT_ALLOWED",
];

test("mỗi mã lỗi đã biết trả về câu tiếng Việt không rỗng, khác raw message", () => {
    for (const code of KNOWN_CODES) {
        const text = errorMessage({ code, message: "English backend text" });
        assert.ok(text.length > 0, code);
        assert.notEqual(text, "English backend text", code);
    }
});

test("mã lạ trả về câu chung, không lộ error.message", () => {
    assert.equal(errorMessage({ code: "SOMETHING_NEW", message: "Internal server error" }), GENERIC);
});

test("TypeError thường trả về câu chung", () => {
    assert.equal(errorMessage(new TypeError("x is undefined")), GENERIC);
});

test("null/undefined trả về câu chung", () => {
    assert.equal(errorMessage(undefined), GENERIC);
    assert.equal(errorMessage(null), GENERIC);
});
