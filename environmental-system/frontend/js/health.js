// Lời khuyên sức khỏe theo aqi_category (hướng dẫn US EPA, dịch sang tiếng Việt).
// Khóa khớp với AQI_LEVELS trong js/aqi.js. Thuần logic: không import gì.
const ADVICE = {
    good: {
        general: "Không khí trong lành, thoải mái hoạt động ngoài trời.",
        sensitive: "Không cần biện pháp đặc biệt.",
    },
    moderate: {
        general: "Chất lượng không khí chấp nhận được.",
        sensitive: "Người rất nhạy cảm nên hạn chế gắng sức lâu ngoài trời.",
    },
    unhealthy_sensitive: {
        general: "Người khỏe mạnh vẫn có thể hoạt động bình thường.",
        sensitive: "Trẻ em, người già, người có bệnh hô hấp/tim mạch nên hạn chế ra ngoài lâu.",
    },
    unhealthy: {
        general: "Hạn chế hoạt động gắng sức ngoài trời, nên đeo khẩu trang khi ra ngoài.",
        sensitive: "Nhóm nhạy cảm nên ở trong nhà.",
    },
    very_unhealthy: {
        general: "Tránh hoạt động ngoài trời, đóng cửa sổ, đeo khẩu trang N95 nếu phải ra ngoài.",
        sensitive: "Nhóm nhạy cảm cần ở trong nhà, cân nhắc dùng máy lọc không khí.",
    },
    hazardous: {
        general: "Cảnh báo khẩn cấp: mọi người nên ở trong nhà.",
        sensitive: "Nhóm nhạy cảm tuyệt đối không ra ngoài.",
    },
};

/** Trả về { general, sensitive } cho mức AQI, hoặc null nếu mức không xác định/thiếu. */
export function healthAdvice(category) {
    return Object.hasOwn(ADVICE, category) ? { ...ADVICE[category] } : null;
}
