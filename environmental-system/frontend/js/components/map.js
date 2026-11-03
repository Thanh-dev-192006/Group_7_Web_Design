// Leaflet map with one marker per location.
import { AQI_LEVELS, aqiInfo } from "../aqi.js";
import { fmt } from "../format.js";
import { el, setState } from "../ui.js";

const VIETNAM_CENTER = [16.0, 106.5];

// Tile sources, tried in order. OpenStreetMap can reject tiles (403) when the browser/extension omits
// the Referer, or the network/ad-blocker blocks it, so we fall back to the next source.
const TILE_SOURCES = [
    {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
    },
    {
        // Public browser basemap key supplied for this project (not a backend credential).
        url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_518f_1_f23d2e915e0ab850dc1546d2",
        options: {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
    },
];
const TILE_ERRORS_BEFORE_FALLBACK = 3;

function addBaseLayer(map, sourceIndex = 0) {
    const source = TILE_SOURCES[sourceIndex];
    // referrerPolicy sends the page origin as Referer (OSM requires a valid one).
    const layer = L.tileLayer(source.url, { referrerPolicy: "origin", ...source.options }).addTo(map);

    let errors = 0;
    layer.on("tileerror", () => {
        errors += 1;
        if (errors === TILE_ERRORS_BEFORE_FALLBACK && sourceIndex + 1 < TILE_SOURCES.length) {
            console.warn(`Map tiles failed to load from source #${sourceIndex + 1}; switching to the fallback source.`);
            map.removeLayer(layer);
            addBaseLayer(map, sourceIndex + 1);
        }
    });
    layer.on("load", () => { errors = 0; });
}

export function createMap(container, locations, { onSelect }) {
    if (typeof L === "undefined") {
        setState(container, "error", "Could not load the map library. You can still pick a location from the list.");
        container.classList.add("map");
        return null;
    }

    setState(container, "ready");
    container.classList.add("map");
    const map = L.map(container, { scrollWheelZoom: false }).setView(VIETNAM_CENTER, 5);
    addBaseLayer(map);

    let legendNode = null;
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = () => {
        const node = el("section", { className: "map-legend" },
            el("h2", { className: "map-legend__title" }, "AQI scale"),
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
        legendNode = node;
        return node;
    };
    legend.addTo(map);

    const markers = new Map();
    const names = new Map(locations.map((loc) => [loc.id, loc.name]));
    const markerBorder = getComputedStyle(document.documentElement).getPropertyValue("--map-marker-border").trim();
    for (const loc of locations) {
        const tooltip = el("span", {}, `${loc.name} · AQI no data`);
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

    // Frame all cities above the legend; re-frame on container resize until the user pans or zooms.
    const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lon]));
    let fitting = false;
    let userMoved = false;
    map.on("zoomstart dragstart", () => { if (!fitting) userMoved = true; });
    const fitCities = () => {
        fitting = true;
        map.fitBounds(bounds, {
            paddingTopLeft: [24, 24],
            paddingBottomRight: [24, (legendNode?.offsetHeight ?? 0) + 24],
            animate: false,
        });
        fitting = false;
    };
    fitCities();
    // Leaflet only tracks window resizes; the sidebar grows when the content column loads.
    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => {
            map.invalidateSize();
            if (!userMoved) fitCities();
        }).observe(container);
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
            // Clear the old colour if the new summary has no data for that location.
            const summaries = new Map(items.map((item) => [item.location_id, item]));
            markers.forEach((marker, id) => {
                const item = summaries.get(id);
                const category = item?.aqi_category ?? null;
                setMarkerAqi(id, category);
                const description = item?.us_aqi == null
                    ? "no data"
                    : `${fmt.num(item.us_aqi)} · ${aqiInfo(category).label}`;
                const tooltip = el("span", {}, `${names.get(id)} · AQI ${description}`);
                marker.setTooltipContent(tooltip);
                marker.getElement().setAttribute("aria-label", tooltip.textContent);
            });
        },
    };
}
