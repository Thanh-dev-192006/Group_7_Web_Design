"""Call the REAL Open-Meteo for the seeded locations and print a summary to check WeatherService.

Run from environmental-system/ with the .venv activated:
    python -m scripts.check_open_meteo            # all locations
    python -m scripts.check_open_meteo ha-noi     # one location by slug

Does not write to the DB. Prints current values, hourly/daily counts and hours with AQI.
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
        # ids must be unique: the service cache is keyed by location.id
        loc = Location(id=number, **item)
        if wanted and loc.slug not in wanted:
            continue
        try:
            current, _ = service.current(loc)
            fc, _ = service.forecast(loc, hours=168, days=7)
        except Exception as exc:  # noqa: BLE001 - check script, print every error
            failures += 1
            print(f"[ERROR] {loc.slug}: {type(exc).__name__}: {exc}")
            continue
        nulls = [k for k, v in current.model_dump().items() if v is None]
        with_aqi = sum(1 for h in fc.hourly if h.us_aqi is not None)
        print(
            f"[OK] {loc.slug:<14} {current.temperature_c}°C  AQI={current.us_aqi} ({current.aqi_category.value if current.aqi_category else None})  "
            f"hourly={len(fc.hourly)} (with AQI: {with_aqi})  daily={len(fc.daily)}  "
            f"first_hour={fc.hourly[0].time:%Y-%m-%d %H:%M}Z  null_current={nulls or '-'}"
        )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
