# Weather & AQI — Group 7 (Web Design and Programming)

Web dự báo thời tiết và chất lượng không khí cho 15 thành phố Việt Nam.
Dữ liệu dự báo lấy từ [Open-Meteo](https://open-meteo.com/) (không tự huấn luyện mô hình).

- Backend: **FastAPI** + SQLModel + SQLite, cache 15 phút
- Frontend: HTML/CSS/JS thuần + Leaflet + Chart.js, được FastAPI phục vụ cùng origin
- Định hướng chung của project (tạm thời): `claude/project-context.md` trong Claude Project *Weather_forecasting*
- Hợp đồng API: [`docs/API.md`](docs/API.md) · Quy trình làm việc nhóm: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Chạy local

Yêu cầu Python 3.12+.

```powershell
cd hero-api
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

fastapi dev app/main.py
```

- Web: http://127.0.0.1:8000 · thêm `?mock=1` để dùng dữ liệu mẫu: http://127.0.0.1:8000/?mock=1
- Swagger: http://127.0.0.1:8000/docs
- DB `weather.db` và 15 địa điểm được tạo tự động khi khởi động.

Test (không cần mạng, không đụng `weather.db`):

```powershell
pytest
```

## Cấu trúc

```
hero-api/
├── app/
│   ├── main.py            # lắp ráp app: router, error handler, mount frontend
│   ├── config.py          # cấu hình (đọc .env)
│   ├── database.py        # engine SQLite (WAL), get_session / SessionDep
│   ├── models.py          # bảng DB: Location (+ Reading ở GĐ2, đang comment)
│   ├── schemas.py         # HỢP ĐỒNG API: Envelope, ErrorResponse, CurrentWeather, CurrentSummary, Forecast…
│   ├── errors.py          # AppError + handler → format lỗi thống nhất
│   ├── seed.py            # 15 địa điểm
│   ├── routers/           # locations, overview, weather, health, deps dùng chung
│   └── services/
│       ├── open_meteo.py  # client HTTP gọi Open-Meteo
│       ├── weather.py     # ghép dữ liệu → schema (hỗ trợ concurrent current_many)
│       ├── cache.py       # TTLCache
│       └── aqi.py         # phân mức AQI
├── collector/run.py       # GĐ2: thu thập định kỳ (chưa làm)
├── frontend/
│   ├── index.html
│   ├── css/style.css      # design tokens + layout + states
│   ├── js/
│   │   ├── main.js        # điều phối
│   │   ├── api.js         # lớp gọi API duy nhất (+ mock mode)
│   │   ├── config.js, format.js, aqi.js, ui.js
│   │   └── components/    # current-card (mẫu), hourly-chart (TODO), daily-list (TODO), map, location-picker
│   └── mock/*.json        # dữ liệu mẫu đúng hợp đồng API
├── tests/                 # pytest: conftest có DB in-memory + FakeWeatherService
├── docs/API.md
└── scripts/               # check_open_meteo.py (kiểm tra Open-Meteo thật)
```

## Trạng thái hiện tại

| Phần | Trạng thái |
|---|---|
| `/api/locations`, `/api/health`, format lỗi, Swagger, test | ✅ Xong |
| `/api/current` — tóm tắt 15 địa điểm (ThreadPoolExecutor + cache 15 phút) | ✅ Xong |
| `/api/.../current`, `/forecast` — router, validate, cache | ✅ Xong |
| `/api/.../current`, `/forecast` — lấy dữ liệu thật (`services/weather.py`) | ✅ Xong (đã kiểm tra thành công với Open-Meteo) |
| Frontend: layout, chọn địa điểm, bản đồ, thẻ hiện tại, states | ✅ Khung xong |
| Frontend: biểu đồ 48h, thẻ 7 ngày, màu marker theo AQI | ⬜ TODO |
| GĐ2: collector, anomaly, lịch sử | ⬜ Chưa bắt đầu |

## Ghi nguồn

Khung hạ tầng (pattern session dependency, test với SQLite in-memory + `TestClient`)
tham khảo từ *Hero API — Week 9/10 lab reference solution* của môn học; phần domain
và frontend đã được viết lại cho đề tài này.
