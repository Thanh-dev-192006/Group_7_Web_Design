// Trạng thái hiển thị dùng chung cho mọi vùng dữ liệu: loading / empty / error / ready.
// Quy ước: chỉ dùng textContent/createElement, KHÔNG gán innerHTML với dữ liệu từ API.

export function setState(container, state, message = "") {
    container.className = state === "ready" ? "" : `state state--${state}`;
    container.replaceChildren();
    if (state !== "ready") {
        const defaults = { loading: "Đang tải…", empty: "Không có dữ liệu", error: "Đã xảy ra lỗi" };
        container.textContent = message || defaults[state] || "";
    }
}

/** Chuyển ApiError thành câu thông báo cho người dùng. */
export function errorMessage(error) {
    switch (error?.code) {
        case "NETWORK_ERROR": return "Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.";
        case "NOT_IMPLEMENTED": return "Tính năng này chưa sẵn sàng (backend đang phát triển). Thử ?mock=1.";
        case "UPSTREAM_UNAVAILABLE":
        case "UPSTREAM_ERROR": return "Nguồn dữ liệu thời tiết đang gặp sự cố. Vui lòng thử lại sau.";
        case "LOCATION_NOT_FOUND": return "Không tìm thấy địa điểm.";
        default: return error?.message || "Đã xảy ra lỗi";
    }
}

/** Tạo phần tử nhanh: el("div", { className: "x" }, "text", childEl) */
export function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
}
