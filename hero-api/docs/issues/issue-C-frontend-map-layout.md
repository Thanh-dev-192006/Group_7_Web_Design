# [C] Frontend: bản đồ (màu AQI mọi marker + legend), tự làm mới, layout & responsive

**Người phụ trách:** C · **Nhãn:** `frontend` `ui` · **Branch:** `feat/frontend-map-layout`
**Phụ thuộc:** endpoint `GET /api/current` do B làm. Trong lúc chờ, C làm hoàn toàn bằng `?mock=1` (đã có `frontend/mock/current-all.json` và `api.getCurrentAll()`).

## 1. Mục tiêu
1. Khi tải trang, **mọi marker** trên bản đồ được tô màu theo AQI (hiện chỉ marker đang chọn có màu).
2. Bản đồ có **legend** màu AQI.
3. Thẻ hiện tại + màu marker **tự làm mới** mỗi `CONFIG.REFRESH_MINUTES` phút.
4. Layout dùng tốt ở 390px và 1280px, hỗ trợ dark mode, truy cập bàn phím/đọc màn hình ở mức cơ bản.

## 0. QUY ƯỚC CHUNG — BẮT BUỘC (giống hệt trong mọi issue; agent đọc kỹ trước khi viết code)

### 0.1 Dự án
Web dự báo thời tiết + chất lượng không khí (AQI) cho 15 thành phố Việt Nam. Môn Web Design and Programming, nhóm 4 người.
Repo `Group_7_Web_Design`, toàn bộ app nằm trong thư mục **`hero-api/`** (mọi đường dẫn dưới đây tính từ `hero-api/`).

- Backend: FastAPI + SQLModel + SQLite, lấy dữ liệu từ Open-Meteo (không tự huấn luyện mô hình), cache 15 phút. Chạy: `fastapi dev app/main.py` → http://127.0.0.1:8000, Swagger `/docs`.
- Frontend: HTML/CSS/JS **thuần** (ES modules, không framework, không bundler, không npm) + Leaflet + Chart.js (nạp bằng `<script>` CDN trong `index.html`, dùng qua biến toàn cục `L` và `Chart`). Do FastAPI phục vụ cùng origin.
- Frontend chạy không cần backend bằng **mock mode**: thêm `?mock=1` vào URL (đọc `frontend/mock/*.json`).
- Đã xong: toàn bộ backend lấy dữ liệu thật (`app/services/weather.py`), 44 test pass. **Không sửa lại logic đó** trừ khi issue của bạn nói rõ.

### 0.2 Hợp đồng API (nguồn sự thật: `app/schemas.py` + `docs/API.md`)
- Thành công: `{ "data": ..., "meta": { "generated_at", "count"?, "cached"? } }`. Lỗi (mọi endpoint): `{ "error": { "code", "message", "details"? } }`.
- Thời gian: ISO 8601 UTC (`...Z`). Frontend đổi sang giờ VN **chỉ** bằng `fmt` trong `js/format.js`. `daily[].date` là ngày theo **UTC** (`YYYY-MM-DD`).
- Giá trị thiếu là `null`, **không bao giờ là 0**. Hiển thị `null` là `"—"` (dùng `fmt.num`).
- `aqi_category` ∈ `good | moderate | unhealthy_sensitive | unhealthy | very_unhealthy | hazardous` — backend đã tính, **frontend không tự tính lại từ `us_aqi`**.
- Dự báo AQI chỉ có ~4–5 ngày → các giờ xa hơn có `pm2_5`, `us_aqi`, `aqi_category` = `null`.
- `GET /api/locations/{id}/forecast?hours=48&days=7`: `hours` 1–168, `days` 1–7. `hourly[]` bắt đầu từ giờ hiện tại.
- Endpoint: `/api/locations`, `/api/locations/{id}`, `/api/locations/{id}/current`, `/api/locations/{id}/forecast`, `/api/health`, và **mới** `/api/current` (issue B; tóm tắt mọi địa điểm).
- Đổi bất kỳ field/endpoint nào → sửa **cùng lúc, trong cùng một PR**: `app/schemas.py`, `docs/API.md`, `frontend/mock/*.json`, và báo cả nhóm. Không ai tự đổi hợp đồng mà không có issue.

Dạng dữ liệu frontend nhận (rút gọn):
```
CurrentWeather: location_id, observed_at, temperature_c, apparent_temperature_c, humidity_pct, wind_speed_kmh,
                wind_direction_deg, precipitation_mm, weather_code, is_day, pm2_5, us_aqi, aqi_category
HourlyPoint:    time, temperature_c, precipitation_probability_pct, precipitation_mm, weather_code, pm2_5, us_aqi, aqi_category
DailyPoint:     date, temperature_max_c, temperature_min_c, precipitation_sum_mm, precipitation_probability_max_pct, weather_code
CurrentSummary: location_id, observed_at, temperature_c, weather_code, is_day, us_aqi, aqi_category      (mới — /api/current)
Location:       id, name, slug, region ("north"|"central"|"south"), lat, lon
```

### 0.3 Đặt tên & vị trí file (KHÔNG tự đặt khác)
| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Python module | `snake_case.py`, đúng thư mục: router → `app/routers/`, logic → `app/services/`, bảng DB → `app/models.py`, schema API → `app/schemas.py` | `app/routers/overview.py` |
| Python test | `tests/test_<tên module>.py`; hàm `test_<hành vi>_<kết quả>` | `tests/test_overview.py` |
| JS component | `frontend/js/components/<kebab-case>.js`, export hàm `renderXxx(container, data)` hoặc `createXxx(container, ...)` | `components/hourly-chart.js` → `renderHourly` |
| JS module dùng chung | `frontend/js/<kebab-case>.js` | `js/weather-icons.js` |
| CSS | file riêng theo người (xem 0.5). Class theo **BEM** `block__element--modifier`, chữ thường, gạch nối; tiền tố theo component | `.daily__item`, `.map-legend__swatch` |
| Mock JSON | `frontend/mock/<kebab-case>.json`, đúng dạng envelope `{data, meta}` | `mock/current-all.json` |
| Tài liệu | `docs/<TÊN>.md` hoặc `docs/issues/` | `docs/API.md` |
| Tên hàm/biến JS | `camelCase`; hằng số `UPPER_SNAKE_CASE`; class CSS không dùng camelCase | `renderDaily`, `MAX_TICKS` |
| Ngôn ngữ | Code/identifier: tiếng Anh. Chuỗi hiển thị cho người dùng + comment: **tiếng Việt** | `"Đang tải…"` |

### 0.4 Quy ước code (bắt buộc)
**Backend**
- Lỗi: `raise NotFoundError(...)` / `UpstreamError(...)` (từ `app/errors.py`); **không** `raise HTTPException`.
- Route: `def` (không `async def`), trả `Envelope(data=..., meta=Meta(...))`, khai báo `response_model=` và `responses=error_responses(...)`, có `summary=` tiếng Việt và `tags=`.
- Không hardcode URL/ngưỡng/thời gian → `app/config.py`. Datetime luôn UTC. Giá trị thiếu là `None`.
- Test **không gọi mạng thật**: dùng `FakeWeatherService` (`tests/conftest.py`) cho router, `httpx.MockTransport` cho service. Phải `pytest` pass trước khi mở PR.

**Frontend**
- Chỉ gọi API qua `js/api.js`. Không `fetch()` trong component.
- **Cấm** gán `innerHTML` / `insertAdjacentHTML` với dữ liệu từ API. Dùng `el()` (`js/ui.js`) hoặc `textContent`.
- Mỗi vùng dữ liệu có đủ 3 trạng thái **loading / empty / error** qua `setState(container, "loading"|"empty"|"error"|"ready", message)` (`js/ui.js`). Gọi `setState(container, "ready")` trước khi thêm nội dung.
- Component có signature cố định `renderXxx(container, data)` — **không đổi tên/tham số hàm đã export** (file `main.js` đang gọi chúng).
- Màu / khoảng cách / bo góc: dùng biến CSS trong `:root` của `css/style.css` (`--surface`, `--border`, `--text`, `--text-muted`, `--primary`, `--aqi-*`, `--radius`, `--gap`). **Không hardcode mã màu** trong JS/CSS mới; nếu JS cần màu (Chart.js, Leaflet) thì đọc biến CSS bằng `getComputedStyle(document.documentElement).getPropertyValue("--primary")`, riêng màu AQI dùng `aqiInfo(category).color` trong `js/aqi.js`.
- Thời gian: chỉ dùng `fmt.time / fmt.dateTime / fmt.weekday`. Số: `fmt.num(value, unit, digits)`. Mô tả thời tiết: `weatherText(code)` (`js/format.js`).
- Giao diện phải dùng được ở **390px** và **1280px**, hỗ trợ dark mode (`prefers-color-scheme`, đã có biến), có `aria-*` hợp lý, không lỗi console.
- Không thêm thư viện mới (npm/CDN) ngoài Leaflet và Chart.js.

### 0.5 Ai sở hữu file nào (tránh conflict) — chỉ sửa file của mình
| Người | Sở hữu (được tạo/sửa tự do) |
|---|---|
| **B** — Backend API & tài liệu | `app/routers/*`, `app/schemas.py`, `app/errors.py`, `app/main.py`, `app/services/weather.py` (chỉ thêm hàm mới, không đổi hàm cũ), `docs/API.md`, `README.md` (gốc repo), `tests/*` (trừ `test_weather_service.py`), `requirements.txt`, `scripts/*` |
| **C** — Frontend layout & bản đồ | `frontend/index.html`, `frontend/css/style.css`, `frontend/css/map.css`, `frontend/js/main.js`, `frontend/js/config.js`, `frontend/js/components/map.js`, `frontend/js/components/location-picker.js` |
| **D** — Frontend dữ liệu | `frontend/css/forecast.css`, `frontend/js/weather-icons.js` (mới), `frontend/js/components/hourly-chart.js`, `daily-list.js`, `current-card.js` |
| **Dùng chung (chỉ THÊM ở cuối file, không sửa dòng cũ)** | `frontend/js/format.js`, `frontend/js/aqi.js`, `frontend/js/ui.js`, `frontend/js/api.js`, `frontend/mock/*.json` |
| **Không ai sửa trong các issue này** | `app/services/open_meteo.py`, `app/services/cache.py`, `app/services/aqi.py`, `app/database.py`, `app/models.py`, `app/seed.py`, `tests/test_weather_service.py`, `frontend/mock/forecast.json`, `frontend/mock/current.json`, `frontend/mock/locations.json` |

Cần sửa file của người khác → **không tự sửa**: ghi rõ yêu cầu vào PR/mô tả để chủ file làm, hoặc nhắn nhóm.

### 0.6 Git & PR
- Branch từ `main`: `feat/<phạm-vi>-<mô-tả-ngắn>` (vd `feat/frontend-hourly-chart`). Một issue = một branch = một PR (có thể nhiều commit).
- Commit: `<loại>(<phạm vi>): <mô tả ngắn tiếng Việt>`; loại ∈ `feat fix docs test refactor style chore`; phạm vi ∈ `backend frontend api docs tests`. Ví dụ `feat(frontend): biểu đồ nhiệt độ 48 giờ`.
- Không push thẳng `main`. PR cần ≥1 người khác review. `pytest` pass (nếu đụng backend).
- PR description gồm: tóm tắt, danh sách file tạo/sửa, ảnh chụp màn hình (frontend: 390px + 1280px), cách kiểm tra.

### 0.7 Định nghĩa hoàn thành (áp dụng cho mọi issue)
- [ ] Chỉ tạo/sửa file thuộc phạm vi của issue; tên file đúng bảng 0.3.
- [ ] Chạy local không lỗi (backend: `pytest` pass; frontend: không lỗi trong Console, thử cả `?mock=1` và dữ liệu thật).
- [ ] Đủ loading / empty / error (frontend); không `innerHTML` với dữ liệu API.
- [ ] Không hardcode màu/URL/ngưỡng; dùng biến CSS / `config`.
- [ ] Cập nhật tài liệu liên quan trong cùng PR.


## 2. Việc cần làm (chi tiết)

### 2.1 `frontend/js/components/map.js` (sửa; giữ nguyên `createMap` và 2 hàm đang export `select`, `setMarkerAqi`)
- Thêm vào object trả về của `createMap` hàm **`setAllMarkers(items)`**: `items` là mảng `CurrentSummary` (xem 0.2); với mỗi phần tử gọi cùng logic với `setMarkerAqi(item.location_id, item.aqi_category)` và cập nhật nội dung tooltip thành `"<tên> · AQI <số> · <nhãn>"` (dùng `aqiInfo(category).label`; `us_aqi` null → `"không có dữ liệu"`). Không dùng `innerHTML` trong tooltip: dựng bằng `el()` / `textContent`.
- **Legend:** `L.control({ position: "bottomright" })`, nội dung dựng bằng `el()`: tiêu đề "Chỉ số AQI" + 6 dòng (ô màu + nhãn) lấy từ `AQI_LEVELS` trong `js/aqi.js` (export nó nếu chưa export — đây là file dùng chung, chỉ được **thêm** `export` / thêm cuối file) + một dòng "Không có dữ liệu" (`aqiInfo(null)`). Class: `.map-legend`, `.map-legend__title`, `.map-legend__item`, `.map-legend__swatch`.
- Marker không có dữ liệu giữ màu `aqiInfo(null).color`.
- Không đổi `VIETNAM_CENTER`, zoom, tile layer.

### 2.2 `frontend/css/map.css` (file dành riêng cho C)
Style legend và mọi thứ riêng của bản đồ. **Không** viết style bản đồ trong `style.css`. Legend phải đọc được cả ở dark mode (nền `var(--surface)`, chữ `var(--text)`, viền `var(--border)`).

### 2.3 `frontend/js/main.js` (sửa; giữ nguyên cách gọi `renderCurrent/renderHourly/renderDaily` và `renderLocationPicker`)
- Sau khi tạo bản đồ trong `init()`, gọi `api.getCurrentAll()` **không chặn** việc chọn địa điểm đầu tiên (không `await` trước `selectLocation`; dùng `.then(...)`/`.catch(...)`). Thành công → `mapView?.setAllMarkers(response.data)`. Lỗi → `console.warn(...)`, marker giữ màu xám, **không** hiện lỗi to trên giao diện.
- **Tự làm mới:** thêm `setInterval` theo `CONFIG.REFRESH_MINUTES` (phút → ms): làm mới (a) thẻ hiện tại của địa điểm đang chọn bằng `api.getCurrent`, (b) màu marker bằng `api.getCurrentAll`. **Không** gọi `setState(..., "loading")` khi làm mới nền (tránh nhấp nháy); lỗi làm mới nền chỉ `console.warn`, giữ dữ liệu cũ. Bỏ qua khi `document.hidden`. Không làm mới forecast.
- Giữ cơ chế `requestSeq` để bỏ response cũ.
- Cập nhật `views.updatedAt` khi làm mới thành công.

### 2.4 `frontend/css/style.css` — rà soát và sửa (file của C)
- Kiểm tra layout ở **390px, 768px, 1280px**: header không tràn, sidebar xuống dưới nội dung ở ≤800px, bản đồ không che dropdown, không có cuộn ngang (`overflow-x`).
- Contrast: chữ trên badge `.aqi--*` (đặc biệt `--moderate` vàng) phải đọc rõ; chữ muted ≥ 4.5:1 trên nền ở cả light/dark.
- Focus: `:focus-visible` rõ ràng cho `select`, link; không bỏ outline.
- `index.html`: thêm `<meta name="description" content="…">`, `<meta name="theme-color">`, favicon (emoji dưới dạng `data:` URL hoặc file `frontend/favicon.svg`), thêm `<noscript>` thông báo cần bật JavaScript. Dropdown địa điểm có `<label>` (đã có) — giữ.
- Chỉ **thêm** biến/mới trong `:root`; không đổi tên biến cũ (D và code khác đang dùng).

### 2.5 `frontend/js/config.js`
`REFRESH_MINUTES` đã được thêm sẵn (10). Không đổi tên; cần hằng số khác thì thêm bên dưới.

### 2.6 `frontend/js/components/location-picker.js`
Giữ nguyên hành vi. Chỉ sửa nếu cần (ví dụ thêm `aria-label`). Không thêm ô tìm kiếm trong issue này.

## 3. Giao diện (signature) giữ nguyên — người khác dựa vào
```js
createMap(container, locations, { onSelect }) -> { select(id), setMarkerAqi(id, category), setAllMarkers(items) } | null
```
`renderCurrent / renderHourly / renderDaily(container, data)` do D làm — **không sửa** các file đó; C chỉ gọi.

## 4. Cách kiểm tra
- `fastapi dev app/main.py` → http://127.0.0.1:8000/?mock=1 (15 marker phải có màu khác nhau, legend hiện) và http://127.0.0.1:8000/ (dữ liệu thật, sau khi B xong `/api/current`; trước đó marker xám + 1 cảnh báo `console.warn`).
- DevTools → Network offline: trang vẫn hiển thị lỗi gọn (không trắng màn hình).
- Thu nhỏ trình duyệt 390px; bật dark mode của hệ điều hành.
- Đổi địa điểm liên tục bằng cách bấm marker: không lỗi Console, dữ liệu không nhảy sai địa điểm.

## 5. Tiêu chí nghiệm thu
- [ ] 15 marker tô màu theo AQI ngay khi tải (mock + thật); tooltip hiển thị đúng; legend đúng 6 mức + "không có dữ liệu".
- [ ] Làm mới nền hoạt động (thử đặt `REFRESH_MINUTES` = 0.1 để kiểm tra rồi trả về 10); không nhấp nháy loading; tạm dừng khi tab ẩn.
- [ ] Không cuộn ngang ở 390px; contrast đạt; focus nhìn thấy được.
- [ ] Không `innerHTML` với dữ liệu API; không hardcode mã màu ngoài `style.css`/`map.css`; không sửa file của B/D.
- [ ] PR có ảnh chụp 390px + 1280px, light + dark.

## 6. Ngoài phạm vi
Biểu đồ 48h, thẻ 7 ngày, icon thời tiết (D); endpoint backend (B); ô tìm kiếm địa điểm; chế độ bản đồ nhiệt (heatmap layer).
