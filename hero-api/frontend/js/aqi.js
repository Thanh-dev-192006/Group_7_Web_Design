// Nhãn + màu cho aqi_category. Backend đã phân mức sẵn, ở đây chỉ hiển thị.
// Màu thật nằm ở css/style.css (biến --aqi-*); `color` dưới đây dùng cho
// nơi không dùng được CSS class (marker Leaflet, Chart.js).
export const AQI_LEVELS = {
    good:                { label: "Tốt",                       color: "#00e400" },
    moderate:            { label: "Trung bình",                color: "#ffff00" },
    unhealthy_sensitive: { label: "Kém (nhóm nhạy cảm)",       color: "#ff7e00" },
    unhealthy:           { label: "Xấu",                       color: "#ff0000" },
    very_unhealthy:      { label: "Rất xấu",                   color: "#8f3f97" },
    hazardous:           { label: "Nguy hại",                  color: "#7e0023" },
};

const UNKNOWN = { label: "Không có dữ liệu", color: "#b8c0cc" };

export function aqiInfo(category) {
    return AQI_LEVELS[category] ?? UNKNOWN;
}

/** Tạo badge AQI: <span class="aqi aqi--moderate">AQI 85 · Trung bình</span> */
export function aqiBadge(usAqi, category) {
    const el = document.createElement("span");
    el.className = `aqi${category ? ` aqi--${category}` : ""}`;
    el.textContent = usAqi == null ? aqiInfo(null).label : `AQI ${Math.round(usAqi)} · ${aqiInfo(category).label}`;
    return el;
}
