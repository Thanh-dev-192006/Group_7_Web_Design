// Chart.js charts for the forecast page (temperature, chance of rain, AQI). Owns every instance it creates.
import { aqiInfo } from "../aqi.js";
import { fmt } from "../format.js";
import { temperatureExtremes } from "../day-summary-text.js";

function readColors() {
    const styles = getComputedStyle(document.documentElement);
    const color = (name) => styles.getPropertyValue(name).trim();
    return { primary: color("--primary"), muted: color("--text-muted"), border: color("--border"), rain: color("--chart-rain") };
}

function options(colors, { yTitle, unit, y, maxTicks }) {
    const { muted, border } = colors;
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (context) => `${yTitle}: ${fmt.num(context.raw, unit)}` } },
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

function temperatureConfig(points, colors, { maxTicks, onLayout }) {
    const temps = points.map((point) => point.temperature_c);
    const { highPoint, lowPoint } = temperatureExtremes(points);
    const marked = [highPoint, lowPoint].map((point) => points.indexOf(point));
    return {
        type: "line",
        data: {
            labels: points.map((point) => fmt.time(point.time)),
            datasets: [{
                label: "Temperature", data: temps, borderColor: colors.primary, backgroundColor: colors.primary,
                borderWidth: 2, tension: 0.25, spanGaps: false, pointHitRadius: 8,
                pointRadius: temps.map((_, i) => (marked.includes(i) ? 6 : 0)),
            }],
        },
        options: options(colors, { yTitle: "Temperature", unit: "°C", y: { beginAtZero: false, grace: 2 }, maxTicks }),
        // afterLayout runs once the scales are computed: on creation and after every resize
        plugins: [{ id: "hourIconsLayout", afterLayout: (chart) => onLayout?.(chart) }],
    };
}

function rainConfig(points, colors, { maxTicks }) {
    return {
        type: "bar",
        data: {
            labels: points.map((point) => fmt.time(point.time)),
            datasets: [{
                label: "Chance of rain", data: points.map((p) => p.precipitation_probability_pct),
                backgroundColor: colors.rain, borderColor: colors.primary, borderWidth: 1, maxBarThickness: 18,
            }],
        },
        options: options(colors, { yTitle: "Chance of rain", unit: "%", y: { min: 0, max: 100 }, maxTicks }),
    };
}

function aqiConfig(points, colors, { maxTicks }) {
    return {
        type: "bar",
        data: {
            labels: points.map((point) => fmt.time(point.time)),
            datasets: [{
                label: "US AQI", data: points.map((p) => p.us_aqi),
                backgroundColor: points.map((p) => aqiInfo(p.aqi_category).color),
                borderColor: colors.border, borderWidth: 1, maxBarThickness: 18,
            }],
        },
        options: {
            ...options(colors, { yTitle: "US AQI", unit: "AQI", y: { min: 0, beginAtZero: true }, maxTicks }),
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const point = points[context.dataIndex];
                            return `US AQI: ${fmt.num(context.raw)} (${aqiInfo(point?.aqi_category).label})`;
                        },
                    },
                },
            },
        },
    };
}

const BUILDERS = { temp: temperatureConfig, rain: rainConfig, aqi: aqiConfig };

export function createDayCharts() {
    let charts = [];

    function destroy() {
        for (const chart of charts) chart.destroy();
        charts = [];
    }

    /**
     * canvases: { temp, rain, aqi } (any may be absent). Canvases must already be in the document.
     * onTemperatureLayout(chart) runs once the temperature chart exists and after each resize.
     */
    function render(canvases, points, { onTemperatureLayout } = {}) {
        destroy();
        if (typeof Chart === "undefined") throw new Error("Chart.js is not loaded");
        const colors = readColors();
        for (const [key, build] of Object.entries(BUILDERS)) {
            if (!canvases[key]) continue;
            const maxTicks = canvases[key].clientWidth < 560 ? 6 : 8;
            const chart = new Chart(canvases[key], build(points, colors, { maxTicks, onLayout: onTemperatureLayout }));
            charts.push(chart);
            if (key === "temp") onTemperatureLayout?.(chart);
        }
    }

    return { render, destroy };
}
