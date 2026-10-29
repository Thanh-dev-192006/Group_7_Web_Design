"""/api/current — tóm tắt thời tiết + AQI mọi địa điểm."""
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
    summary="Tóm tắt thời tiết + AQI mọi địa điểm",
    description="Thời tiết và AQI tóm tắt của tất cả địa điểm trong một lần gọi (dùng để tô màu marker bản đồ). Địa điểm lỗi bị bỏ qua.",
    responses=error_responses(502, 503),
)
def current_all(session: SessionDep, service: WeatherServiceDep):
    locations = session.exec(select(Location).order_by(Location.id)).all()
    items = service.current_many(locations)
    cached = getattr(items, "cached", None)
    return Envelope(data=items, meta=Meta(count=len(items), cached=cached))
