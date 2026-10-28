"""/api/locations/{id}/current và /forecast.

Router đã xong (validate, 404, envelope, cache flag). Phần dữ liệu thật nằm ở
app/services/weather.py (TODO) — khi chưa xong, endpoint trả 501 NOT_IMPLEMENTED.
"""
from fastapi import APIRouter, Query

from app.errors import error_responses
from app.routers.deps import LocationDep, WeatherServiceDep
from app.schemas import CurrentWeather, Envelope, Forecast, Meta

router = APIRouter(prefix="/api/locations", tags=["weather"])

UPSTREAM_ERRORS = error_responses(400, 404, 501, 502, 503)


@router.get(
    "/{location_id}/current",
    response_model=Envelope[CurrentWeather],
    summary="Thời tiết + AQI hiện tại",
    responses=UPSTREAM_ERRORS,
)
def current_weather(location: LocationDep, service: WeatherServiceDep):
    data, cached = service.current(location)
    return Envelope(data=data, meta=Meta(cached=cached))


@router.get(
    "/{location_id}/forecast",
    response_model=Envelope[Forecast],
    summary="Dự báo theo giờ và theo ngày",
    responses=UPSTREAM_ERRORS,
)
def forecast(
    location: LocationDep,
    service: WeatherServiceDep,
    hours: int = Query(default=48, ge=1, le=168, description="Số giờ dự báo tính từ hiện tại"),
    days: int = Query(default=7, ge=1, le=7, description="Số ngày dự báo (tối đa 7)"),
):
    data, cached = service.forecast(location, hours=hours, days=days)
    return Envelope(data=data, meta=Meta(cached=cached))
