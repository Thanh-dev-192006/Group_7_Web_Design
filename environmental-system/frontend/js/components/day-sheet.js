// Day-detail bottom sheet: day bar, summary and a combined hourly chart for one local day.
import { CONFIG } from "../config.js";
import { buildDays, pickDayIndex } from "../day-detail.js";
import { fmt, weatherText } from "../format.js";
import { el } from "../ui.js";
import { weatherIcon } from "../weather-icons.js";

const FOCUSABLE = "button:not([disabled]), [href], [tabindex]";
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric" });
const longDateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
});
// day `date` is "YYYY-MM-DD" (no time), so format in UTC to avoid a day shift
const atUtcMidnight = (isoDate) => new Date(`${isoDate}T00:00:00Z`);

let state = null;   // set while the sheet is open

function destroyChart() {
    state?.chart?.destroy();
    if (state) state.chart = null;
}

export function closeDaySheet() {
    if (!state) return;
    destroyChart();
    const { backdrop, trigger, previousOverflow, inerted } = state;
    state = null;
    for (const node of inerted) node.inert = false;
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
    document.body.style.overflow = previousOverflow;
    if (trigger?.isConnected) trigger.focus();
}

function onKeydown(event) {
    if (!state) return;
    if (event.key === "Escape") {
        event.preventDefault();
        closeDaySheet();
    } else if (event.key === "Tab") {
        trapFocus(event);
    }
}

function trapFocus(event) {
    const items = [...state.root.querySelectorAll(FOCUSABLE)].filter((node) => node.tabIndex >= 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!state.root.contains(active) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        (event.shiftKey && state.root.contains(active) ? last : first).focus();
    }
}

function dayButton(day, index) {
    const date = atUtcMidnight(day.date);
    const [weekday, dayNumber] = dayFmt.formatToParts(date)
        .filter((part) => part.type === "weekday" || part.type === "day").map((part) => part.value);
    return el("button", {
        type: "button", role: "tab", className: "day-sheet__tab", id: `day-sheet-tab-${index}`,
        ariaLabel: longDateFmt.format(date),
        onclick: () => selectDay(index, false),
    },
    el("span", { className: "day-sheet__tab-weekday" }, weekday),
    el("span", { className: "day-sheet__tab-num" }, dayNumber));
}

function onTabKeydown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    selectDay((state.selected + step + state.days.length) % state.days.length, true);
}

function stat(label, value) {
    return el("div", {}, el("dt", {}, label), el("dd", {}, value));
}

function renderSummary(day) {
    const { summary, weatherCode } = day;
    return el("div", { className: "day-sheet__summary" },
        el("div", { className: "day-sheet__weather" },
            el("span", { className: "day-sheet__icon", ariaHidden: "true" }, weatherIcon(weatherCode)),
            el("span", { className: "day-sheet__desc" }, weatherText(weatherCode))),
        el("dl", { className: "stats" },
            stat("High", fmt.num(summary.high, "°C")),
            stat("Low", fmt.num(summary.low, "°C")),
            stat("Chance of rain", fmt.num(summary.rainChanceMax, "%")),
            stat("Precipitation", fmt.num(summary.precipitationTotal, " mm", 1))));
}

function indexOfExtreme(values, pick) {
    const valid = values.filter((v) => v != null && Number.isFinite(Number(v)));
    return valid.length ? values.indexOf(pick(...valid)) : -1;
}

function chartOptions(colors) {
    const { muted, border } = colors;
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { labels: { color: muted, usePointStyle: true, boxWidth: 8 } },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const unit = context.dataset.yAxisID === "y1" ? "%" : "°C";
                        return `${context.dataset.label}: ${fmt.num(context.raw, unit)}`;
                    },
                },
            },
        },
        scales: {
            x: { ticks: { color: muted, maxTicksLimit: 8, autoSkip: true, maxRotation: 0 }, grid: { color: border } },
            y: {
                type: "linear", position: "left", beginAtZero: false, grace: 2,
                title: { display: true, text: "°C", color: muted }, ticks: { color: muted }, grid: { color: border },
            },
            y1: {
                type: "linear", position: "right", min: 0, max: 100,
                title: { display: true, text: "%", color: muted },
                ticks: { color: muted, callback: (value) => `${value}%` },
                grid: { drawOnChartArea: false, color: border },
            },
        },
    };
}

function createChart(canvas, points) {
    const temps = points.map((point) => point.temperature_c);
    const extremes = [indexOfExtreme(temps, Math.max), indexOfExtreme(temps, Math.min)];
    const styles = getComputedStyle(document.documentElement);
    const color = (name) => styles.getPropertyValue(name).trim();
    const colors = { primary: color("--primary"), muted: color("--text-muted"), border: color("--border") };

    return new Chart(canvas, {
        type: "bar",
        data: {
            labels: points.map((point) => fmt.time(point.time)),
            datasets: [
                {
                    type: "line", label: "Temperature (°C)", data: temps, yAxisID: "y",
                    borderColor: colors.primary, backgroundColor: colors.primary, borderWidth: 2, tension: 0.25,
                    spanGaps: false, pointHitRadius: 8,
                    pointRadius: temps.map((_, i) => (extremes.includes(i) ? 6 : 0)),
                },
                {
                    type: "bar", label: "Chance of rain (%)", data: points.map((p) => p.precipitation_probability_pct),
                    yAxisID: "y1", backgroundColor: color("--chart-rain"), borderColor: colors.primary,
                    borderWidth: 1, maxBarThickness: 14,
                },
            ],
        },
        options: chartOptions(colors),
    });
}

// `area` must already be attached to the document so Chart.js can measure it.
function fillChartArea(area, points) {
    if (!points.length) {
        area.append(el("p", { className: "state state--empty" }, "No hourly data for this day"));
        return;
    }
    if (typeof Chart === "undefined") {
        area.append(el("p", { className: "state state--error" }, "Could not load the chart library."));
        return;
    }
    const canvas = el("canvas", { role: "img", ariaLabel: "Temperature and chance of rain by hour" });
    area.append(el("div", { className: "chart" }, canvas));
    try {
        state.chart = createChart(canvas, points);
    } catch (error) {
        console.error("Failed to render the day chart.", error);
        area.replaceChildren(el("p", { className: "state state--error" }, "Could not draw the chart."));
    }
}

function captionText(day, index) {
    const text = longDateFmt.format(atUtcMidnight(day.date));
    return index === 0 && day.startHour > 0 ? `${text} · from ${String(day.startHour).padStart(2, "0")}:00` : text;
}

function selectDay(index, focusTab) {
    destroyChart();
    state.selected = index;
    const day = state.days[index];
    state.tabs.forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
    });
    if (focusTab) state.tabs[index].focus();
    state.panel.setAttribute("aria-labelledby", state.tabs[index].id);
    state.caption.textContent = captionText(day, index);
    const area = el("div", { className: "day-sheet__chart" });
    state.content.replaceChildren(renderSummary(day), area);
    fillChartArea(area, day.points);
}

// Makes the page behind the sheet inert; returns the nodes changed so close can undo exactly those.
function inertPage() {
    const changed = [...document.body.children].filter((node) => !node.inert);
    for (const node of changed) node.inert = true;
    return changed;
}

/** Opens the sheet on the local day `date` (falls back to the first day). `trigger` regains focus on close. */
export function openDaySheet({ locationName, daily, hourly, date, trigger }) {
    closeDaySheet();
    const days = buildDays(hourly, daily, CONFIG.TIMEZONE);
    if (!days.length) return;

    const title = el("h2", { className: "day-sheet__title", id: "day-sheet-title" }, locationName || "Day details");
    const closeButton = el("button", {
        type: "button", className: "day-sheet__close", ariaLabel: "Close", onclick: closeDaySheet,
    }, "✕");
    const tabs = days.map(dayButton);
    const tablist = el("div", {
        className: "day-sheet__tabs", role: "tablist", ariaLabel: "Select a day", onkeydown: onTabKeydown,
    }, ...tabs);
    const caption = el("p", { className: "day-sheet__caption" });
    const content = el("div", { className: "day-sheet__content" });
    const panel = el("div", { role: "tabpanel", className: "day-sheet__panel" }, caption, content);
    const root = el("div", { className: "day-sheet", role: "dialog", ariaModal: "true", tabIndex: -1 },
        el("div", { className: "day-sheet__handle", ariaHidden: "true" }),
        el("div", { className: "day-sheet__header" }, title, closeButton),
        tablist, panel);
    root.setAttribute("aria-labelledby", "day-sheet-title");
    const backdrop = el("div", {
        className: "day-sheet-backdrop",
        onclick: (event) => { if (event.target === backdrop) closeDaySheet(); },
    }, root);

    state = {
        root, backdrop, trigger, tabs, panel, caption, content, days, chart: null, selected: 0,
        previousOverflow: document.body.style.overflow,
        inerted: inertPage(),   // before the backdrop is appended, so it is never inert
    };
    document.body.style.overflow = "hidden";
    document.body.append(backdrop);
    document.addEventListener("keydown", onKeydown);
    selectDay(pickDayIndex(days, date), false);
    state.tabs[state.selected].focus();
}
