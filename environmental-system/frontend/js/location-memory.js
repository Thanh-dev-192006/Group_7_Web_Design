// Nhớ địa điểm đã chọn: ưu tiên ?city=<id> trên URL, rồi localStorage, rồi địa điểm đầu tiên.
// Không truy cập window/localStorage ở mức module để import được trong Node (unit test).
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
        return null;   // storage bị chặn hoặc không có
    }
}

export function storeId(id) {
    try {
        localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
        // bỏ qua: không lưu được cũng không ảnh hưởng chức năng chính
    }
}
