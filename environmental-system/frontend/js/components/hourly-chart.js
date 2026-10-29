// Biểu đồ nhiệt độ và xác suất mưa theo giờ.
import { fmt } from "../format.js";
import { el, setState } from "../ui.js";

let chart = null;

export function renderHourly(container, hourly) {
    chart?.destroy();
    chart = null;

    if (!Array.isArray(hourly) || hourly.length === 0) {
        setState(container, "empty", "Không có dữ liệu dự báo theo giờ");
        return;
    }
    if (typeof Chart === "undefined") {
        setState(container, "error", "Không tải được thư viện biểu đồ.");
        return;
    }

    const temperatures = hourly.map((point) => point.temperature_c);
    const validTemperatures = temperatures.filter((value) => value != null && Number.isFinite(Number(value)));
    const summary = validTemperatures.length
        ? `, cao nhất ${fmt.num(Math.max(...validTemperatures), "°C")}, thấp nhất ${fmt.num(Math.min(...validTemperatures), "°C")}`
        : "";
    const canvas = el("canvas", {
        role: "img",
        ariaLabel: `Biểu đồ nhiệt độ và khả năng mưa ${hourly.length} giờ tới${summary}`,
    });
    const wrapper = el("div", { className: "chart" }, canvas);
    setState(container, "ready");
    container.append(wrapper);

    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim();
    const muted = styles.getPropertyValue("--text-muted").trim();
    const border = styles.getPropertyValue("--border").trim();
    const rainColor = `color-mix(in srgb, ${primary} 28%, transparent)`;

    chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: hourly.map((point) => fmt.time(point.time)),
            datasets: [
                {
                    type: "line",
                    label: "Nhiệt độ (°C)",
                    data: temperatures,
                    yAxisID: "y",
                    borderColor: primary,
                    backgroundColor: primary,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHitRadius: 8,
                    spanGaps: false,
                    borderWidth: 2,
                },
                {
                    type: "bar",
                    label: "Khả năng mưa (%)",
                    data: hourly.map((point) => point.precipitation_probability_pct),
                    yAxisID: "y1",
                    backgroundColor: rainColor,
                    borderColor: primary,
                    borderWidth: 1,
                    maxBarThickness: 14,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { labels: { color: muted, usePointStyle: true, boxWidth: 8 } },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const point = hourly[items[0]?.dataIndex];
                            return point ? fmt.dateTime(point.time) : "";
                        },
                        label: (context) => {
                            const value = context.raw;
                            const unit = context.dataset.yAxisID === "y1" ? "%" : "°C";
                            return `${context.dataset.label}: ${fmt.num(value, unit)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: muted, maxTicksLimit: 12, autoSkip: true, maxRotation: 0 },
                    grid: { color: border },
                },
                y: {
                    type: "linear", position: "left",
                    title: { display: true, text: "Nhiệt độ (°C)", color: muted },
                    ticks: { color: muted }, grid: { color: border },
                },
                y1: {
                    type: "linear", position: "right", min: 0, max: 100,
                    title: { display: true, text: "Khả năng mưa (%)", color: muted },
                    ticks: { color: muted, callback: (value) => `${value}%` },
                    grid: { drawOnChartArea: false, color: border },
                },
            },
        },
    });
}
