# Wireframe / Mockup – Weather & Air Quality Dashboard

**Design status: “Redesigned from the current interface” (thiết kế lại từ giao diện hiện tại).** The frontend is already implemented in the supplied repository. These wireframes document and clarify the existing information architecture and responsive behavior; they should not be described as pre-implementation design artifacts.

## Layout and component placement

The desktop view follows the existing two-column CSS grid at widths above 800 px. A left sidebar contains the **Location** dropdown and the interactive map with city markers and the **AQI scale** legend. The right content column stacks three panels in order: **Current conditions**, **Next 48 hours**, and **Next 7 days**. The current-conditions panel places the weather icon, large temperature, condition description and AQI badge first, followed by the five metrics (feels-like temperature, humidity, wind, precipitation and PM2.5) and AQI-dependent health advice when available. The 48-hour panel contains a conditional rain-alert banner above a combined chart: temperature is a line series and precipitation probability is a bar series. The 7-day forecast is a seven-card row on desktop.

At widths of 800 px or less, the CSS changes the layout to one column and moves the sidebar to grid row 2. Consequently, the current card, 48-hour chart and 7-day forecast appear before the location dropdown and map. The chart height changes from 280 px to 220 px, the map is 300 px high, and the seven daily cards become a horizontally scrollable row with scroll snapping. The desktop map is at least 420 px high and expands with the sidebar. This mobile ordering is intentionally faithful to the current CSS rather than an invented alternative.

The rain banner is not a permanent page-wide hero: it is rendered inside the **Next 48 hours** panel when the upcoming forecast meets the rain-alert rule (rain/storm weather code or precipitation probability at/above 60% within the next 12 hours). The chart itself displays hourly temperature and chance of rain; it does not chart AQI.

## Color palette

The wireframe uses the actual tokens from `frontend/css/style.css` and `frontend/js/aqi.js`:

| Role | Light theme | Dark theme |
|---|---|---|
| Page background | `#f3f6fa` | `#0f1520` |
| Card / surface | `#ffffff` | `#182131` |
| Primary text | `#172033` | `#e6ebf2` |
| Secondary text | `#5b6678` | `#9aa6b8` |
| Borders | `#e1e7ef` | `#2a3547` |
| Primary / links / chart | `#1f5fbf` | `#6ea0ff` |
| Error / danger | `#b42318` | `#ff8a7a` |

**US EPA AQI category colors** (the category name and numeric AQI should remain visible so the meaning is not conveyed by color alone):

| AQI category | Color |
|---|---|
| Good | `#00e400` |
| Moderate | `#ffff00` |
| Unhealthy for Sensitive Groups | `#ff7e00` |
| Unhealthy | `#ff0000` |
| Very Unhealthy | `#8f3f97` |
| Hazardous | `#7e0023` |
| No data / Unknown | `#b8c0cc` |

For black-and-white printing, use the category labels and numeric AQI values in addition to the swatches; the map legend must not rely on hue alone. The supplied wireframe labels every legend row explicitly.

## Typography

The implementation uses the platform-native system font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. This avoids an external font dependency and provides familiar platform rendering. The wireframe uses a clear hierarchy: a 24 px page title, approximately 17 px panel headings, large 44 px current temperature, 14–16 px primary values and 12–14 px supporting labels. These sizes are illustrative rather than new CSS requirements; the production stylesheet uses relative sizing for component text.

## Dark mode and accessibility

Dark mode is automatic through `@media (prefers-color-scheme: dark)`: page, surface, text, muted text, borders, primary and danger tokens are changed in CSS. There is no in-page theme toggle in the supplied code, so the mockup does not add one. Leaflet controls, popups and map legend follow the CSS tokens; external base-map tile imagery may remain light because the map uses external tile providers.

Keyboard focus uses the existing `:focus-visible` treatment: a 3 px primary-color outline with a 3 px offset. This makes the focused control visible without adding a permanent border to every control. Reduced-motion preferences are respected: loading spinner and skeleton shimmer animations are disabled, and the daily forecast avoids smooth scrolling when `prefers-reduced-motion: reduce` is active. AQI badges, markers and chart colors are paired with text labels; the map markers expose accessible names and keyboard activation.

## Design rationale

The 800 px breakpoint is the breakpoint already implemented in `style.css`, `forecast.css` and `map.css`: above it, the map can occupy a dedicated sidebar beside the data panels; at or below it, a single-column layout avoids compressing the forecast cards and chart into narrow columns. The desktop map is at least 420 px high to remain useful for selecting city markers; the mobile map is reduced to 300 px so it remains usable without dominating the page. The seven-day strip changes to horizontal scrolling on mobile because seven narrow cards would otherwise become unreadable. Reduced motion and a strong focus-visible outline support users who navigate by keyboard or prefer fewer animations. The AQI scale follows the existing US EPA category colors, while explicit labels preserve meaning in grayscale print and for users who do not distinguish colors reliably.

## Files

- `Wireframe_Desktop.png` – desktop layout.
- `Wireframe_Mobile.png` – mobile layout, including the actual mobile component order.
- `Weather_Wireframes_Desktop_Mobile.pdf` – two-page PDF, desktop and mobile.
