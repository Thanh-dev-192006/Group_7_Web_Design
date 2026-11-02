// Health advice per aqi_category (US EPA guidance).
// Keys match AQI_LEVELS in js/aqi.js. Pure logic, no imports.
const ADVICE = {
    good: {
        general: "Air quality is good. Enjoy outdoor activities.",
        sensitive: "No special precautions needed.",
    },
    moderate: {
        general: "Air quality is acceptable.",
        sensitive: "Unusually sensitive people should limit prolonged outdoor exertion.",
    },
    unhealthy_sensitive: {
        general: "Healthy people can carry on as normal.",
        sensitive: "Children, older adults and people with respiratory or heart conditions should limit time outdoors.",
    },
    unhealthy: {
        general: "Limit strenuous outdoor activity and wear a mask when going out.",
        sensitive: "Sensitive groups should stay indoors.",
    },
    very_unhealthy: {
        general: "Avoid outdoor activity, keep windows closed, and wear an N95 mask if you must go out.",
        sensitive: "Sensitive groups should stay indoors and consider using an air purifier.",
    },
    hazardous: {
        general: "Emergency conditions: everyone should stay indoors.",
        sensitive: "Sensitive groups must not go outside.",
    },
};

/** Returns { general, sensitive } for an AQI level, or null if the level is unknown or missing. */
export function healthAdvice(category) {
    return Object.hasOwn(ADVICE, category) ? { ...ADVICE[category] } : null;
}
