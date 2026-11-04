# Wireframes and UI/UX Description - Weather & AQI Dashboard

**Design status: "redesigned from the current interface" (thiết kế lại từ giao diện hiện tại).** The frontend already exists in this repository. The wireframes document its information architecture and responsive behaviour (including the 7-day forecast page); they are not pre-implementation artefacts. Values come from `frontend/css/*.css` and `frontend/js/*.js`.

The wireframes are low-fidelity, grayscale and print-friendly. Their HTML/CSS sources are in `docs/wireframes/`; the PNGs are rendered from them with headless Chrome.

## Pages and navigation flow

1. **Home (`index.html`)** shows the map, location dropdown, current conditions, 48-hour chart and the 7-day strip.
2. A **day card** (link) or **More details →** in the "Next 7 days" panel opens **`forecast.html?city=<id>&day=<date>`** in the same tab. "More details" omits `day`, so the page starts on the first day.
3. The forecast page has a **← Back** link to `index.html?city=<id>`. The browser Back button also works, because the page only calls `replaceState` when a day is chosen (no extra history entries).

## Home page layout

- Desktop (above 800 px): two-column grid, sidebar `minmax(280px, 380px)` + content column, gap 16 px, page max width 1200 px. The sidebar holds the Location dropdown and the map (at least 420 px, stretched to the content height) with the AQI scale legend. The content column stacks Current conditions, Next 48 hours (rain alert banner when relevant, line + bar chart, 280 px) and Next 7 days (seven equal cards).
- Mobile (800 px or less): one column. The sidebar moves to row 2, so current / 48 h / 7 days come before the location and map. Chart 220 px, map 300 px, day cards become a horizontal scroll-snap row (cards at least 108 px).
- The "Next 7 days" header has the **More details →** pill at the right.

## Forecast page layout

Single centred column, max width 960 px, 16 px side padding. Top to bottom:

1. Header: **← Back** pill, city name (h1), "7-day forecast".
2. **Day bar**: 7 tabs (weekday + day number); the selected day has a filled circle. Caption below with the long date and, for today, a partial-day note.
3. **Summary**: weather icon + description, stats grid (High, Low, Chance of rain, Precipitation, Sunrise, Sunset, UV max with band), a generated summary sentence, and "Totals are for the whole day; charts start at HH:00." on today.
4. **Temperature**: **Actual | Feels like** segmented toggle, a row of hourly weather icons (every 3rd hour, every 4th when the chart is under 560 px) aligned with the x ticks above a line chart with high/low markers; a feels-like text line appears in that mode.
5. **Chance of rain**: bar chart 0-100 % plus total precipitation.
6. **Humidity & wind**: dual-axis line chart (% left, km/h right, dashed wind) plus a text summary.
7. **UV index**: hourly bars coloured by WHO band, plus "Peak UV n · Band around HH:MM".
8. **Air quality**: hourly US AQI bars coloured by EPA category, plus "Peak AQI n · Category around HH:MM".

At 800 px or less the stats grid goes from 4 columns (4 + 3) to 2 columns and charts shrink from 280 px to 220 px. A card whose data is missing shows an italic "... unavailable" message instead of a chart.

## Colour palette

Tokens from `frontend/css/style.css`. Dark is the single fixed theme:

| Role | Value |
|---|---|
| Page background `--bg` | `#0f1520` |
| Surface `--surface` | `#182131` |
| Text `--text` | `#e6ebf2` |
| Muted text `--text-muted` | `#9aa6b8` |
| Border `--border` | `#2a3547` |
| Primary `--primary` | `#6ea0ff` |
| Danger `--danger` | `#ff8a7a` |
| Shadow | none |
| `--chart-rain` (rain bars, rain-alert fill) | `rgb(110 160 255 / 45%)` |

Charts read `--primary`, `--text-muted`, `--border` and `--chart-rain` from these tokens. Chart.js lines use the primary colour; wind is a dashed muted line.

**US EPA AQI** (`--aqi-*`, `js/aqi.js`; fixed): Good `#00e400`, Moderate `#ffff00`, Unhealthy for Sensitive Groups `#ff7e00`, Unhealthy `#ff0000`, Very Unhealthy `#8f3f97`, Hazardous `#7e0023`, Unknown `#b8c0cc`. Badge text is `#111111`, except white on Very Unhealthy and Hazardous.

**WHO UV bands** (`js/uv-index.js`, values rounded first; fixed colours):

| UV index | Band | Colour |
|---|---|---|
| 0-2 | Low | `#3ea72d` |
| 3-5 | Moderate | `#fff300` |
| 6-7 | High | `#f18b00` |
| 8-10 | Very high | `#e53210` |
| 11+ | Extreme | `#b567a4` |

## Typography

System font stack `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (no web font). Page titles 1.5rem, panel titles 1.05rem, current temperature 2.75rem, day-card icons 1.8rem, stats and labels 0.8-0.9rem, hour-icon times 0.72rem.

## Dark theme

The interface always uses the dark theme: it does not follow the operating-system setting and has no toggle, so the look is the same on every device (requested by the team). `:root` sets `color-scheme: dark` so native controls and scrollbars match, and both pages declare `<meta name="color-scheme" content="dark">`. AQI and UV colours are fixed. Map tiles come from an external provider and may remain light.

## Accessibility

- Day bar is a `role="tablist"` with roving `tabindex`; Left/Right wrap around, Home/End jump to the first/last day; each tab has a visually-hidden full date. The content is a `role="tabpanel"` linked by `aria-controls` / `aria-labelledby`.
- The Actual / Feels like toggle is a `role="group"` of buttons with `aria-pressed`; "Feels like" is disabled with a hint (`aria-describedby`) when there is no feels-like data.
- Each chart canvas has `role="img"` and an `aria-label`, and the card repeats the key result as text (peak UV, peak AQI, totals, humidity/wind summary). Hourly icons are `aria-hidden` and replaced by visually-hidden "time, weather" text.
- AQI and UV are never colour-only: category names and numbers are always shown.
- `:focus-visible` gives a 3 px primary outline with 3 px offset. Loading spinner and skeleton shimmer animations are disabled, and the day strip does not smooth-scroll, under `prefers-reduced-motion: reduce`.
- Landmarks and live regions: `main`, labelled panels, `aria-live` caption and updated time.

## Design rationale

- **Separate page instead of a bottom sheet:** seven charts need width and height that a sheet cannot give on desktop; the page can be a 960 px reading column. A real URL with `city` and `day` can be shared and bookmarked, and the browser Back button and the Back link behave predictably. Charts are created only on that page, so the home page stays light.
- **Day bar rather than long scrolling:** one day at a time keeps the cards short; the tablist pattern gives full keyboard support.
- **Hour icons above the temperature chart** let users read conditions and temperature in one glance without extra cards.
- **800 px breakpoint** is shared by `style.css`, `forecast.css`, `forecast-page.css` and `map.css`. On mobile the map follows the data because the data is what most users open the app for; seven narrow cards would be unreadable, so they scroll horizontally.
- Category colours follow the public EPA and WHO scales, with labels so the meaning survives grayscale print.

## Files

- `docs/wireframes/wireframe.css`, `home-desktop.html`, `home-mobile.html`, `forecast-desktop.html`, `forecast-mobile.html` - hand-written wireframe sources.
- `docs/wireframes/all-pages.html` - combined 4-page sheet used for the PDF.
- `docs/images/Wireframe_Desktop.png`, `Wireframe_Mobile.png` - home page, desktop and mobile.
- `docs/images/Wireframe_Forecast_Desktop.png`, `Wireframe_Forecast_Mobile.png` - forecast page, desktop and mobile.
- `docs/images/Weather_Wireframes.pdf` - the four wireframes, one per page.
