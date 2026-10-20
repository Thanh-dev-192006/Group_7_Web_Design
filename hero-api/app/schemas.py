"""Hợp đồng API (request/response). Frontend code theo file này + docs/API.md.

QUY TẮC: đổi bất kỳ schema nào ở đây thì phải cập nhật cùng lúc
`docs/API.md` và `frontend/mock/*.json` trong cùng một PR.
"""
from datetime import date, datetime, timezone
from enum import Enum
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field


# ---------- Kiểu dùng chung ----------
def _ensure_utc(value: datetime) -> datetime:
    """SQLite và Open-Meteo (timezone=GMT) trả datetime không có tzinfo.
    Quy ước: mọi datetime là UTC → gắn tzinfo để JSON ra dạng `...Z`."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UTCDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


T = TypeVar("T")


class Meta(BaseModel):
    generated_at: UTCDatetime = Field(default_factory=utc_now)
    count: int | None = None        # số phần tử khi `data` là list
    cached: bool | None = None      # True nếu lấy từ cache, không gọi Open-Meteo


class Envelope(BaseModel, Generic[T]):
    """Mọi response thành công: { "data": ..., "meta": {...} }."""
    data: T
    meta: Meta = Field(default_factory=Meta)


class ErrorBody(BaseModel):
    code: str = Field(examples=["LOCATION_NOT_FOUND"])
    message: str = Field(examples=["Location 99 does not exist"])
    details: list[dict] | None = None


class ErrorResponse(BaseModel):
    """Mọi response lỗi: { "error": { "code", "message", "details"? } }."""
    error: ErrorBody


# ---------- AQI ----------
class AqiCategory(str, Enum):
    """Thang US EPA, tính từ `us_aqi` (xem app/services/aqi.py)."""
    good = "good"
    moderate = "moderate"
    unhealthy_sensitive = "unhealthy_sensitive"
    unhealthy = "unhealthy"
    very_unhealthy = "very_unhealthy"
    hazardous = "hazardous"


# ---------- Locations ----------
class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    region: str
    lat: float
    lon: float


# ---------- Weather ----------
class CurrentWeather(BaseModel):
    """Thời tiết + AQI hiện tại của một địa điểm. Giá trị thiếu là null."""
    location_id: int
    observed_at: UTCDatetime
    temperature_c: float | None = None
    apparent_temperature_c: float | None = None
    humidity_pct: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    precipitation_mm: float | None = None
    weather_code: int | None = Field(default=None, description="Mã thời tiết WMO")
    is_day: bool | None = None
    pm2_5: float | None = Field(default=None, description="µg/m³")
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
    date: date  # ngày theo UTC
    temperature_max_c: float | None = None
    temperature_min_c: float | None = None
    precipitation_sum_mm: float | None = None
    precipitation_probability_max_pct: float | None = None
    weather_code: int | None = None


class Forecast(BaseModel):
    location_id: int
    hourly: list[HourlyPoint]
    daily: list[DailyPoint]


# ---------- Health ----------
class Health(BaseModel):
    status: str = Field(examples=["ok"])
    version: str
    database: str = Field(examples=["ok"])
    cache_entries: int
