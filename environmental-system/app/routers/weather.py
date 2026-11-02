"""/api/locations/{id}/current and /forecast."""
from fastapi import APIRouter, Query

from app.errors import error_responses
from app.routers.deps import LocationDep, WeatherServiceDep
from app.schemas import CurrentWeather, Envelope, Forecast, Meta

router = APIRouter(prefix="/api/locations", tags=["weather"])

UPSTREAM_ERRORS = error_responses(400, 404, 501, 502, 503)


@router.get(
    "/{location_id}/current",
    response_model=Envelope[CurrentWeather],
    summary="Current weather + AQI",
    description="Current weather and air quality for a location. Cached for 15 minutes.",
    responses=UPSTREAM_ERRORS,
)
def current_weather(location: LocationDep, service: WeatherServiceDep):
    data, cached = service.current(location)
    return Envelope(data=data, meta=Meta(cached=cached))


@router.get(
    "/{location_id}/forecast",
    response_model=Envelope[Forecast],
    summary="Hourly and daily forecast",
    description="Weather and air-quality forecast, hourly (hours: 1-168, starting from the current UTC hour) and daily (days: 1-7).",
    responses=UPSTREAM_ERRORS,
)
def forecast(
    location: LocationDep,
    service: WeatherServiceDep,
    hours: int = Query(default=48, ge=1, le=168, description="Number of forecast hours from now (1-168)"),
    days: int = Query(default=7, ge=1, le=7, description="Number of forecast days from today (1-7)"),
):
    data, cached = service.forecast(location, hours=hours, days=days)
    return Envelope(data=data, meta=Meta(cached=cached))
