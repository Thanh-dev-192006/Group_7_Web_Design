"""/api/health: quick system check."""
import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.routers.deps import SessionDep, WeatherServiceDep
from app.schemas import Envelope, Health

router = APIRouter(prefix="/api", tags=["system"])
logger = logging.getLogger(__name__)


@router.get(
    "/health",
    response_model=Envelope[Health],
    summary="System status",
    description="Database connectivity and number of cached entries.",
)
def health(session: SessionDep, service: WeatherServiceDep):
    try:
        session.exec(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001 - health must not fail the request
        logger.warning("DB health check failed: %s", exc)
        db_status = "error"
    return Envelope(data=Health(
        status="ok" if db_status == "ok" else "degraded",
        version=settings.app_version,
        database=db_status,
        cache_entries=len(service.cache),
    ))
