"""Dependency dùng chung giữa các router."""
from typing import Annotated

from fastapi import Depends, Path
from sqlmodel import Session

from app.database import SessionDep
from app.errors import NotFoundError
from app.models import Location
from app.services.weather import WeatherService, get_weather_service

WeatherServiceDep = Annotated[WeatherService, Depends(get_weather_service)]


def get_location_or_404(
    session: SessionDep,
    location_id: Annotated[int, Path(ge=1, description="ID địa điểm (từ GET /api/locations)")],
) -> Location:
    location = session.get(Location, location_id)
    if location is None:
        raise NotFoundError("location", location_id)
    return location


LocationDep = Annotated[Location, Depends(get_location_or_404)]

__all__ = ["SessionDep", "Session", "WeatherServiceDep", "LocationDep"]
