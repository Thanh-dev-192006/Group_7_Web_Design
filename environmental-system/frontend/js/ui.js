// Shared display states for every data region: loading / empty / error / ready.
// Rule: use textContent/createElement only; never assign API data to innerHTML.

export { errorMessage } from "./errors.js";

/**
 * options.onRetry (state "error" only): shows a "Retry" button that calls this callback.
 * Loading shows a skeleton plus screen-reader-only text.
 */
export function setState(container, state, message = "", { onRetry } = {}) {
    container.className = state === "ready" ? "" : `state state--${state}`;
    container.replaceChildren();
    if (state === "ready") return;

    if (state === "loading") {
        container.append(
            el("span", { className: "visually-hidden" }, message || "Loading…"),
            el("div", { className: "skeleton skeleton--title" }),
            el("div", { className: "skeleton" }),
            el("div", { className: "skeleton skeleton--short" }),
        );
        return;
    }

    const defaults = { empty: "No data", error: "Something went wrong" };
    container.append(message || defaults[state] || "");
    if (state === "error" && typeof onRetry === "function") {
        container.append(el("button", { type: "button", className: "state__retry", onclick: onRetry }, "Retry"));
    }
}

/** Quick element builder: el("div", { className: "x" }, "text", childEl) */
export function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
}
