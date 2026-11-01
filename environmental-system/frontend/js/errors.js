// Chuyển lỗi thành câu tiếng Việt cho người dùng. Module thuần (không import) để test bằng Node.
// Các mã backend phát ra được định nghĩa trong app/errors.py.

const GENERIC_MESSAGE = "Đã xảy ra lỗi. Vui lòng thử lại.";

const MESSAGES = {
    // Phía frontend (api.js)
    NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.",
    TIMEOUT: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
    HTTP_ERROR: "Máy chủ trả về lỗi không xác định. Vui lòng thử lại.",
    // Phía backend (app/errors.py)
    NOT_IMPLEMENTED: "Tính năng này chưa sẵn sàng (backend đang phát triển). Thử ?mock=1.",
    UPSTREAM_UNAVAILABLE: "Nguồn dữ liệu thời tiết đang gặp sự cố. Vui lòng thử lại sau.",
    UPSTREAM_ERROR: "Nguồn dữ liệu thời tiết đang gặp sự cố. Vui lòng thử lại sau.",
    LOCATION_NOT_FOUND: "Không tìm thấy địa điểm.",
    INTERNAL_ERROR: "Máy chủ gặp lỗi nội bộ. Vui lòng thử lại sau.",
    VALIDATION_ERROR: "Yêu cầu không hợp lệ.",
    BAD_REQUEST: "Yêu cầu không hợp lệ.",
    UNAUTHORIZED: "Bạn chưa được xác thực.",
    FORBIDDEN: "Bạn không có quyền truy cập.",
    NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
    METHOD_NOT_ALLOWED: "Yêu cầu không được hỗ trợ.",
};

/** Chuyển ApiError thành câu thông báo cho người dùng (không bao giờ lộ error.message gốc). */
export function errorMessage(error) {
    const code = error?.code;
    return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}
