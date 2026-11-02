"""API contract (responses). Changing any schema here requires updating
`docs/API.md` and `frontend/mock/*.json` in the same PR.
"""
from datetime import date, datetime, timezone
from enum import Enum
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field


# ---------- Shared types ----------
def _ensure_utc(value: datetime) -> datetime:
    """SQLite and Open-Meteo (timezone=GMT) return naive datetimes; all datetimes are UTC, so attach tzinfo to serialize as `...Z`."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UTCDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


T = TypeVar("T")


class Meta(BaseModel):
    generated_at: UTCDatetime = Field(default_factory=utc_now)
    count: int | None = None        # item count when `data` is a list
    cached: bool | None = None      # True if served from cache without calling Open-Meteo


class Envelope(BaseModel, Generic[T]):
    """Every successful response: { "data": ..., "meta": {...} }."""
    data: T
    meta: Meta = Field(default_factory=Meta)


class ErrorBody(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "code": "LOCATION_NOT_FOUND",
                    "message": "Location 99 does not exist",
                    "details": None,
                }
            ]
        }
    )

    code: str = Field(examples=["LOCATION_NOT_FOUND"])
    message: str = Field(examples=["Location 99 does not exist"])
    details: list[dict] | None = None


class ErrorResponse(BaseModel):
    """Every error response: { "error": { "code", "message", "details"? } }."""
    error: ErrorBody


# ---------- AQI ----------
class AqiCategory(str, Enum):
    """US EPA scale, derived from `us_aqi` (see app/services/aqi.py)."""
    good = "good"
    moderate = "moderate"
    unhealthy_sensitive = "unhealthy_sensitive"
    unhealthy = "unhealthy"
    very_unhealthy = "very_unhealthy"
    hazardous = "hazardous"


# ---------- Locations ----------
class LocationOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": 1,
                    "name": "Hà Nội",
                    "slug": "ha-noi",
                    "region": "north",
                    "lat": 21.0285,
                    "lon": 105.8542,
                }
            ]
        },
    )

    id: int
    name: str
    slug: str
    region: str
    lat: float
    lon: float


# ---------- Weather ----------
class CurrentWeather(BaseModel):
    """Current weather + AQI for a location; missing values are null."""
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "location_id": 1,
                    "observed_at": "2026-10-21T03:00:00Z",
                    "temperature_c": 27.4,
                    "apparent_temperature_c": 29.8,
                    "humidity_pct": 78.0,
                    "wind_speed_kmh": 9.4,
                    "wind_direction_deg": 120.0,
                    "precipitation_mm": 0.0,
                    "weather_code": 2,
                    "is_day": True,
                    "pm2_5": 38.2,
                    "us_aqi": 108.0,
                    "aqi_category": "unhealthy_sensitive",
                }
            ]
        }
    )

    location_id: int
    observed_at: UTCDatetime
    temperature_c: float | None = None
    apparent_temperature_c: float | None = None
    humidity_pct: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    precipitation_mm: float | None = None
    weather_code: int | None = Field(default=None, description="WMO weather code")
    is_day: bool | None = None
    pm2_5: float | None = Field(default=None, description="µg/m³")
    us_aqi: float | None = None
    aqi_category: AqiCategory | None = None


class CurrentSummary(BaseModel):
    """Weather + AQI summary for a location (used to color the map); missing values are null."""
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "location_id": 1,
                    "observed_at": "2026-10-21T03:00:00Z",
                    "temperature_c": 27.4,
                    "weather_code": 2,
                    "is_day": True,
                    "us_aqi": 108.0,
                    "aqi_category": "unhealthy_sensitive",
                }
            ]
        }
    )

    location_id: int
    observed_at: UTCDatetime
    temperature_c: float | None = None
    weather_code: int | None = Field(default=None, description="WMO weather code")
    is_day: bool | None = None
    us_aqi: float | None = None
    aqi_category: AqiCategory | None = None


class HourlyPoint(BaseModel):
    time: UTCDatetime
    temperature_c: float | None = None
    precipitation_probability_pct: float | None = None
    precipitation_mm: float | None = None
    weather_code: int | None = None
    pm2_5: float | None = None
    us_aqi: float | None = None
    aqi_category: AqiCategory | None = None


class DailyPoint(BaseModel):
    date: date  # UTC date
    temperature_max_c: float | None = None
    temperature_min_c: float | None = None
    precipitation_sum_mm: float | None = None
    precipitation_probability_max_pct: float | None = None
    weather_code: int | None = None


class Forecast(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "location_id": 1,
                    "hourly": [
                        {
                            "time": "2026-10-21T03:00:00Z",
                            "temperature_c": 25.9,
                            "precipitation_probability_pct": 0.0,
                            "precipitation_mm": 0.0,
                            "weather_code": 1,
                            "pm2_5": 24.1,
                            "us_aqi": 69.0,
                            "aqi_category": "moderate",
                        }
                    ],
                    "daily": [
                        {
                            "date": "2026-10-21",
                            "temperature_max_c": 31.0,
                            "temperature_min_c": 23.0,
                            "precipitation_sum_mm": 1.2,
                            "precipitation_probability_max_pct": 60.0,
                            "weather_code": 61,
                        }
                    ],
                }
            ]
        }
    )

    location_id: int
    hourly: list[HourlyPoint]
    daily: list[DailyPoint]


# ---------- Health ----------
class Health(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "status": "ok",
                    "version": "0.1.0",
                    "database": "ok",
                    "cache_entries": 3,
                }
            ]
        }
    )

    status: str = Field(examples=["ok"])
    version: str
    database: str = Field(examples=["ok"])
    cache_entries: int
