// Labels + colours for aqi_category; the backend assigns the level, this only displays it.
// CSS colours live in css/style.css (--aqi-*); `color` here is for places that can't use CSS classes (Leaflet markers, Chart.js).
export const AQI_LEVELS = {
    good:                { label: "Good",                      color: "#00e400" },
    moderate:            { label: "Moderate",                  color: "#ffff00" },
    unhealthy_sensitive: { label: "Unhealthy for Sensitive Groups", color: "#ff7e00" },
    unhealthy:           { label: "Unhealthy",                 color: "#ff0000" },
    very_unhealthy:      { label: "Very Unhealthy",            color: "#8f3f97" },
    hazardous:           { label: "Hazardous",                 color: "#7e0023" },
};

const UNKNOWN = { label: "No data", color: "#b8c0cc" };

export function aqiInfo(category) {
    return AQI_LEVELS[category] ?? UNKNOWN;
}

/** Builds an AQI badge: <span class="aqi aqi--moderate">AQI 85 · Moderate</span> */
export function aqiBadge(usAqi, category) {
    const el = document.createElement("span");
    el.className = `aqi${category ? ` aqi--${category}` : ""}`;
    el.textContent = usAqi == null ? aqiInfo(null).label : `AQI ${Math.round(usAqi)} · ${aqiInfo(category).label}`;
    return el;
}
