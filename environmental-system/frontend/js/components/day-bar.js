// Day picker: a row of 7 tabs (weekday + day of month), roving tabindex, Left/Right arrows, Home/End.
import { fmt } from "../format.js";
import { el } from "../ui.js";

export const DAY_PANEL_ID = "day-panel";

/** Renders into `container`; returns { select(index, { focus }) }. onSelect(index) fires on user selection. */
export function renderDayBar(container, days, { selected = 0, onSelect }) {
    const tabs = days.map((day, index) => {
        const { weekday, day: dayNumber } = fmt.dayParts(day.date);
        return el("button", {
            type: "button", role: "tab", className: "day-bar__tab", id: `day-tab-${index}`,
            onclick: () => choose(index, false),
        },
        el("span", { className: "day-bar__weekday" }, weekday),
        el("span", { className: "day-bar__num" }, dayNumber),
        el("span", { className: "visually-hidden" }, fmt.longDate(day.date)));
    });
    let current = selected;

    function select(index, { focus = false } = {}) {
        current = index;
        tabs.forEach((tab, i) => {
            tab.setAttribute("aria-selected", String(i === index));
            tab.setAttribute("aria-controls", DAY_PANEL_ID);
            tab.tabIndex = i === index ? 0 : -1;
        });
        if (focus) tabs[index].focus();
    }

    function choose(index, focus) {
        select(index, { focus });
        onSelect?.(index);
    }

    const tablist = el("div", {
        className: "day-bar", role: "tablist", ariaLabel: "Select a day",
        onkeydown: (event) => {
            const target = {
                ArrowRight: (current + 1) % tabs.length,
                ArrowLeft: (current - 1 + tabs.length) % tabs.length,
                Home: 0,
                End: tabs.length - 1,
            }[event.key];
            if (target === undefined) return;
            event.preventDefault();
            choose(target, true);
        },
    }, ...tabs);
    container.replaceChildren(tablist);
    select(selected);
    return { select };
}
