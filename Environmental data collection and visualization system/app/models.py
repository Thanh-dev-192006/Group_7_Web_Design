"""Bảng trong database (SQLModel, table=True).

Schema trả ra API KHÔNG nằm ở đây mà ở `app/schemas.py`, để thay đổi DB
không vô tình làm đổi hợp đồng API.
"""
from sqlmodel import Field, SQLModel


class Location(SQLModel, table=True):
    """Một điểm đo cố định (thành phố). Dữ liệu ban đầu: app/seed.py."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)            # Tên hiển thị, VD "Hà Nội"
    slug: str = Field(unique=True, index=True)  # VD "ha-noi"
    region: str                                # "north" | "central" | "south"
    lat: float
    lon: float


# ---------------------------------------------------------------------------
# GĐ2 (collector + anomaly) — CHƯA dùng. Bỏ comment khi bắt đầu GĐ2.
# Nhớ: index (location_id, collected_at) cho truy vấn lịch sử.
#
# from datetime import datetime
# from sqlalchemy import Index
#
# class Reading(SQLModel, table=True):
#     __table_args__ = (Index("ix_reading_location_time", "location_id", "collected_at"),)
#     id: int | None = Field(default=None, primary_key=True)
#     location_id: int = Field(foreign_key="location.id")
#     collected_at: datetime            # luôn lưu UTC
#     temperature_c: float | None = None
#     humidity_pct: float | None = None
#     pm2_5: float | None = None
#     us_aqi: float | None = None
#     is_anomaly: bool = False
# ---------------------------------------------------------------------------
