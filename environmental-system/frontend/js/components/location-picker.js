// Location dropdown, grouped by region.
const REGION_LABELS = { north: "North", central: "Central", south: "South" };

export function renderLocationPicker(select, locations, { selectedId, onChange }) {
    select.replaceChildren();
    for (const [region, label] of Object.entries(REGION_LABELS)) {
        const group = document.createElement("optgroup");
        group.label = label;
        for (const loc of locations.filter((l) => l.region === region)) {
            group.append(new Option(loc.name, String(loc.id), false, loc.id === selectedId));
        }
        if (group.children.length) select.append(group);
    }
    select.disabled = false;
    select.onchange = () => onChange(Number(select.value));
}
