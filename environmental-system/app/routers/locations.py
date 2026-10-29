"""/api/locations — router mẫu, các router khác viết theo cùng pattern."""
from typing import Literal

from fastapi import APIRouter, Query
from sqlmodel import select

from app.errors import error_responses
from app.models import Location
from app.routers.deps import LocationDep, SessionDep
from app.schemas import Envelope, LocationOut, Meta

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get(
    "",
    response_model=Envelope[list[LocationOut]],
    summary="Danh sách địa điểm",
    description="Danh sách các địa điểm hỗ trợ kèm tọa độ và vùng miền (lọc tùy chọn qua query region: north, central, south).",
    responses=error_responses(400),
)
def list_locations(
    session: SessionDep,
    region: Literal["north", "central", "south"] | None = Query(default=None, description="Lọc theo miền"),
):
    statement = select(Location).order_by(Location.id)
    if region is not None:
        statement = statement.where(Location.region == region)
    locations = session.exec(statement).all()
    return Envelope(
        data=[LocationOut.model_validate(loc) for loc in locations],
        meta=Meta(count=len(locations)),
    )


@router.get(
    "/{location_id}",
    response_model=Envelope[LocationOut],
    summary="Chi tiết một địa điểm",
    description="Chi tiết một địa điểm theo ID (tên, slug, tọa độ, vùng miền).",
    responses=error_responses(400, 404),
)
def read_location(location: LocationDep):
    return Envelope(data=LocationOut.model_validate(location))
