// Segmented "Actual | Feels like" toggle for the temperature chart.
import { el } from "../ui.js";

const UNAVAILABLE = "No feels-like data for this day";
const HINT_ID = "feels-like-hint";
const OPTIONS = [["temp", "Actual"], ["feels", "Feels like"]];

/** onChange(mode) fires on user selection; "Feels like" is disabled when feelsAvailable is false. */
export function renderTempToggle({ mode, feelsAvailable, onChange }) {
    const buttons = OPTIONS.map(([value, label]) => el("button", {
        type: "button", className: "segmented__btn", disabled: value === "feels" && !feelsAvailable,
        ...(value === "feels" && !feelsAvailable ? { title: UNAVAILABLE } : {}),
        onclick: () => {
            select(value);
            onChange?.(value);
        },
    }, label));

    function select(value) {
        OPTIONS.forEach(([option], i) => buttons[i].setAttribute("aria-pressed", String(option === value)));
    }

    if (!feelsAvailable) buttons[1].setAttribute("aria-describedby", HINT_ID);
    select(feelsAvailable ? mode : "temp");
    const hint = feelsAvailable ? null : el("span", { className: "visually-hidden", id: HINT_ID }, UNAVAILABLE);
    return el("div", { className: "segmented", role: "group", ariaLabel: "Temperature type" }, ...buttons, hint);
}
