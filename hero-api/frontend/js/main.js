// Điểm vào frontend: tải danh sách địa điểm, gắn các component với nhau.
// Logic hiển thị nằm trong js/components/*, file này chỉ điều phối.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { renderCurrent } from "./components/current-card.js";
import { renderDaily } from "./components/daily-list.js";
import { renderHourly } from "./components/hourly-chart.js";
import { renderLocationPicker } from "./components/location-picker.js";
import { createMap } from "./components/map.js";
import { fmt } from "./format.js";
import { errorMessage, setState } from "./ui.js";

const $ = (selector) => document.querySelector(selector);
const views = {
    select: $("#location-select"),
    map: $("#map"),
    current: $("#current"),
    hourly: $("#hourly"),
    daily: $("#daily"),
    updatedAt: $("#updated-at"),
};

let mapView = null;
let requestSeq = 0;   // bỏ qua response cũ khi người dùng đổi địa điểm liên tục

async function selectLocation(locationId) {
    const seq = ++requestSeq;
    views.select.value = String(locationId);
    mapView?.select(locationId);
    for (const view of [views.current, views.hourly, views.daily]) setState(view, "loading");

    // Hai request độc lập: một cái lỗi không làm hỏng cái còn lại.
    const [current, forecast] = await Promise.allSettled([
        api.getCurrent(locationId),
        api.getForecast(locationId),
    ]);
    if (seq !== requestSeq) return;

    if (current.status === "fulfilled") {
        renderCurrent(views.current, current.value.data);
        mapView?.setMarkerAqi(locationId, current.value.data.aqi_category);
        views.updatedAt.textContent = `Cập nhật lúc ${fmt.dateTime(current.value.meta.generated_at)}`;
    } else {
        setState(views.current, "error", errorMessage(current.reason));
    }

    if (forecast.status === "fulfilled") {
        renderHourly(views.hourly, forecast.value.data.hourly);
        renderDaily(views.daily, forecast.value.data.daily);
    } else {
        const message = errorMessage(forecast.reason);
        setState(views.hourly, "error", message);
        setState(views.daily, "error", message);
    }
}

async function init() {
    if (CONFIG.USE_MOCK) views.updatedAt.textContent = "Chế độ dữ liệu mẫu (mock)";

    let locations;
    try {
        locations = (await api.getLocations()).data;
    } catch (error) {
        views.select.replaceChildren(new Option("Không tải được địa điểm"));
        setState(views.current, "error", errorMessage(error));
        return;
    }
    if (!locations.length) {
        setState(views.current, "empty", "Chưa có địa điểm nào");
        return;
    }

    const firstId = locations[0].id;
    renderLocationPicker(views.select, locations, { selectedId: firstId, onChange: selectLocation });
    mapView = createMap(views.map, locations, { onSelect: selectLocation });
    await selectLocation(firstId);
}

init();
