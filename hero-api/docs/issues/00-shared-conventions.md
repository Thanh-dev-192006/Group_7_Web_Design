# Quy ước chung (bản gốc)

> Đây là bản gốc của mục 0 trong các issue. Sửa ở đây rồi chép lại vào cả 4 issue.

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
