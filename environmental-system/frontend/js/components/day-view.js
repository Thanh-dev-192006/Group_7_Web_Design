// Cards for one selected day: summary, temperature, rain, humidity & wind, UV index, air quality.
import { fmt, weatherText } from "../format.js";
import { aqiInfo } from "../aqi.js";
import { partialDayNote } from "../day-detail.js";
import { feelsLikeText, humidityWindText, peakAqi, summaryText } from "../day-summary-text.js";
import { el } from "../ui.js";
import { peakUv, uvCategory } from "../uv-index.js";
import { weatherIcon } from "../weather-icons.js";
import { DAY_PANEL_ID } from "./day-bar.js";
import { hasFeelsLike } from "./day-charts.js";
import { renderHourIcons } from "./hour-icons.js";
import { renderTempToggle } from "./temp-toggle.js";

const card = (title, ...children) => el("section", { className: "panel fp-card" },
    el("h2", { className: "panel__title" }, title), ...children);

const chartBox = (label) => {
    const canvas = el("canvas", { role: "img", ariaLabel: label });
    return { canvas, box: el("div", { className: "chart" }, canvas) };
};

const unavailable = (title, message) => ({ node: card(title, el("p", { className: "state state--empty" }, message)) });

function stat(label, value) {
    return el("div", {}, el("dt", {}, label), el("dd", {}, value));
}

const timeOrDash = (iso) => (iso ? fmt.time(iso) : "—");

function uvMaxText(value) {
    const category = uvCategory(value);
    return category ? `${Math.round(value)} · ${category.label}` : "—";
}

// Day 0 only has the hours from now on, while the daily totals cover the whole day.
function partialNote(day, index) {
    if (!partialDayNote(day, index)) return null;
    const hour = String(day.startHour).padStart(2, "0");
    return el("p", { className: "fp-note" }, `Totals are for the whole day; charts start at ${hour}:00.`);
}

function summaryCard(day, index) {
    const { summary, weatherCode } = day;
    return card("Summary",
        el("div", { className: "fp-weather" },
            el("span", { className: "fp-weather__icon", ariaHidden: "true" }, weatherIcon(weatherCode)),
            el("span", { className: "fp-weather__desc" }, weatherText(weatherCode))),
        el("dl", { className: "stats" },
            stat("High", fmt.num(summary.high, "°C")),
            stat("Low", fmt.num(summary.low, "°C")),
            stat("Chance of rain", fmt.num(summary.rainChanceMax, "%")),
            stat("Precipitation", fmt.num(summary.precipitationTotal, " mm", 1)),
            stat("Sunrise", timeOrDash(day.sunrise)),
            stat("Sunset", timeOrDash(day.sunset)),
            stat("UV max", uvMaxText(day.uvMax))),
        partialNote(day, index),
        el("p", { className: "fp-text" }, summaryText(day, fmt.time)));
}

function humidityCard(points) {
    if (!points.some((p) => p.relative_humidity_pct != null || p.wind_speed_kmh != null)) {
        return unavailable("Humidity & wind", "Humidity and wind data unavailable");
    }
    const { canvas, box } = chartBox("Hourly humidity and wind speed chart for this day");
    return { node: card("Humidity & wind", box, el("p", { className: "fp-total" }, humidityWindText(points))), canvas };
}

function uvLine(peak, partial) {
    if (Math.round(peak.uv_index) <= 0) return partial ? "No UV for the remaining hours" : null;
    return `Peak UV ${Math.round(peak.uv_index)} · ${uvCategory(peak.uv_index).label} around ${fmt.time(peak.time)}`;
}

function uvCard(points, partial) {
    const peak = peakUv(points);
    if (!peak) return unavailable("UV index", "UV index data unavailable");
    const { canvas, box } = chartBox("Hourly UV index chart for this day");
    const text = uvLine(peak, partial);
    return { node: card("UV index", box, text && el("p", { className: "fp-total" }, text)), canvas };
}

function aqiCard(points) {
    const peak = peakAqi(points);
    if (!peak) return unavailable("Air quality", "Air quality data unavailable");
    const { canvas, box } = chartBox("Hourly US AQI chart for this day");
    const line = el("p", { className: "fp-total" },
        `Peak AQI ${Math.round(peak.us_aqi)} · ${aqiInfo(peak.aqi_category).label} around ${fmt.time(peak.time)}`);
    return { node: card("Air quality", box, line), canvas };
}

/**
 * options: { tempMode, onTempMode }. Returns { root, iconList, canvases };
 * call charts.render() after attaching root to the document.
 */
export function buildDayView(day, index, { tempMode = "temp", onTempMode } = {}) {
    const root = el("div", { className: "fp-day", id: DAY_PANEL_ID, role: "tabpanel", tabIndex: 0 });
    if (!day.points.length) {
        root.append(el("p", { className: "state state--empty" }, "No hourly data for this day"));
        return { root, canvases: {} };
    }
    const temp = chartBox("Hourly temperature chart for this day");
    const rain = chartBox("Hourly chance of rain chart for this day");
    const partial = partialDayNote(day, index) !== "";
    const [humidity, uv, aqi] = [humidityCard(day.points), uvCard(day.points, partial), aqiCard(day.points)];
    const iconList = renderHourIcons(day.points, day);
    const feelsAvailable = hasFeelsLike(day.points);
    const feelsLine = el("p", { className: "fp-total", hidden: !(feelsAvailable && tempMode === "feels") },
        feelsLikeText(day.points, fmt.time));
    const toggle = renderTempToggle({
        mode: tempMode, feelsAvailable,
        onChange: (mode) => {
            feelsLine.hidden = mode !== "feels";
            onTempMode?.(mode);
        },
    });
    const rainTotal = el("p", { className: "fp-total" }, `Total precipitation: ${fmt.num(day.summary.precipitationTotal, " mm", 1)}`);
    root.append(
        summaryCard(day, index),
        card("Temperature", toggle, iconList, temp.box, feelsLine),
        card("Chance of rain", rain.box, rainTotal),
        humidity.node, uv.node, aqi.node,
    );
    return {
        root,
        iconList,
        canvases: { temp: temp.canvas, rain: rain.canvas, humidity: humidity.canvas, uv: uv.canvas, aqi: aqi.canvas },
    };
}
