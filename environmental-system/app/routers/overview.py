"""/api/current: weather + AQI summary for all locations."""
from fastapi import APIRouter
from sqlmodel import select

from app.errors import error_responses
from app.models import Location
from app.routers.deps import SessionDep, WeatherServiceDep
from app.schemas import CurrentSummary, Envelope, Meta

router = APIRouter(prefix="/api", tags=["weather"])


@router.get(
    "/current",
    response_model=Envelope[list[CurrentSummary]],
    summary="Weather + AQI summary for all locations",
    description="Summary weather and AQI for every location in one call (used to color map markers). Locations that fail are skipped.",
    responses=error_responses(502, 503),
)
def current_all(session: SessionDep, service: WeatherServiceDep):
    locations = session.exec(select(Location).order_by(Location.id)).all()
    items = service.current_many(locations)
    cached = getattr(items, "cached", None)
    return Envelope(data=items, meta=Meta(count=len(items), cached=cached))
