# [D] Frontend: biểu đồ 48 giờ, thẻ 7 ngày, icon thời tiết, hoàn thiện thẻ hiện tại

**Người phụ trách:** D · **Nhãn:** `frontend` `ui` `chart` · **Branch:** `feat/frontend-forecast-views`
**Phụ thuộc:** không chờ ai — backend dữ liệu thật đã xong; có thể thử cả `?mock=1` lẫn dữ liệu thật.

## 1. Mục tiêu
Thay hai placeholder `[TODO]` bằng thành phần thật và thêm icon thời tiết:
1. **Biểu đồ 48 giờ** (nhiệt độ + xác suất mưa) bằng Chart.js.
2. **Dải thẻ 7 ngày**.
3. **Icon thời tiết** theo mã WMO, dùng chung cho thẻ hiện tại và thẻ 7 ngày.

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

### 2.1 File mới `frontend/js/weather-icons.js`
```js
// Icon thời tiết theo mã WMO (Open-Meteo). Dùng emoji → không cần thêm thư viện/ảnh.
export function weatherIcon(code, isDay = true) -> string
```
Bảng bắt buộc (mã → icon; `isDay === false` dùng icon đêm nếu có; `null`/mã lạ → `"❔"`):
| Mã WMO | Ngày | Đêm |
|---|---|---|
| 0 | ☀️ | 🌙 |
| 1 | 🌤️ | 🌙 |
| 2 | ⛅ | ☁️ |
| 3 | ☁️ | ☁️ |
| 45, 48 | 🌫️ | 🌫️ |
| 51, 53, 55, 56, 57 | 🌦️ | 🌧️ |
| 61, 63, 65, 66, 67 | 🌧️ | 🌧️ |
| 71, 73, 75, 77, 85, 86 | 🌨️ | 🌨️ |
| 80, 81, 82 | 🌦️ | 🌧️ |
| 95, 96, 99 | ⛈️ | ⛈️ |
Hàm thuần, không phụ thuộc DOM. Khi hiển thị icon luôn kèm `aria-hidden="true"` (mô tả chữ đã có từ `weatherText`).

### 2.2 `frontend/js/components/hourly-chart.js` — biểu đồ 48 giờ
Giữ nguyên `export function renderHourly(container, hourly)`.
- Trạng thái: `hourly` rỗng → `setState(container, "empty", "Không có dữ liệu dự báo theo giờ")` (đã có); `typeof Chart === "undefined"` → `setState(container, "error", "Không tải được thư viện biểu đồ.")`.
- Dựng `container` = `<div class="chart"><canvas></canvas></div>` bằng `el()` (sau `setState(container, "ready")`). Gán `role="img"` và `aria-label` tóm tắt (vd "Biểu đồ nhiệt độ và khả năng mưa 48 giờ tới, cao nhất 31°C, thấp nhất 24°C" — tính từ dữ liệu, bỏ `null`).
- Chart.js v4 (`new Chart(canvas, {...})`), `responsive: true`, `maintainAspectRatio: false`, chiều cao do CSS (`.chart { height: 280px }`, ≤800px: 220px) trong `css/forecast.css`.
- Dataset 1: **đường nhiệt độ** `temperature_c` (trục `y`, nhãn "Nhiệt độ (°C)"), `tension` nhẹ, `pointRadius: 0`, `spanGaps: false`.
- Dataset 2: **cột xác suất mưa** `precipitation_probability_pct` (trục `y1`, 0–100, nhãn "Khả năng mưa (%)", bên phải, `grid.drawOnChartArea: false`).
- Trục X: nhãn `fmt.time(point.time)`; `ticks.maxTicksLimit: 12`, `autoSkip: true`. Tooltip: tiêu đề `fmt.dateTime(time)`; giá trị `null` hiển thị `"—"`.
- **`null` giữ nguyên `null`** trong dữ liệu để Chart.js tạo khoảng trống — **không** đổi thành 0.
- Hiển thị **đúng số điểm mà `hourly` truyền vào** (main.js đang truyền 48 điểm theo `CONFIG.FORECAST_HOURS`); không tự cắt/nối.
- Màu: đường nhiệt độ = `--primary`; cột mưa = `--primary` với độ trong suốt (dùng `color-mix` hoặc `globalAlpha`; không hardcode hex); chữ/lưới trục = `--text-muted` / `--border`. Đọc bằng `getComputedStyle(document.documentElement)`. Dark mode: đọc lại biến mỗi lần `renderHourly` được gọi.
- Gọi lại hàm khi đổi địa điểm → **`chart?.destroy()`** trước khi tạo mới (đã có khung biến `chart`).

### 2.3 `frontend/js/components/daily-list.js` — thẻ 7 ngày
Giữ nguyên `export function renderDaily(container, daily)`. Rỗng → `setState(container, "empty", ...)` (đã có).
Cấu trúc DOM (dựng bằng `el()`), mỗi ngày:
```html
<ul class="daily">
  <li class="daily__item">
    <span class="daily__day">T4 28/10</span>              <!-- fmt.weekday(day.date) -->
    <span class="daily__icon" aria-hidden="true">🌧️</span> <!-- weatherIcon(day.weather_code) -->
    <span class="daily__desc">Mưa nhẹ</span>                <!-- weatherText(day.weather_code) -->
    <span class="daily__temps"><strong>32°</strong> <span>24°</span></span>  <!-- max đậm, min mờ; fmt.num(..., "°") -->
    <span class="daily__rain">60%</span>                    <!-- precipitation_probability_max_pct; null → "—" -->
  </li>
</ul>
```
- **Không** gắn nhãn "Hôm nay" dựa trên `date` (đó là ngày UTC, có thể lệch ngày Việt Nam); chỉ dùng `fmt.weekday`.
- Layout (trong `css/forecast.css`): ≥800px lưới 7 cột (thẻ dọc); <800px **cuộn ngang** (`overflow-x: auto`, `scroll-snap-type: x mandatory`) hoặc danh sách dọc — chọn một, mô tả trong PR. Không làm vỡ layout 390px.
- Màu: chỉ biến CSS. Thanh/biểu tượng mưa là tùy chọn.

### 2.4 `frontend/js/components/current-card.js` — hoàn thiện
Giữ nguyên `renderCurrent`, bố cục hiện có. Chỉ **thêm** icon: `<span class="current__icon" aria-hidden="true">${weatherIcon(current.weather_code, current.is_day)}</span>` (dựng bằng `el()`) cạnh nhiệt độ lớn. Thêm dòng "Hướng gió" nếu muốn là tùy chọn: `fmt.num(current.wind_direction_deg, "°")` — chỉ thêm vào mảng `stats`, không đổi cấu trúc.

### 2.5 `frontend/css/forecast.css` (file dành riêng cho D)
Toàn bộ style của `.chart`, `.daily*`, `.current__icon` (kích thước/khoảng cách icon). **Không** sửa `style.css` — cần biến/màu mới thì ghi vào PR để C thêm.

### 2.6 `frontend/js/format.js` (dùng chung — chỉ THÊM cuối file)
Nếu cần helper định dạng (ví dụ `fmt.percent`), thêm bằng cách mở rộng ở cuối file, không sửa dòng cũ. Ưu tiên dùng `fmt.num`.

## 3. Giao diện (signature) giữ nguyên — `main.js` (của C) đang gọi
```js
renderCurrent(container, current)   // CurrentWeather
renderHourly(container, hourly)     // HourlyPoint[]
renderDaily(container, daily)       // DailyPoint[]
export function weatherIcon(code, isDay = true)   // mới
```

## 4. Cách kiểm tra
- `fastapi dev app/main.py` → http://127.0.0.1:8000/?mock=1 rồi http://127.0.0.1:8000/ (dữ liệu thật).
- Đổi địa điểm liên tục: biểu đồ không bị vẽ chồng (kiểm tra `destroy`), không lỗi Console.
- Dùng DevTools sửa tạm vài giá trị `temperature_c`/`precipitation_probability_pct` thành `null`: biểu đồ có khoảng trống, tooltip hiện "—", thẻ ngày hiện "—".
- Thu nhỏ 390px; bật dark mode; tắt mạng (Network offline) → vùng lỗi hiển thị thông báo gọn.

## 5. Tiêu chí nghiệm thu
- [ ] Biểu đồ 48 giờ hai trục đúng dữ liệu; thẻ 7 ngày đúng 7 thẻ; icon đúng bảng 2.1.
- [ ] `null` không bao giờ hiển thị thành 0; loading/empty/error đủ.
- [ ] Không `innerHTML` với dữ liệu API; không hardcode màu; chỉ sửa file thuộc D (+ thêm cuối file dùng chung).
- [ ] Không lỗi Console ở cả mock và dữ liệu thật; ổn ở 390px và 1280px, light + dark.
- [ ] PR có ảnh chụp 390px + 1280px, light + dark.

## 6. Ngoài phạm vi
Bản đồ, legend, polling (C); endpoint backend (B); biểu đồ AQI theo giờ (có thể làm sau nếu còn thời gian — hỏi nhóm); thư viện icon ngoài.
