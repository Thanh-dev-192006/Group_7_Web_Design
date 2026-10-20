"""Kết nối SQLite và dependency session.

- `get_session` là dependency được override trong test (xem tests/conftest.py).
- Bảng được tạo bằng `create_all` (không dùng Alembic ở giai đoạn này).
"""
from typing import Annotated

from fastapi import Depends
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings


def make_engine(url: str, **kwargs) -> Engine:
    """Tạo engine; với SQLite bật WAL + foreign keys cho mỗi connection."""
    is_sqlite = url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    engine = create_engine(url, connect_args=connect_args, **kwargs)

    if is_sqlite:
        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):
            cursor = dbapi_conn.cursor()
            # WAL: collector (GĐ2) ghi trong khi API đọc mà không bị khóa.
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = make_engine(settings.database_url)


def init_db(target: Engine = engine) -> None:
    # Import để SQLModel biết các bảng trước khi create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(target)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
