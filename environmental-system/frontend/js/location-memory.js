// Remembers the selected location: ?city=<id> in the URL first, then localStorage, then the first location.
// No module-level window/localStorage access, so Node unit tests can import it.
const STORAGE_KEY = "weather.locationId";

function parseId(raw) {
    if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
    const id = Number(raw.trim());
    return Number.isSafeInteger(id) ? id : null;
}

export function pickInitialLocation(locations, { urlCity, storedId } = {}) {
    if (!locations.length) return null;
    const known = new Set(locations.map((location) => location.id));
    for (const raw of [urlCity, storedId]) {
        const id = parseId(raw);
        if (id !== null && known.has(id)) return id;
    }
    return locations[0].id;
}

export function readStoredId() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;   // storage blocked or unavailable
    }
}

export function storeId(id) {
    try {
        localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
        // ignore: failing to persist doesn't affect core behaviour
    }
}
