// Humidity & wind and UV index chart configs for the forecast page.
import { fmt } from "../format.js";
import { uvCategory } from "../uv-index.js";
import { baseOptions, hourLabels } from "./chart-common.js";

export function humidityWindConfig(points, colors, { maxTicks }) {
    const options = baseOptions(colors, { unit: "%", y: { min: 0, max: 100 }, maxTicks });
    options.plugins.legend = { display: true, labels: { color: colors.muted, usePointStyle: true, boxWidth: 8 } };
    options.plugins.tooltip.callbacks.label = (context) => {
        const unit = context.dataset.yAxisID === "y1" ? " km/h" : "%";
        return `${context.dataset.label}: ${fmt.num(context.raw, unit)}`;
    };
    options.scales.y1 = {
        type: "linear", position: "right", beginAtZero: true,
        title: { display: true, text: "km/h", color: colors.muted },
        ticks: { color: colors.muted }, grid: { drawOnChartArea: false, color: colors.border },
    };
    const line = { type: "line", borderWidth: 2, tension: 0.25, pointRadius: 0, pointHitRadius: 8, spanGaps: false };
    return {
        type: "line",
        data: {
            labels: hourLabels(points),
            datasets: [
                { ...line, label: "Humidity (%)", data: points.map((p) => p.relative_humidity_pct), yAxisID: "y",
                    borderColor: colors.primary, backgroundColor: colors.primary },
                { ...line, label: "Wind (km/h)", data: points.map((p) => p.wind_speed_kmh), yAxisID: "y1",
                    borderColor: colors.muted, backgroundColor: colors.muted, borderDash: [5, 4] },
            ],
        },
        options,
    };
}

export function uvConfig(points, colors, { maxTicks }) {
    const options = baseOptions(colors, { unit: "UV index", y: { min: 0, suggestedMax: 11 }, maxTicks });
    options.plugins.tooltip.callbacks.label = (context) => {
        const category = uvCategory(context.raw);
        return `UV index: ${fmt.num(context.raw, "", 1)}${category ? ` (${category.label})` : ""}`;
    };
    return {
        type: "bar",
        data: {
            labels: hourLabels(points),
            datasets: [{
                label: "UV index", data: points.map((p) => p.uv_index),
                backgroundColor: points.map((p) => uvCategory(p.uv_index)?.color ?? "transparent"),
                borderColor: colors.border, borderWidth: 1, maxBarThickness: 18,
            }],
        },
        options,
    };
}
