# Làm việc nhóm (4 người)

## Chia việc đề xuất

Chia theo **file/thư mục** để hạn chế conflict. Nhóm tự gán tên vào bảng.

| Vai trò | Thành viên | Phụ trách | File chính |
|---|---|---|---|
| **A — Dữ liệu backend** | | Gọi Open-Meteo, chuẩn hóa → `CurrentWeather` / `Forecast`, test service bằng JSON mẫu | `app/services/weather.py`, `app/services/open_meteo.py`, `tests/test_weather_service.py`, `tests/fixtures/` |
| **B — API & tài liệu** | | Giữ hợp đồng API, Swagger (summary/ví dụ), test router, health; GĐ2: endpoint readings/anomalies | `app/routers/*`, `app/schemas.py`, `app/errors.py`, `docs/API.md`, `tests/` |
| **C — Frontend: layout & bản đồ** | | Layout, CSS, responsive, dark mode, bản đồ + màu marker AQI, chọn địa điểm | `frontend/index.html`, `frontend/css/`, `components/map.js`, `components/location-picker.js` |
| **D — Frontend: dữ liệu & GĐ2** | | Biểu đồ 48h, thẻ 7 ngày, thẻ hiện tại; sau đó collector + anomaly (GĐ2) | `components/hourly-chart.js`, `components/daily-list.js`, `components/current-card.js`, `collector/` |

Thứ tự phụ thuộc: **không ai phải chờ ai**.
- Frontend làm với `?mock=1` (dữ liệu trong `frontend/mock/`) cho đến khi A xong.
- A làm xong thì bỏ test `test_unimplemented_service_returns_501` và frontend tự chạy với dữ liệu thật.

## Quy tắc vàng

1. **Hợp đồng API chỉ đổi có chủ đích.** Đổi field/endpoint → sửa cùng lúc `app/schemas.py`, `docs/API.md`, `frontend/mock/*.json` trong **một PR**, báo cả nhóm.
2. **Không vào thẳng `main`.** Mỗi việc một branch, merge qua Pull Request, ít nhất 1 người khác review.
3. **`pytest` phải pass** trước khi mở PR.
4. **Đổi định hướng lớn** (stack, kiến trúc, phạm vi) → ghi vào mục "Nhật ký điều chỉnh" của `claude/project-context.md` trước.

## Git

```powershell
git checkout main; git pull
git checkout -b feat/hourly-chart          # feat/… fix/… docs/… refactor/…
# ... code ...
pytest
git add -A; git commit -m "feat(frontend): biểu đồ nhiệt độ 48 giờ"
git push -u origin feat/hourly-chart        # rồi mở Pull Request trên GitHub
```

Commit message: `<loại>(<phạm vi>): <mô tả ngắn>` — loại: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`.

## Quy ước code

### Backend
- Lỗi: `raise NotFoundError(...)` / `UpstreamError(...)` (trong `app/errors.py`), **không** `raise HTTPException`.
- Route trả `Envelope(data=..., meta=Meta(...))`; khai báo `response_model` và `responses=error_responses(...)`.
- Route viết `def` (không `async def`) — SQLite và httpx client đang dùng đều đồng bộ.
- Không hardcode URL/thời gian/ngưỡng: đưa vào `app/config.py`.
- Datetime luôn UTC; giá trị thiếu là `None`.
- Test mới không được gọi mạng thật: mock bằng `FakeWeatherService` (router) hoặc JSON mẫu + `httpx.MockTransport` (service).

### Frontend
- Chỉ gọi API qua `js/api.js`.
- Không gán `innerHTML` với dữ liệu từ API → dùng `el()` / `textContent` (xem `components/current-card.js`).
- Mỗi vùng dữ liệu có đủ 3 trạng thái: loading / empty / error (`setState` trong `js/ui.js`).
- Màu, khoảng cách: dùng biến CSS trong `:root` của `css/style.css`.
- Hiển thị thời gian bằng `fmt` trong `js/format.js` (đổi UTC → giờ VN).

## Definition of Done

- [ ] Chạy được local, không lỗi console
- [ ] `pytest` pass; có test cho logic mới (backend)
- [ ] Có loading/empty/error (frontend), hiển thị ổn ở màn hình 390px
- [ ] Cập nhật `docs/API.md` / README nếu có thay đổi liên quan
