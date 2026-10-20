// Thẻ thời tiết hiện tại — component MẪU: các component khác viết theo cùng kiểu
// (nhận container + data, chỉ dùng el()/textContent, không innerHTML).
import { aqiBadge } from "../aqi.js";
import { fmt, weatherText } from "../format.js";
import { el, setState } from "../ui.js";

export function renderCurrent(container, current) {
    setState(container, "ready");

    const stats = [
        ["Cảm giác như", fmt.num(current.apparent_temperature_c, "°C")],
        ["Độ ẩm", fmt.num(current.humidity_pct, "%")],
        ["Gió", fmt.num(current.wind_speed_kmh, " km/h")],
        ["Lượng mưa", fmt.num(current.precipitation_mm, " mm", 1)],
        ["PM2.5", fmt.num(current.pm2_5, " µg/m³", 1)],
    ];

    container.append(
        el("div", { className: "current" },
            el("div", { className: "current__main" },
                el("span", { className: "current__temp" }, fmt.num(current.temperature_c, "°C")),
                el("span", { className: "current__desc" }, weatherText(current.weather_code)),
                aqiBadge(current.us_aqi, current.aqi_category),
            ),
            el("dl", { className: "stats" },
                ...stats.map(([label, value]) => el("div", {}, el("dt", {}, label), el("dd", {}, value))),
            ),
        ),
    );
}
