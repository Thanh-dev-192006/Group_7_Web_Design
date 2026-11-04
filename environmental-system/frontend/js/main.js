// Frontend entry point: loads the locations and wires the components together.
// Rendering logic lives in js/components/*; this file only orchestrates.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { renderCurrent } from "./components/current-card.js";
import { closeDaySheet, openDaySheet } from "./components/day-sheet.js";
import { renderDaily } from "./components/daily-list.js";
import { destroyHourlyChart, renderHourly } from "./components/hourly-chart.js";
import { renderLocationPicker } from "./components/location-picker.js";
import { createMap } from "./components/map.js";
import { fmt } from "./format.js";
import { pickInitialLocation, readStoredId, storeId } from "./location-memory.js";
import { errorMessage, setState } from "./ui.js";

const $ = (selector) => document.querySelector(selector);
const views = {
    select: $("#location-select"),
    map: $("#map"),
    current: $("#current"),
    hourly: $("#hourly"),
    daily: $("#daily"),
    updatedAt: $("#updated-at"),
};

const INVALID_DATA_MESSAGE = "The data returned was invalid";

// "Retry" handlers: reload the selected location / rerun init.
const retrySelected = { onRetry: () => void selectLocation(selectedLocationId) };
const retryInit = {
    onRetry: () => {
        // Reset error state (including the "map" class on #map) before init recreates the map.
        for (const view of [views.current, views.hourly, views.daily, views.map]) setState(view, "loading");
        void init().catch((error) => console.error("Initialisation failed.", error));
    },
};

let mapView = null;
let requestSeq = 0;   // ignore stale responses when the user switches location quickly
let selectedLocationId = null;
let locationsById = new Map();
let latestForecast = null;   // { hourly, daily } of the selected location, used by the day sheet
let currentRefreshPending = false;
let markersRefreshPending = false;

async function refreshMarkers() {
    if (markersRefreshPending) return;
    markersRefreshPending = true;
    try {
        const response = await api.getCurrentAll();
        mapView?.setAllMarkers(response.data);
    } catch (error) {
        console.warn("Could not refresh AQI colours on the map.", error);
    } finally {
        markersRefreshPending = false;
    }
}

async function refreshCurrent() {
    if (currentRefreshPending || selectedLocationId == null) return;
    const locationId = selectedLocationId;
    const seq = requestSeq;
    currentRefreshPending = true;
    try {
        const response = await api.getCurrent(locationId);
        if (seq !== requestSeq) return;
        try {
            renderCurrent(views.current, response.data);
            // Mock current.json is always location 1: don't use it to colour markers.
            if (!CONFIG.USE_MOCK) mapView?.setMarkerAqi(locationId, response.data.aqi_category);
            views.updatedAt.textContent = `Updated at ${fmt.dateTime(response.meta.generated_at)}`;
        } catch (renderError) {
            console.error("Failed to render current weather.", renderError);
            setState(views.current, "error", INVALID_DATA_MESSAGE, retrySelected);
        }
    } catch (error) {
        console.warn("Could not refresh current weather.", error);
    } finally {
        currentRefreshPending = false;
    }
}

// Saves the id to localStorage and writes ?city=<id> to the URL (other params such as mock=1 are kept).
function rememberLocation(locationId) {
    storeId(locationId);
    try {
        const url = new URL(window.location.href);
        url.searchParams.set("city", String(locationId));
        history.replaceState(null, "", url);
    } catch {
        // Sandboxed/opaque origin: replaceState throws SecurityError; ignore (same as storeId).
    }
}

function openDay(day, trigger) {
    if (!latestForecast) return;
    openDaySheet({
        locationName: locationsById.get(selectedLocationId)?.name,
        daily: latestForecast.daily,
        hourly: latestForecast.hourly,
        date: day.date,
        trigger,
    });
}

async function selectLocation(locationId) {
    const seq = ++requestSeq;
    selectedLocationId = locationId;
    rememberLocation(locationId);
    views.updatedAt.textContent = CONFIG.USE_MOCK ? "Mock data mode" : "";
    views.select.value = String(locationId);
    mapView?.select(locationId);
    destroyHourlyChart();
    closeDaySheet();   // simplest correct option: a sheet for the previous location must not stay open
    latestForecast = null;
    for (const view of [views.current, views.hourly, views.daily]) setState(view, "loading");

    // Two independent requests: one failing must not break the other.
    const [current, forecast] = await Promise.allSettled([
        api.getCurrent(locationId),
        api.getForecast(locationId),
    ]);
    if (seq !== requestSeq) return;

    if (current.status === "fulfilled") {
        try {
            renderCurrent(views.current, current.value.data);
            // Mock current.json is always location 1: markers come from current-all.json.
            if (!CONFIG.USE_MOCK) mapView?.setMarkerAqi(locationId, current.value.data.aqi_category);
            views.updatedAt.textContent = `Updated at ${fmt.dateTime(current.value.meta.generated_at)}`;
        } catch (renderError) {
            console.error("Failed to render current weather.", renderError);
            setState(views.current, "error", INVALID_DATA_MESSAGE, retrySelected);
        }
    } else {
        setState(views.current, "error", errorMessage(current.reason), retrySelected);
    }

    if (forecast.status === "fulfilled") {
        try {
            const { hourly, daily } = forecast.value.data;
            latestForecast = { hourly, daily };
            renderHourly(views.hourly, Array.isArray(hourly) ? hourly.slice(0, CONFIG.CHART_HOURS) : hourly);
            renderDaily(views.daily, daily, { onSelect: openDay });
        } catch (renderError) {
            console.error("Failed to render forecast.", renderError);
            destroyHourlyChart();
            setState(views.hourly, "error", INVALID_DATA_MESSAGE, retrySelected);
            setState(views.daily, "error", INVALID_DATA_MESSAGE, retrySelected);
        }
    } else {
        const message = errorMessage(forecast.reason);
        destroyHourlyChart();
        setState(views.hourly, "error", message, retrySelected);
        setState(views.daily, "error", message, retrySelected);
    }
}

async function init() {
    if (CONFIG.USE_MOCK) views.updatedAt.textContent = "Mock data mode";

    let locations;
    try {
        locations = (await api.getLocations()).data;
        if (!Array.isArray(locations)) throw new TypeError("Invalid location list");
    } catch (error) {
        views.select.replaceChildren(new Option("Could not load locations"));
        for (const view of [views.current, views.hourly, views.daily, views.map]) {
            setState(view, "error", errorMessage(error), retryInit);
        }
        views.map.classList.add("map");
        return;
    }
    if (!locations.length) {
        views.select.replaceChildren(new Option("No locations yet"));
        for (const view of [views.current, views.hourly, views.daily, views.map]) {
            setState(view, "empty", "No locations yet");
        }
        views.map.classList.add("map");
        return;
    }

    locationsById = new Map(locations.map((loc) => [loc.id, loc]));
    const initialId = pickInitialLocation(locations, {
        urlCity: new URLSearchParams(window.location.search).get("city"),
        storedId: readStoredId(),
    });
    renderLocationPicker(views.select, locations, { selectedId: initialId, onChange: selectLocation });
    mapView = createMap(views.map, locations, { onSelect: selectLocation });
    void refreshMarkers();
    await selectLocation(initialId);
    setInterval(() => {
        if (document.hidden) return;
        void refreshCurrent();
        void refreshMarkers();
    }, CONFIG.REFRESH_MINUTES * 60 * 1000);
}

init().catch((error) => console.error("Initialisation failed.", error));
