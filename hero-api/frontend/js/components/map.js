// Bản đồ Leaflet với một marker cho mỗi địa điểm.
// TODO (frontend): tô màu marker theo AQI khi có dữ liệu — gọi setMarkerAqi().
import { aqiInfo } from "../aqi.js";

const VIETNAM_CENTER = [16.0, 106.5];

export function createMap(container, locations, { onSelect }) {
    if (typeof L === "undefined") {
        container.textContent = "Không tải được thư viện bản đồ.";
        container.className = "map state state--error";
        return null;
    }

    const map = L.map(container, { scrollWheelZoom: false }).setView(VIETNAM_CENTER, 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

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
