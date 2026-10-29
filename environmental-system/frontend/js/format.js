// Định dạng hiển thị dùng chung. Mọi thời gian từ API là UTC (ISO, có "Z").
import { CONFIG } from "./config.js";

const timeFmt = new Intl.DateTimeFormat("vi-VN", { timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", {
    timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

export const fmt = {
    time: (iso) => timeFmt.format(new Date(iso)),
    dateTime: (iso) => dateTimeFmt.format(new Date(iso)),
    // `date` của daily là "YYYY-MM-DD" (không có giờ) → format theo UTC để không lệch ngày
    weekday: (isoDate) => weekdayFmt.format(new Date(`${isoDate}T00:00:00Z`)),
    /** Số → chuỗi có đơn vị; null → "—" (không bao giờ hiển thị null thành 0) */
    num: (value, unit = "", digits = 0) => (value == null ? "—" : `${Number(value).toFixed(digits)}${unit}`),
};

// Mã thời tiết WMO → mô tả tiếng Việt (https://open-meteo.com/en/docs, mục "WMO Weather interpretation codes")
const WMO = {
    0: "Trời quang", 1: "Ít mây", 2: "Mây rải rác", 3: "Nhiều mây",
    45: "Sương mù", 48: "Sương mù đóng băng",
    51: "Mưa phùn nhẹ", 53: "Mưa phùn", 55: "Mưa phùn dày",
    61: "Mưa nhẹ", 63: "Mưa vừa", 65: "Mưa to",
    80: "Mưa rào nhẹ", 81: "Mưa rào", 82: "Mưa rào rất to",
    95: "Dông", 96: "Dông kèm mưa đá", 99: "Dông kèm mưa đá lớn",
};

export function weatherText(code) {
    return code == null ? "—" : (WMO[code] ?? `Mã ${code}`);
}
