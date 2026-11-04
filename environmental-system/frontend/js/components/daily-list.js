// Daily forecast cards.
import { fmt, weatherText } from "../format.js";
import { el, setState } from "../ui.js";
import { weatherIcon } from "../weather-icons.js";

// onSelect(day, buttonEl) is called when a day is clicked.
export function renderDaily(container, daily, { onSelect } = {}) {
    if (!Array.isArray(daily) || daily.length === 0) {
        setState(container, "empty", "No daily forecast data");
        return;
    }

    const list = el("ul", { className: "daily", ariaLabel: "Daily weather forecast" });
    for (const day of daily) {
        const button = el("button", {
            type: "button", className: "daily__btn", title: "Show day details",
            onclick: () => onSelect?.(day, button),
        },
            el("span", { className: "daily__day" }, fmt.weekday(day.date)),
            el("span", { className: "daily__icon", ariaHidden: "true" }, weatherIcon(day.weather_code)),
            el("span", { className: "daily__desc" }, weatherText(day.weather_code)),
            el("span", { className: "daily__temps" },
                el("strong", {}, fmt.num(day.temperature_max_c, "°")),
                el("span", {}, fmt.num(day.temperature_min_c, "°")),
            ),
            el("span", { className: "daily__rain", title: "Highest chance of rain" },
                el("span", { className: "daily__rain-icon", ariaHidden: "true" }, "☂"),
                fmt.num(day.precipitation_probability_max_pct, "%"),
            ),
        );
        list.append(el("li", { className: "daily__item" }, button));
    }
    setState(container, "ready");
    container.append(list);
}
