// Builds page URLs for navigation between index.html and forecast.html (pure, Node-testable).
export function pageUrl(page, { city, day, mock } = {}) {
    const params = new URLSearchParams();
    if (city != null) params.set("city", String(city));
    if (day) params.set("day", day);
    if (mock) params.set("mock", "1");
    const query = params.toString();
    return query ? `${page}?${query}` : page;
}
