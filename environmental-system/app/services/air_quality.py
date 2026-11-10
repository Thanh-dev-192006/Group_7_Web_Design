"""Validation and normalisation of the raw Open-Meteo air-quality payload.

The raw JSON is validated once, right after the fetch, into `AirQuality`; only that form is cached and merged,
so a malformed reply can never poison the cache or break serving. Values must be numbers or None (NaN/inf become None).
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

Reading = tuple[float | None, float | None]       # (pm2_5, us_aqi)
_EMPTY: Reading = (None, None)


@dataclass(frozen=True)
class AirQuality:
    current: Reading | None = None                                   # the payload's `current` block
    hourly: dict[datetime, Reading] = field(default_factory=dict)    # UTC hour -> reading

    def has_data(self) -> bool:
        return self.current is not None or any(r != _EMPTY for r in self.hourly.values())

    def at(self, hour: datetime) -> Reading | None:
        """Reading for a UTC hour, or None when that hour is missing or empty."""
        reading = self.hourly.get(hour)
        return reading if reading is not None and reading != _EMPTY else None


NO_AIR_QUALITY = AirQuality()


def _number(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"expected a number or null, got {type(value).__name__}")
    return value if math.isfinite(value) else None      # NaN / inf count as missing


def _utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:                     # air quality is requested in GMT
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _column(block: dict, key: str, length: int) -> list:
    values = block.get(key)
    if values is None:
        return [None] * length
    if not isinstance(values, list):
        raise TypeError(f"'{key}' must be a list")
    return [values[i] if i < len(values) else None for i in range(length)]


def _parse_current(block) -> Reading | None:
    if block is None:
        return None
    if not isinstance(block, dict):
        raise TypeError("'current' must be an object")
    reading = (_number(block.get("pm2_5")), _number(block.get("us_aqi")))
    return None if reading == _EMPTY else reading


def _parse_hourly(block) -> dict[datetime, Reading]:
    if block is None:
        return {}
    if not isinstance(block, dict) or not isinstance(block.get("time"), list):
        raise TypeError("'hourly' must be an object with a 'time' list")
    times = block["time"]
    pm25, aqi = _column(block, "pm2_5", len(times)), _column(block, "us_aqi", len(times))
    return {_utc(t): (_number(pm25[i]), _number(aqi[i])) for i, t in enumerate(times)}


def normalise(payload) -> AirQuality:
    """Validate a raw payload. Raises ValueError/TypeError/KeyError/AttributeError on a bad shape and
    ValueError when there is no usable data at all."""
    if not isinstance(payload, dict):
        raise TypeError("air-quality payload must be an object")
    air = AirQuality(_parse_current(payload.get("current")), _parse_hourly(payload.get("hourly")))
    if not air.has_data():
        raise ValueError("air-quality payload has no usable data")
    return air
