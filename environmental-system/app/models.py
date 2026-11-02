"""Database tables. API schemas live in `app/schemas.py` so DB changes don't alter the API contract."""
from sqlmodel import Field, SQLModel


class Location(SQLModel, table=True):
    """A fixed measurement point (city); initial data in app/seed.py."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)            # Display name, e.g. "Hà Nội"
    slug: str = Field(unique=True, index=True)  # e.g. "ha-noi"
    region: str                                # "north" | "central" | "south"
    lat: float
    lon: float


# ---------------------------------------------------------------------------
# Phase 2 (collector + anomaly), not used yet. Keep the (location_id, collected_at)
# index for history queries.
#
# from datetime import datetime
# from sqlalchemy import Index
#
# class Reading(SQLModel, table=True):
#     __table_args__ = (Index("ix_reading_location_time", "location_id", "collected_at"),)
#     id: int | None = Field(default=None, primary_key=True)
#     location_id: int = Field(foreign_key="location.id")
#     collected_at: datetime            # always UTC
#     temperature_c: float | None = None
#     humidity_pct: float | None = None
#     pm2_5: float | None = None
#     us_aqi: float | None = None
#     is_anomaly: bool = False
# ---------------------------------------------------------------------------
