// Maps errors to user-facing English messages. Pure module (no imports) so Node can test it.
// Backend codes are defined in app/errors.py.

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const MESSAGES = {
    // Raised by the frontend (api.js)
    NETWORK_ERROR: "Could not connect to the server. Check that the backend is running.",
    TIMEOUT: "The server took too long to respond. Please try again.",
    HTTP_ERROR: "The server returned an unknown error. Please try again.",
    // Raised by the backend (app/errors.py)
    NOT_IMPLEMENTED: "This feature is not available yet (backend under development). Try ?mock=1.",
    UPSTREAM_UNAVAILABLE: "The weather data source is having problems. Please try again later.",
    UPSTREAM_ERROR: "The weather data source is having problems. Please try again later.",
    LOCATION_NOT_FOUND: "Location not found.",
    INTERNAL_ERROR: "Internal server error. Please try again later.",
    VALIDATION_ERROR: "Invalid request.",
    BAD_REQUEST: "Invalid request.",
    UNAUTHORIZED: "You are not authenticated.",
    FORBIDDEN: "You do not have permission to access this.",
    NOT_FOUND: "The requested data was not found.",
    METHOD_NOT_ALLOWED: "This request is not supported.",
};

/** Converts an ApiError to a user-facing message (never leaks the raw error.message). */
export function errorMessage(error) {
    const code = error?.code;
    return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}
