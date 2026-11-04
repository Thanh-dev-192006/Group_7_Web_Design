// Shared Chart.js helpers for the forecast page charts.
import { fmt } from "../format.js";

export function readColors() {
    const styles = getComputedStyle(document.documentElement);
    const color = (name) => styles.getPropertyValue(name).trim();
    return { primary: color("--primary"), muted: color("--text-muted"), border: color("--border"), rain: color("--chart-rain") };
}

export const hourLabels = (points) => points.map((point) => fmt.time(point.time));

/** Base options: one y axis titled `unit`, hour ticks limited by `maxTicks`, no legend. */
export function baseOptions(colors, { unit, y, maxTicks }) {
    const { muted, border } = colors;
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${fmt.num(context.raw, unit)}` } },
        },
        scales: {
            x: { ticks: { color: muted, maxTicksLimit: maxTicks, autoSkip: true, maxRotation: 0 }, grid: { color: border } },
            y: {
                title: { display: true, text: unit, color: muted },
                ticks: { color: muted }, grid: { color: border }, ...y,
            },
        },
    };
}
