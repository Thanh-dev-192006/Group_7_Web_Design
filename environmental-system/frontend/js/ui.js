// Trạng thái hiển thị dùng chung cho mọi vùng dữ liệu: loading / empty / error / ready.
// Quy ước: chỉ dùng textContent/createElement, KHÔNG gán innerHTML với dữ liệu từ API.

export { errorMessage } from "./errors.js";

/**
 * options.onRetry (chỉ cho state "error"): hiện nút "Thử lại" gọi callback này.
 * Loading hiển thị skeleton + chữ ẩn cho trình đọc màn hình.
 */
export function setState(container, state, message = "", { onRetry } = {}) {
    container.className = state === "ready" ? "" : `state state--${state}`;
    container.replaceChildren();
    if (state === "ready") return;

    if (state === "loading") {
        container.append(
            el("span", { className: "visually-hidden" }, message || "Đang tải…"),
            el("div", { className: "skeleton skeleton--title" }),
            el("div", { className: "skeleton" }),
            el("div", { className: "skeleton skeleton--short" }),
        );
        return;
    }

    const defaults = { empty: "Không có dữ liệu", error: "Đã xảy ra lỗi" };
    container.append(message || defaults[state] || "");
    if (state === "error" && typeof onRetry === "function") {
        container.append(el("button", { type: "button", className: "state__retry", onclick: onRetry }, "Thử lại"));
    }
}

/** Tạo phần tử nhanh: el("div", { className: "x" }, "text", childEl) */
export function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
}
