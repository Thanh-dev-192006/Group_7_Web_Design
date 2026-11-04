// Entry point of forecast.html: loads one location's 7-day forecast and shows one day at a time.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { renderDayBar } from "./components/day-bar.js";
import { createDayCharts } from "./components/day-charts.js";
import { layoutHourIcons } from "./components/hour-icons.js";
import { buildDayView } from "./components/day-view.js";
import { buildDays, partialDayNote, pickDayIndex } from "./day-detail.js";
import { fmt } from "./format.js";
import { readStoredId } from "./location-memory.js";
import { pageUrl } from "./page-links.js";
import { errorMessage, setState } from "./ui.js";

const DETAIL_HOURS = 168;   // 7 days of hourly data

const $ = (selector) => document.querySelector(selector);
const views = {
    back: $("#back-link"),
    title: $("#page-title"),
    nav: $("#day-nav"),
    caption: $("#day-caption"),
    content: $("#fp-content"),
};

const params = new URLSearchParams(window.location.search);
const rawCity = /^\d+$/.test(params.get("city") ?? "") ? params.get("city") : readStoredId();
const cityId = /^\d+$/.test(rawCity ?? "") ? Number(rawCity) : null;
const charts = createDayCharts();
let days = [];

views.back.href = pageUrl("index.html", { city: cityId, mock: CONFIG.USE_MOCK });

function rememberDay(date) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set("day", date);
        history.replaceState(null, "", url);
    } catch {
        // Sandboxed/opaque origin: replaceState throws SecurityError; ignore.
    }
}

function showFailure(message, { retry = true } = {}) {
    charts.destroy();
    views.nav.replaceChildren();
    views.caption.textContent = "";
    setState(views.content, "error", message, retry ? { onRetry: () => void load() } : {});
}

function showDay(index) {
    const day = days[index];
    rememberDay(day.date);
    views.caption.textContent = `${fmt.longDate(day.date)}${partialDayNote(day, index)}`;
    charts.destroy();
    try {
        const view = buildDayView(day, index, {
            tempMode: charts.temperatureMode(),
            onTempMode: (mode) => charts.setTemperatureMode(mode),
        });
        view.root.setAttribute("aria-labelledby", `day-tab-${index}`);
        setState(views.content, "ready");
        views.content.append(view.root);
        charts.render(view.canvases, day.points, {
            onTemperatureLayout: (chart) => layoutHourIcons(view.iconList, chart),
        });
    } catch (error) {
        console.error("Failed to display the day.", error);
        charts.destroy();
        setState(views.content, "error", "Could not display this day.");
    }
}

async function load() {
    setState(views.content, "loading");
    if (cityId == null) return showFailure("Location not found.", { retry: false });

    let location;
    let forecast;
    try {
        const locations = (await api.getLocations()).data;
        location = Array.isArray(locations) ? locations.find((loc) => loc.id === cityId) : null;
        if (!location) return showFailure("Location not found.", { retry: false });
        forecast = (await api.getForecast(cityId, { hours: DETAIL_HOURS, days: CONFIG.FORECAST_DAYS })).data;
    } catch (error) {
        return showFailure(errorMessage(error));
    }

    views.title.textContent = location.name;
    document.title = `${location.name} · 7-day forecast`;
    days = buildDays(forecast?.hourly, forecast?.daily, CONFIG.TIMEZONE, CONFIG.FORECAST_DAYS);
    if (!days.length) {
        views.nav.replaceChildren();
        views.caption.textContent = "";
        return setState(views.content, "empty", "No forecast data");
    }
    const selected = pickDayIndex(days, params.get("day"));
    renderDayBar(views.nav, days, { selected, onSelect: showDay });
    showDay(selected);
}

load().catch((error) => {
    console.error("Failed to load the forecast page.", error);
    showFailure(errorMessage(error));
});
