// Chart.js charts for the forecast page. Owns every instance it creates.
import { aqiInfo } from "../aqi.js";
import { fmt } from "../format.js";
import { temperatureExtremes } from "../day-summary-text.js";
import { baseOptions, hourLabels, readColors } from "./chart-common.js";
import { humidityWindConfig, uvConfig } from "./day-charts-extra.js";

export const TEMP_MODES = {
    temp: { field: "temperature_c", label: "Temperature" },
    feels: { field: "apparent_temperature_c", label: "Feels like" },
};

/** True when at least one hour has a feels-like value. */
export const hasFeelsLike = (points) => points.some((point) => point.apparent_temperature_c != null);

// Line data, label and H/L marker radii for one temperature mode (markers are computed per mode).
function temperatureSeries(points, mode) {
    const { field, label } = TEMP_MODES[mode];
    const { highPoint, lowPoint } = temperatureExtremes(points, field);
    const marked = [highPoint, lowPoint].map((point) => points.indexOf(point));
    return {
        label,
        data: points.map((point) => point[field]),
        pointRadius: points.map((_, i) => (marked.includes(i) ? 6 : 0)),
    };
}

function temperatureConfig(points, colors, { maxTicks, onLayout, mode }) {
    return {
        type: "line",
        data: {
            labels: hourLabels(points),
            datasets: [{
                ...temperatureSeries(points, mode), borderColor: colors.primary, backgroundColor: colors.primary,
                borderWidth: 2, tension: 0.25, spanGaps: false, pointHitRadius: 8,
            }],
        },
        options: baseOptions(colors, { unit: "°C", y: { beginAtZero: false, grace: 2 }, maxTicks }),
        // afterLayout runs once the scales are computed: on creation and after every resize
        plugins: [{ id: "hourIconsLayout", afterLayout: (chart) => onLayout?.(chart) }],
    };
}

function rainConfig(points, colors, { maxTicks }) {
    return {
        type: "bar",
        data: {
            labels: hourLabels(points),
            datasets: [{
                label: "Chance of rain", data: points.map((p) => p.precipitation_probability_pct),
                backgroundColor: colors.rain, borderColor: colors.primary, borderWidth: 1, maxBarThickness: 18,
            }],
        },
        options: baseOptions(colors, { unit: "%", y: { min: 0, max: 100 }, maxTicks }),
    };
}

function aqiConfig(points, colors, { maxTicks }) {
    const options = baseOptions(colors, { unit: "AQI", y: { min: 0, beginAtZero: true }, maxTicks });
    options.plugins.tooltip.callbacks.label = (context) => {
        const point = points[context.dataIndex];
        return `US AQI: ${fmt.num(context.raw)} (${aqiInfo(point?.aqi_category).label})`;
    };
    return {
        type: "bar",
        data: {
            labels: hourLabels(points),
            datasets: [{
                label: "US AQI", data: points.map((p) => p.us_aqi),
                backgroundColor: points.map((p) => aqiInfo(p.aqi_category).color),
                borderColor: colors.border, borderWidth: 1, maxBarThickness: 18,
            }],
        },
        options,
    };
}

const BUILDERS = {
    temp: temperatureConfig, rain: rainConfig, humidity: humidityWindConfig, uv: uvConfig, aqi: aqiConfig,
};

export function createDayCharts() {
    let charts = [];
    let tempChart = null;
    let points = [];
    let mode = "temp";   // survives day switches (not page reloads)

    function destroy() {
        for (const chart of charts) chart.destroy();
        charts = [];
        tempChart = null;
    }

    const effectiveMode = () => (mode === "feels" && hasFeelsLike(points) ? "feels" : "temp");

    /** Switches the temperature line between actual and feels-like, updating the existing chart in place. */
    function setTemperatureMode(next) {
        mode = next;
        if (!tempChart) return;
        Object.assign(tempChart.data.datasets[0], temperatureSeries(points, effectiveMode()));
        tempChart.update();
    }

    /**
     * canvases: { temp, rain, humidity, uv, aqi } (any may be absent). Canvases must already be in the document.
     * onTemperatureLayout(chart) runs once the temperature chart exists and after each layout.
     */
    function render(canvases, dayPoints, { onTemperatureLayout } = {}) {
        destroy();
        if (typeof Chart === "undefined") throw new Error("Chart.js is not loaded");
        points = dayPoints;
        const colors = readColors();
        for (const [key, build] of Object.entries(BUILDERS)) {
            if (!canvases[key]) continue;
            const maxTicks = canvases[key].clientWidth < 560 ? 6 : 8;
            const chart = new Chart(canvases[key], build(points, colors, { maxTicks, onLayout: onTemperatureLayout, mode: effectiveMode() }));
            charts.push(chart);
            if (key === "temp") {
                tempChart = chart;
                onTemperatureLayout?.(chart);
            }
        }
    }

    return { render, destroy, setTemperatureMode, temperatureMode: () => mode };
}
