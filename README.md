# Weather & AQI Dashboard — Group 7 (Web Design and Programming)

Hệ thống web theo dõi và dự báo tình hình thời tiết cùng chất lượng không khí (AQI) cho 15 thành phố tại Việt Nam.

## Giới thiệu dự án

Dự án cung cấp giao diện trực quan cho phép người dùng theo dõi tình trạng thời tiết hiện tại, chất lượng không khí theo tiêu chuẩn US EPA, biểu đồ nhiệt độ 48 giờ và dự báo xu hướng thời tiết 7 ngày tới cho các tỉnh thành Việt Nam.

- **Backend:** Xây dựng bằng **FastAPI** + **SQLModel** + **SQLite**, tự động thu thập và đồng bộ dữ liệu từ Open-Meteo, lưu bộ nhớ đệm (cache) trong 15 phút.
- **Frontend:** Thiết kế dạng Single Page Application bằng **HTML/CSS/JavaScript thuần** (ES modules, không framework/bundler), tích hợp thư viện bản đồ **Leaflet** và biểu đồ **Chart.js** qua CDN, được phục vụ cùng origin bởi backend FastAPI.
- **Mock mode:** Hỗ trợ chế độ chạy thử nghiệm frontend không cần kết nối mạng hoặc backend (`?mock=1`).

## Giao diện ứng dụng

<!-- Chỗ để ảnh chụp màn hình ứng dụng (Desktop 1280px & Mobile 390px) -->
_Ảnh chụp giao diện sẽ được cập nhật sau khi hoàn thiện các thành phần frontend._

## Kiến trúc hệ thống

```text
+---------------------------------------------------------------+
|               Frontend (HTML/CSS/JS thuần - ES Modules)        |
|  - Bản đồ Leaflet (15 thành phố, tô màu marker theo mức AQI)  |
|  - Biểu đồ nhiệt độ Chart.js (48 giờ)                         |
|  - Dự báo xu hướng 7 ngày, thẻ chi tiết thời tiết hiện tại     |
+---------------------------------------------------------------+
                               |
                               | (HTTP GET / REST API)
                               v
+---------------------------------------------------------------+
|                      FastAPI Backend (hero-api)               |
|  - Routers:                                                   |
|    * /api/locations (danh sách & chi tiết địa điểm)           |
|    * /api/current (tóm tắt toàn bộ địa điểm cho bản đồ)       |
|    * /api/locations/{id}/current (thời tiết hiện tại)         |
|    * /api/locations/{id}/forecast (dự báo hourly & daily)     |
|    * /api/health (kiểm tra sức khỏe hệ thống)                 |
|  - In-Memory TTLCache (thời hạn 15 phút, đa luồng an toàn)    |
|  - SQLite Database (lưu trữ metadata 15 thành phố)            |
+---------------------------------------------------------------+
                               |
            +------------------+------------------+
            | (Cache hit)                         | (Cache miss)
            v                                     v
   [ In-Memory TTLCache ]               +-----------------------+
                                        |    Open-Meteo APIs    |
                                        |  - Weather Forecast   |
                                        |  - Air Quality        |
                                        +-----------------------+
```

## Hướng dẫn cài đặt và chạy ứng dụng

Yêu cầu môi trường: **Python 3.12+**.

### 1. Khởi tạo môi trường và cài đặt dependencies

```powershell
cd hero-api
python -m venv .venv
.venv\Scripts\activate            # Trên macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Chạy máy chủ phát triển (Development Server)

```powershell
fastapi dev app/main.py
```

- **Giao diện Web:** http://127.0.0.1:8000
- **Chế độ dữ liệu mẫu (Mock mode):** http://127.0.0.1:8000/?mock=1
- **Tài liệu API tương tác (Swagger UI):** http://127.0.0.1:8000/docs
- Cơ sở dữ liệu SQLite (`weather.db`) và 15 địa điểm mặc định sẽ được tự động khởi tạo khi chạy ứng dụng lần đầu.

### 3. Kiểm thử tự động (Unit / Integration Tests)

Hệ thống kiểm thử sử dụng `pytest` với cơ sở dữ liệu in-memory SQLite và Mock Service, không phụ thuộc kết nối mạng:

```powershell
pytest
```

## Tài liệu API

Tài liệu hợp đồng API chi tiết giữa Backend và Frontend được lưu trữ tại:
👉 [`hero-api/docs/API.md`](hero-api/docs/API.md)

## Thành viên thực hiện (Nhóm 7)

1. Thành viên 1: _[Họ và tên - MSSV]_
2. Thành viên 2: _[Họ và tên - MSSV]_
3. Thành viên 3: _[Họ và tên - MSSV]_
4. Thành viên 4: _[Họ và tên - MSSV]_

## Nguồn tham khảo

- Khung cấu trúc hạ tầng ứng dụng (pattern Session dependency, cấu trúc router/services, kiểm thử in-memory với SQLite + TestClient) được kế thừa và phát triển từ bài mẫu *Hero API — Week 9/10 lab reference solution* của môn học. Phần nghiệp vụ thời tiết, AQI và giao diện người dùng được xây dựng mới hoàn toàn cho đề tài này.

## Bản quyền và Nguồn dữ liệu

- Dữ liệu thời tiết và chất lượng không khí được cung cấp bởi dịch vụ [Open-Meteo](https://open-meteo.com/) tuân theo điều khoản giấy phép [Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
