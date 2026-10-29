# Issue cho nhóm — hoàn thiện project Weather & AQI

Mỗi issue là **một file tự chứa**: ai nhận issue nào thì copy/import **đúng file đó** cho Agent (đã kèm đầy đủ quy ước chung ở mục 0, nên Agent không cần đọc thêm file nào khác để biết đặt tên và để file ở đâu).

| File | Người | Nội dung | Phụ thuộc |
|---|---|---|---|
| [`issue-B-backend-api-docs.md`](issue-B-backend-api-docs.md) | **B** | Endpoint `GET /api/current`, Swagger ví dụ, test lỗi, `docs/API.md`, README gốc | — |
| [`issue-C-frontend-map-layout.md`](issue-C-frontend-map-layout.md) | **C** | Màu marker mọi địa điểm + legend, tự làm mới, layout/responsive | dùng mock cho tới khi B xong |
| [`issue-D-frontend-forecast-views.md`](issue-D-frontend-forecast-views.md) | **D** | Biểu đồ 48h, thẻ 7 ngày, icon thời tiết | — |
| [`issue-E-phase2-optional.md`](issue-E-phase2-optional.md) | B + D | Giai đoạn 2 (collector/anomaly) — **chỉ khi đề bắt buộc** | B xong |

Quy ước chung nằm ở mục 0 của từng issue (cùng một nội dung; bản gốc dùng để sinh: `00-shared-conventions.md`). Nếu sửa quy ước, sửa ở `00-shared-conventions.md` rồi cập nhật lại cả 4 issue để không lệch nhau.

**Đã dựng sẵn để các issue không dẫm chân nhau:** `frontend/css/map.css` (của C), `frontend/css/forecast.css` (của D) đã được liên kết trong `index.html`; `api.getCurrentAll()` trong `js/api.js`; `REFRESH_MINUTES` trong `js/config.js`; `frontend/mock/current-all.json`.
