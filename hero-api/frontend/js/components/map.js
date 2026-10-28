// Bản đồ Leaflet với một marker cho mỗi địa điểm.
// TODO (frontend): tô màu marker theo AQI khi có dữ liệu — gọi setMarkerAqi().
import { aqiInfo } from "../aqi.js";

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
        container.textContent = "Không tải được thư viện bản đồ.";
        container.className = "map state state--error";
        return null;
    }

    const map = L.map(container, { scrollWheelZoom: false }).setView(VIETNAM_CENTER, 5);
    addBaseLayer(map);

    const markers = new Map();
    for (const loc of locations) {
        const marker = L.circleMarker([loc.lat, loc.lon], {
            radius: 8, weight: 2, color: "#ffffff", fillColor: aqiInfo(null).color, fillOpacity: 0.9,
        })
            .bindTooltip(loc.name)
            .on("click", () => onSelect(loc.id))
            .addTo(map);
        markers.set(loc.id, marker);
    }

    return {
        select(locationId) {
            const marker = markers.get(locationId);
            if (!marker) return;
            markers.forEach((m) => m.setRadius(8));
            marker.setRadius(12);
            map.panTo(marker.getLatLng());
        },
        setMarkerAqi(locationId, category) {
            markers.get(locationId)?.setStyle({ fillColor: aqiInfo(category).color });
        },
    };
}
