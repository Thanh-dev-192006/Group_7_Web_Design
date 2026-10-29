// Bản đồ Leaflet với một marker cho mỗi địa điểm.
import { AQI_LEVELS, aqiInfo } from "../aqi.js";
import { fmt } from "../format.js";
import { el, setState } from "../ui.js";

const VIETNAM_CENTER = [16.0, 106.5];

// Nguồn ô bản đồ: thử lần lượt. OpenStreetMap có thể từ chối ô (403) khi trình duyệt/extension
// không gửi Referer, hoặc bị chặn bởi mạng/ad-block → tự chuyển sang nguồn dự phòng.
const TILE_SOURCES = [
    {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
    },
    {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        options: {
            maxZoom: 19,
            subdomains: "abcd",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
    },
];
const TILE_ERRORS_BEFORE_FALLBACK = 3;

function addBaseLayer(map, sourceIndex = 0) {
    const source = TILE_SOURCES[sourceIndex];
    // referrerPolicy: gửi origin của trang làm Referer (OSM yêu cầu có Referer hợp lệ).
    const layer = L.tileLayer(source.url, { referrerPolicy: "origin", ...source.options }).addTo(map);

    let errors = 0;
    layer.on("tileerror", () => {
        errors += 1;
        if (errors === TILE_ERRORS_BEFORE_FALLBACK && sourceIndex + 1 < TILE_SOURCES.length) {
            console.warn(`Không tải được ô bản đồ từ nguồn #${sourceIndex + 1}, chuyển sang nguồn dự phòng.`);
            map.removeLayer(layer);
            addBaseLayer(map, sourceIndex + 1);
        }
    });
    layer.on("load", () => { errors = 0; });
}

export function createMap(container, locations, { onSelect }) {
    if (typeof L === "undefined") {
        setState(container, "error", "Không tải được thư viện bản đồ. Bạn vẫn có thể chọn địa điểm bằng danh sách.");
        container.classList.add("map");
        return null;
    }

    setState(container, "ready");
    container.classList.add("map");
    const map = L.map(container, { scrollWheelZoom: false }).setView(VIETNAM_CENTER, 5);
    addBaseLayer(map);

    const legend = L.control({ position: "bottomright" });
    legend.onAdd = () => {
        const node = el("section", { className: "map-legend" },
            el("h2", { className: "map-legend__title" }, "Chỉ số AQI"),
            ...[...Object.keys(AQI_LEVELS), null].map((category) => {
                const info = aqiInfo(category);
                const swatch = el("span", { className: "map-legend__swatch" });
                swatch.style.backgroundColor = info.color;
                swatch.setAttribute("aria-hidden", "true");
                return el("div", { className: "map-legend__item" }, swatch, info.label);
            }),
        );
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        return node;
    };
    legend.addTo(map);

    const markers = new Map();
    const names = new Map(locations.map((loc) => [loc.id, loc.name]));
    const markerBorder = getComputedStyle(document.documentElement).getPropertyValue("--map-marker-border").trim();
    for (const loc of locations) {
        const tooltip = el("span", {}, `${loc.name} · AQI không có dữ liệu`);
        const marker = L.circleMarker([loc.lat, loc.lon], {
            radius: 8, weight: 2, color: markerBorder, fillColor: aqiInfo(null).color, fillOpacity: 0.9,
        })
            .bindTooltip(tooltip)
            .on("click", () => onSelect(loc.id))
            .addTo(map);
        const path = marker.getElement();
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", tooltip.textContent);
        path.setAttribute("aria-pressed", "false");
        path.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            onSelect(loc.id);
        });
        path.addEventListener("focus", () => marker.openTooltip());
        path.addEventListener("blur", () => marker.closeTooltip());
        markers.set(loc.id, marker);
    }

    function setMarkerAqi(locationId, category) {
        markers.get(locationId)?.setStyle({ fillColor: aqiInfo(category).color });
    }

    return {
        select(locationId) {
            const marker = markers.get(locationId);
            if (!marker) return;
            markers.forEach((m, id) => {
                m.setRadius(8);
                m.getElement().setAttribute("aria-pressed", String(id === locationId));
            });
            marker.setRadius(12);
            map.panTo(marker.getLatLng());
        },
        setMarkerAqi,
        setAllMarkers(items) {
            // Xóa màu cũ nếu bản tóm tắt mới không còn dữ liệu cho địa điểm đó.
            const summaries = new Map(items.map((item) => [item.location_id, item]));
            markers.forEach((marker, id) => {
                const item = summaries.get(id);
                const category = item?.aqi_category ?? null;
                setMarkerAqi(id, category);
                const description = item?.us_aqi == null
                    ? "không có dữ liệu"
                    : `${fmt.num(item.us_aqi)} · ${aqiInfo(category).label}`;
                const tooltip = el("span", {}, `${names.get(id)} · AQI ${description}`);
                marker.setTooltipContent(tooltip);
                marker.getElement().setAttribute("aria-label", tooltip.textContent);
            });
        },
    };
}
