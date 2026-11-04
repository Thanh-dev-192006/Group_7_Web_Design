// Daily forecast cards.
import { fmt, weatherText } from "../format.js";
import { el, setState } from "../ui.js";
import { weatherIcon } from "../weather-icons.js";

// hrefFor(day) gives the detail-page URL each card links to.
export function renderDaily(container, daily, { hrefFor } = {}) {
    if (!Array.isArray(daily) || daily.length === 0) {
        setState(container, "empty", "No daily forecast data");
        return;
    }

    const list = el("ul", { className: "daily", ariaLabel: "Daily weather forecast" });
    for (const day of daily) {
        const link = el("a", { className: "daily__btn", href: hrefFor?.(day) ?? "forecast.html", title: "Show day details" },
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
        list.append(el("li", { className: "daily__item" }, link));
    }
    setState(container, "ready");
    container.append(list);
}
