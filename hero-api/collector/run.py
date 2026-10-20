"""GĐ2 — Collector thu thập định kỳ (CHƯA làm).

Chạy như một tiến trình RIÊNG, độc lập với API:
    python -m collector.run

Kế hoạch (xem claude/project-context.md, mục 3):
1. Bỏ comment model `Reading` trong app/models.py.
2. Thêm `APScheduler>=3.10,<4` vào requirements.txt (bản 4.x đổi API).
3. Mỗi 30–60 phút: với từng Location, gọi OpenMeteoClient (app/services/open_meteo.py),
   lấy giá trị hiện tại, tính is_anomaly, ghi một Reading (thời gian UTC).
4. Anomaly rule: PM2.5 tăng > 50% so với trung bình 3–5 lần đọc gần nhất
   VÀ vượt ngưỡng tuyệt đối tối thiểu; hoặc us_aqi > 150.
   → viết thành hàm thuần (pure function) trong app/services/anomaly.py để test dễ.
5. Mỗi lần gọi bọc try/except + log, lỗi một địa điểm không dừng cả vòng.

Dùng lại engine từ app/database.py (đã bật WAL).
"""


def main() -> None:
    raise SystemExit("Collector chưa được triển khai (GĐ2). Xem docstring của collector/run.py.")


if __name__ == "__main__":
    main()
