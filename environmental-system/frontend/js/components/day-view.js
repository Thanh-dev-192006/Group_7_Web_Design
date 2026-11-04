// Cards for one selected day: summary, temperature, chance of rain, air quality.
import { fmt, weatherText } from "../format.js";
import { aqiInfo } from "../aqi.js";
import { partialDayNote } from "../day-detail.js";
import { peakAqi, summaryText } from "../day-summary-text.js";
import { el } from "../ui.js";
import { weatherIcon } from "../weather-icons.js";
import { renderHourIcons } from "./hour-icons.js";
import { DAY_PANEL_ID } from "./day-bar.js";

const card = (title, ...children) => el("section", { className: "panel fp-card" },
    el("h2", { className: "panel__title" }, title), ...children);

const chartBox = (label) => {
    const canvas = el("canvas", { role: "img", ariaLabel: label });
    return { canvas, box: el("div", { className: "chart" }, canvas) };
};

function stat(label, value) {
    return el("div", {}, el("dt", {}, label), el("dd", {}, value));
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
            stat("Precipitation", fmt.num(summary.precipitationTotal, " mm", 1))),
        partialNote(day, index),
        el("p", { className: "fp-text" }, summaryText(day, fmt.time)));
}

function aqiCard(points) {
    if (!points.some((point) => point.us_aqi != null)) {
        return { node: card("Air quality", el("p", { className: "state state--empty" }, "Air quality data unavailable")) };
    }
    const { canvas, box } = chartBox("Hourly US AQI chart for this day");
    const peak = peakAqi(points);
    const line = el("p", { className: "fp-total" },
        `Peak AQI ${Math.round(peak.us_aqi)} · ${aqiInfo(peak.aqi_category).label} around ${fmt.time(peak.time)}`);
    return { node: card("Air quality", box, line), canvas };
}

/** Returns { root, iconList, canvases: { temp, rain, aqi } }; call charts.render() after attaching root to the document. */
export function buildDayView(day, index) {
    const root = el("div", { className: "fp-day", id: DAY_PANEL_ID, role: "tabpanel", tabIndex: 0 });
    if (!day.points.length) {
        root.append(el("p", { className: "state state--empty" }, "No hourly data for this day"));
        return { root, canvases: {} };
    }
    const temp = chartBox("Hourly temperature chart for this day");
    const rain = chartBox("Hourly chance of rain chart for this day");
    const aqi = aqiCard(day.points);
    const iconList = renderHourIcons(day.points);
    const rainTotal = el("p", { className: "fp-total" }, `Total precipitation: ${fmt.num(day.summary.precipitationTotal, " mm", 1)}`);
    root.append(
        summaryCard(day, index),
        card("Temperature", iconList, temp.box),
        card("Chance of rain", rain.box, rainTotal),
        aqi.node,
    );
    return { root, iconList, canvases: { temp: temp.canvas, rain: rain.canvas, aqi: aqi.canvas } };
}
