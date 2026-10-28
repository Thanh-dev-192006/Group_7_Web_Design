# Tài liệu API

Base URL khi chạy local: `http://127.0.0.1:8000`. Swagger tương tác: `/docs`.

Đây là **hợp đồng** giữa backend và frontend. Đổi bất cứ thứ gì ở đây thì sửa
cùng lúc `app/schemas.py`, file này, và `frontend/mock/*.json` trong một PR.

## Quy ước chung

| Quy ước | Chi tiết |
|---|---|
| Response thành công | `{ "data": ..., "meta": { "generated_at", "count"?, "cached"? } }` |
| Response lỗi | `{ "error": { "code", "message", "details"? } }` — mọi endpoint, mọi loại lỗi |
| Thời gian | ISO 8601, luôn là **UTC** (`...Z`). Frontend tự đổi sang giờ VN. `daily[].date` là `YYYY-MM-DD` |
| Giá trị thiếu | `null` (không bao giờ là `0`) |
| AQI | Backend trả sẵn `aqi_category`, frontend chỉ hiển thị |
| Đơn vị | °C, %, km/h, mm, µg/m³, độ (hướng gió) |
| Method | Chỉ `GET` (dữ liệu do hệ thống thu thập, client không ghi) |

## Endpoint

### `GET /api/locations`

Danh sách địa điểm. Query: `region` = `north` \| `central` \| `south` (tùy chọn).

```json
{
  "data": [
    { "id": 1, "name": "Hà Nội", "slug": "ha-noi", "region": "north", "lat": 21.0285, "lon": 105.8542 }
  ],
  "meta": { "generated_at": "2026-10-21T03:00:00Z", "count": 15, "cached": null }
}
```

### `GET /api/locations/{id}`

Một địa điểm. Lỗi: `404 LOCATION_NOT_FOUND`, `400 VALIDATION_ERROR` (id không phải số nguyên dương).

### `GET /api/locations/{id}/current`

Thời tiết + AQI hiện tại. Cache 15 phút (`meta.cached = true` nếu lấy từ cache).

```json
{
  "data": {
    "location_id": 1,
    "observed_at": "2026-10-21T03:00:00Z",
    "temperature_c": 27.4,
    "apparent_temperature_c": 29.8,
    "humidity_pct": 78.0,
    "wind_speed_kmh": 9.4,
    "wind_direction_deg": 120.0,
    "precipitation_mm": 0.0,
    "weather_code": 2,
    "is_day": true,
    "pm2_5": 38.2,
    "us_aqi": 108.0,
    "aqi_category": "unhealthy_sensitive"
  },
  "meta": { "generated_at": "2026-10-21T03:00:00Z", "count": null, "cached": false }
}
```

### `GET /api/locations/{id}/forecast?hours=48&days=7`

| Query | Mặc định | Giới hạn |
|---|---|---|
| `hours` | 48 | 1–168 |
| `days` | 7 | 1–7 |

```json
{
  "data": {
    "location_id": 1,
    "hourly": [
      { "time": "2026-10-21T03:00:00Z", "temperature_c": 25.9, "precipitation_probability_pct": 0.0,
        "precipitation_mm": 0.0, "weather_code": 1, "pm2_5": 24.1, "us_aqi": 69.0, "aqi_category": "moderate" }
    ],
    "daily": [
      { "date": "2026-10-21", "temperature_max_c": 31.0, "temperature_min_c": 23.0,
        "precipitation_sum_mm": 1.2, "precipitation_probability_max_pct": 60.0, "weather_code": 61 }
    ]
  },
  "meta": { "generated_at": "2026-10-21T03:00:00Z", "count": null, "cached": false }
}
```

Ghi chú:
- Dữ liệu bắt đầu từ **giờ hiện tại** (UTC, làm tròn xuống giờ). `hours` tối đa 168 = 7 ngày, nên `days` cũng tối đa 7 (Air Quality API của Open-Meteo chỉ dự báo được ~7 ngày).
- Mọi tổ hợp `hours`/`days` dùng chung một bản cache (15 phút) theo địa điểm.
- Nếu Air Quality API lỗi hoặc ngắn hơn dự báo thời tiết, các giờ tương ứng có `pm2_5`, `us_aqi`, `aqi_category` là `null` (thời tiết vẫn trả bình thường). `current` cũng vậy.
- `daily[].date` là ngày theo **UTC**; ngày Việt Nam (UTC+7) bắt đầu lúc 17:00 UTC hôm trước, nên các giờ cuối ngày có thể thuộc `date` kế tiếp khi so với giờ VN.

### `GET /api/health`

```json
{ "data": { "status": "ok", "version": "0.1.0", "database": "ok", "cache_entries": 3 }, "meta": { "...": "..." } }
```

## `aqi_category` (thang US EPA, theo `us_aqi`)

| Giá trị | Khoảng `us_aqi` | Nhãn hiển thị | Màu |
|---|---|---|---|
| `good` | 0–50 | Tốt | `#00e400` |
| `moderate` | 51–100 | Trung bình | `#ffff00` |
| `unhealthy_sensitive` | 101–150 | Kém (nhóm nhạy cảm) | `#ff7e00` |
| `unhealthy` | 151–200 | Xấu | `#ff0000` |
| `very_unhealthy` | 201–300 | Rất xấu | `#8f3f97` |
| `hazardous` | > 300 | Nguy hại | `#7e0023` |

## Mã lỗi

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Tham số sai kiểu/ngoài giới hạn. `details[]` có `field` (VD `query.hours`) và `message` |
| 404 | `LOCATION_NOT_FOUND` | Không có địa điểm với id đó |
| 404 | `NOT_FOUND` | Sai đường dẫn |
| 405 | `METHOD_NOT_ALLOWED` | Sai method |
| 501 | `NOT_IMPLEMENTED` | Tính năng backend chưa làm xong |
| 502 | `UPSTREAM_ERROR` | Open-Meteo trả lỗi / dữ liệu hỏng |
| 503 | `UPSTREAM_UNAVAILABLE` | Không kết nối được / timeout khi gọi Open-Meteo |
| 500 | `INTERNAL_ERROR` | Lỗi không lường trước (xem log server) |

Ví dụ:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request parameters",
             "details": [ { "field": "query.hours", "message": "Input should be less than or equal to 168" } ] } }
```

## GĐ2 (dự kiến, chưa có)

`GET /api/readings/latest`, `GET /api/locations/{id}/readings?from=&to=&limit=`, `GET /api/anomalies?limit=` — xem `claude/project-context.md`.
