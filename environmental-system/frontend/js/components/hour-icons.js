// Row of hourly weather icons above the temperature chart, positioned on the chart's x scale.
import { CONFIG } from "../config.js";
import { localHour } from "../day-detail.js";
import { fmt, weatherText } from "../format.js";
import { el } from "../ui.js";
import { weatherIcon } from "../weather-icons.js";

const NARROW_CHART_PX = 560;
const isDaytime = (hour) => hour >= 6 && hour < 18;

/** One item per hour; layoutHourIcons() decides which are shown and where. */
export function renderHourIcons(points) {
    const items = points.map((point) => el("li", { className: "hour-icons__item", hidden: true },
        el("span", { className: "hour-icons__time", ariaHidden: "true" }, fmt.time(point.time)),
        el("span", { className: "hour-icons__icon", ariaHidden: "true" },
            weatherIcon(point.weather_code, isDaytime(localHour(point.time, CONFIG.TIMEZONE)))),
        el("span", { className: "visually-hidden" }, `${fmt.time(point.time)}, ${weatherText(point.weather_code)}`),
    ));
    return el("ul", { className: "hour-icons", ariaLabel: "Weather by hour" }, ...items);
}

/** Shows every 3rd hour (every 4th on narrow charts) and aligns each icon with its x tick. */
export function layoutHourIcons(list, chart) {
    if (!chart.scales?.x) return;   // Chart.js fires onResize during construction, before scales exist
    const step = chart.width < NARROW_CHART_PX ? 4 : 3;
    [...list.children].forEach((item, index) => {
        item.hidden = index % step !== 0;
        if (!item.hidden) item.style.left = `${chart.scales.x.getPixelForValue(index)}px`;
    });
}
