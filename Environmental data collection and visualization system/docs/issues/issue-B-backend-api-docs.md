# [B] Backend: endpoint `GET /api/current`, Swagger ví dụ, test lỗi, tài liệu, README

**Người phụ trách:** B · **Nhãn:** `backend` `api` `docs` · **Branch:** `feat/backend-current-all` (tách thêm `docs/readme-root` nếu muốn PR nhỏ)
**Phụ thuộc:** không chờ ai. C sẽ dùng endpoint này sau, bằng `?mock=1` cho tới khi B xong.

## 1. Mục tiêu
1. Thêm endpoint **`GET /api/current`**: thời tiết + AQI tóm tắt của **tất cả** địa điểm trong một lần gọi, để bản đồ tô màu mọi marker ngay khi tải trang.
2. Swagger `/docs` có **ví dụ response** cho mọi endpoint.
3. Bổ sung test cho các đường lỗi.
4. Cập nhật `docs/API.md` + viết lại `README.md` (gốc repo) + dọn script cũ.

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

### 2.1 Schema — `app/schemas.py` (thêm, không sửa class cũ)
```python
class CurrentSummary(BaseModel):
    """Tóm tắt thời tiết + AQI một địa điểm (dùng tô màu bản đồ). Giá trị thiếu là null."""
    location_id: int
    observed_at: UTCDatetime
    temperature_c: float | None = None
    weather_code: int | None = Field(default=None, description="Mã thời tiết WMO")
    is_day: bool | None = None
    us_aqi: float | None = None
    aqi_category: AqiCategory | None = None
```

### 2.2 Service — `app/services/weather.py` (chỉ THÊM method mới vào `WeatherService`)
```python
def current_many(self, locations: list[Location]) -> list[CurrentSummary]:
```
- Gọi lại `self.current(location)` cho từng địa điểm (tái dùng cache) bằng `concurrent.futures.ThreadPoolExecutor(max_workers=settings.overview_max_workers)`. Thêm `overview_max_workers: int = 8` vào `app/config.py`.
- Địa điểm nào lỗi (`AppError`) thì **bỏ qua + `logger.warning`**, không làm hỏng cả danh sách. Nếu **tất cả** đều lỗi → raise lại lỗi đầu tiên (để trả 502/503 đúng format).
- Giữ nguyên thứ tự theo `location.id`.
- Chuyển `CurrentWeather` → `CurrentSummary` bằng một hàm nhỏ `_to_summary(current)`.

### 2.3 Router — **file mới** `app/routers/overview.py`
- `router = APIRouter(prefix="/api", tags=["weather"])`
- `GET /api/current`, hàm `current_all(session: SessionDep, service: WeatherServiceDep)`, `response_model=Envelope[list[CurrentSummary]]`, `summary="Tóm tắt thời tiết + AQI mọi địa điểm"`, `responses=error_responses(502, 503)`.
- Lấy danh sách địa điểm giống `list_locations` (`select(Location).order_by(Location.id)`).
- `meta=Meta(count=len(items), cached=<True nếu mọi địa điểm lấy từ cache, ngược lại False>)` — nếu khó tính `cached` thì để `None` và ghi chú trong docs.
- Đăng ký trong `app/main.py`: thêm `overview` vào `from app.routers import ...` và `app.include_router(overview.router)` (đặt **trước** `app.mount("/")`, cùng chỗ các router khác).

> Chú ý: `GET /api/current` không trùng với `GET /api/locations/{id}/current`. Không đặt route `current` trong `locations.py`.

### 2.4 Swagger ví dụ
- Thêm `model_config = ConfigDict(json_schema_extra={"examples": [ {...} ]})` cho `CurrentWeather`, `CurrentSummary`, `LocationOut`, `Health`, `ErrorBody`. Có thể lấy giá trị từ `docs/API.md` / `frontend/mock/current.json`.
- Với `Forecast` (dài) chỉ cần 1 điểm `hourly` + 1 điểm `daily` trong ví dụ.
- Mỗi route đã có `summary`/`tags`; kiểm tra route nào thiếu `description` thì bổ sung một câu tiếng Việt mô tả tham số quan trọng (giới hạn `hours`, `days`).

### 2.4b Dữ liệu mẫu
`frontend/mock/current-all.json` **đã được tạo sẵn** (15 địa điểm). Nếu đổi `CurrentSummary` thì sửa file này cùng PR.

### 2.5 Test
- **File mới `tests/test_overview.py`** (dùng `client` + `weather_service` từ `tests/conftest.py`):
  - `test_current_all_returns_one_item_per_location` (đếm = số địa điểm seed, `meta.count` khớp, thứ tự theo id, `observed_at` kết thúc bằng `Z`).
  - `test_current_all_skips_failing_location` (cho `weather_service` raise `UpstreamError` với một `location.id` → danh sách thiếu đúng 1 phần tử).
  - `test_current_all_all_fail_returns_error_format` (tất cả raise `UpstreamUnavailable` → 503 + `{"error": {"code": "UPSTREAM_UNAVAILABLE", ...}}`).
- **Bổ sung vào `tests/test_weather.py`:** `current`/`forecast` khi service raise `UpstreamError` → 502 và `UpstreamUnavailable` → 503, body đúng format `{error:{code,message}}`; `hours=0` → 400 với `details[0].field == "query.hours"`.
- **Bổ sung vào `tests/test_core.py`** (hoặc file mới `tests/test_health.py`): `/api/health` trả `status "ok"`, `cache_entries` tăng sau khi gọi `current`.
- Để làm `FakeWeatherService` raise lỗi theo ý muốn, thêm thuộc tính tùy chọn vào class đó trong `tests/conftest.py` (ví dụ `fail_for: dict[int, Exception]`); **không** đổi hành vi mặc định.

### 2.6 Tài liệu
- **`docs/API.md`:** thêm mục `GET /api/current` (mô tả, ví dụ JSON lấy từ `mock/current-all.json`, lưu ý "địa điểm lỗi bị bỏ qua"), thêm vào bảng endpoint. Rà lại toàn bộ file khớp `app/schemas.py`.
- **`README.md` (gốc repo `Group_7_Web_Design/README.md`, hiện vẫn là mô tả đề B3):** viết lại gồm: mô tả ngắn, ảnh/ghi chú giao diện (để trống chỗ ảnh), kiến trúc (sơ đồ ASCII: Frontend → FastAPI → cache → Open-Meteo), cách chạy (copy từ `hero-api/README.md`), link `hero-api/docs/API.md`, thành viên (để trống tên), nguồn tham khảo (hero-api lab reference solution — đã nêu trong `hero-api/README.md`), attribution Open-Meteo (CC BY 4.0). Tiếng Việt.
- **`hero-api/README.md`:** cập nhật bảng "Trạng thái hiện tại" khi PR xong.

### 2.7 Dọn dẹp
- Xóa `scripts/cleanup-hero-template.ps1` (đã dùng xong). **Giữ** `scripts/check_open_meteo.py`.

## 3. Giao diện (signature) mà người khác sẽ dựa vào — không đổi
`GET /api/current` → `200`
```json
{ "data": [ { "location_id": 1, "observed_at": "2026-10-21T03:00:00Z", "temperature_c": 27.4, "weather_code": 2,
              "is_day": true, "us_aqi": 108.0, "aqi_category": "unhealthy_sensitive" } ],
  "meta": { "generated_at": "2026-10-21T03:00:00Z", "count": 15, "cached": false } }
```
Frontend đã có sẵn `api.getCurrentAll()` (trong `js/api.js`) gọi đúng đường dẫn này.

## 4. Tiêu chí nghiệm thu
- [ ] `GET /api/current` trả 15 phần tử với dữ liệu thật; lần gọi thứ hai trong 15 phút nhanh rõ rệt (cache).
- [ ] `/docs` có ví dụ cho mọi schema nêu ở 2.4; không còn schema/route thiếu `summary`.
- [ ] `pytest` pass (số test tăng), không test nào gọi mạng thật.
- [ ] `docs/API.md` khớp `schemas.py`; `mock/current-all.json` khớp `CurrentSummary`.
- [ ] README gốc đã viết lại; `cleanup-hero-template.ps1` đã xóa.

## 5. Ngoài phạm vi
Đổi logic `_build_current/_build_forecast`; thêm endpoint GĐ2 (xem `issue-E-phase2-optional.md`); deploy; sửa bất kỳ file frontend nào.
