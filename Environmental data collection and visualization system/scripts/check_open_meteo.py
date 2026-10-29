"""Gọi Open-Meteo THẬT cho các địa điểm trong seed và in tóm tắt để kiểm tra WeatherService.

Chạy từ thư mục hero-api (đã kích hoạt .venv):
    python -m scripts.check_open_meteo            # tất cả địa điểm
    python -m scripts.check_open_meteo ha-noi     # một địa điểm theo slug

Không ghi DB. Mỗi địa điểm in: current, số điểm hourly/daily, số giờ có AQI.
Nếu có lỗi 502/503 hoặc trường bất thường là null → gửi output này để sửa services/weather.py.
"""
import sys

from app.models import Location
from app.seed import LOCATIONS
from app.services.weather import WeatherService


def main() -> int:
    wanted = set(sys.argv[1:])
    service = WeatherService()
    failures = 0
    for number, item in enumerate(LOCATIONS, start=1):
        # id phải khác nhau: cache của service khóa theo location.id
        loc = Location(id=number, **item)
        if wanted and loc.slug not in wanted:
            continue
        try:
            current, _ = service.current(loc)
            fc, _ = service.forecast(loc, hours=168, days=7)
        except Exception as exc:  # noqa: BLE001 - script kiểm tra, in mọi lỗi
            failures += 1
            print(f"[LỖI] {loc.slug}: {type(exc).__name__}: {exc}")
            continue
        nulls = [k for k, v in current.model_dump().items() if v is None]
        with_aqi = sum(1 for h in fc.hourly if h.us_aqi is not None)
        print(
            f"[OK] {loc.slug:<14} {current.temperature_c}°C  AQI={current.us_aqi} ({current.aqi_category.value if current.aqi_category else None})  "
            f"hourly={len(fc.hourly)} (có AQI: {with_aqi})  daily={len(fc.daily)}  "
            f"first_hour={fc.hourly[0].time:%Y-%m-%d %H:%M}Z  null_current={nulls or '-'}"
        )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
