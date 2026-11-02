// Current-conditions card — the reference component: others follow the same pattern
// (take container + data, use el()/textContent only, never innerHTML).
import { aqiBadge } from "../aqi.js";
import { healthAdvice } from "../health.js";
import { fmt, weatherText } from "../format.js";
import { el, setState } from "../ui.js";
import { weatherIcon } from "../weather-icons.js";

export function renderCurrent(container, current) {
    setState(container, "ready");

    const stats = [
        ["Feels like", fmt.num(current.apparent_temperature_c, "°C")],
        ["Humidity", fmt.num(current.humidity_pct, "%")],
        ["Wind", fmt.num(current.wind_speed_kmh, " km/h")],
        ["Precipitation", fmt.num(current.precipitation_mm, " mm", 1)],
        ["PM2.5", fmt.num(current.pm2_5, " µg/m³", 1)],
    ];

    container.append(
        el("div", { className: "current" },
            el("div", { className: "current__main" },
                el("span", { className: "current__icon", ariaHidden: "true" }, weatherIcon(current.weather_code, current.is_day)),
                el("span", { className: "current__temp" }, fmt.num(current.temperature_c, "°C")),
                el("span", { className: "current__desc" }, weatherText(current.weather_code)),
                aqiBadge(current.us_aqi, current.aqi_category),
            ),
            el("dl", { className: "stats" },
                ...stats.map(([label, value]) => el("div", {}, el("dt", {}, label), el("dd", {}, value))),
            ),
            adviceBlock(current.aqi_category),
        ),
    );
}

/** Health advice block for the AQI level; null (hidden) if the level is unknown. */
function adviceBlock(category) {
    const advice = healthAdvice(category);
    if (!advice) return null;
    return el("div", { className: `advice aqi-advice--${category}` },
        el("h3", { className: "advice__title" }, "Health advice"),
        el("p", {}, el("strong", {}, "Everyone: "), advice.general),
        el("p", {}, el("strong", {}, "Sensitive groups: "), advice.sensitive),
    );
}
