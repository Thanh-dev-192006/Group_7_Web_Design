"""Fixture dùng chung.

- DB: SQLite in-memory (StaticPool) đã seed → không đụng tới weather.db thật.
- Weather service: FakeWeatherService trả dữ liệu cố định → test không cần mạng.
- TestClient KHÔNG dùng `with` → lifespan (tạo DB thật) không chạy trong test.
"""
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app import models  # noqa: F401 — đăng ký bảng
from app.database import get_session
from app.main import app
from app.schemas import CurrentWeather, DailyPoint, Forecast, HourlyPoint
from app.seed import seed_locations
from app.services.aqi import category_from_us_aqi
from app.services.cache import TTLCache
from app.services.weather import WeatherService, get_weather_service

FIXED_TIME = datetime(2026, 10, 21, 3, 0, tzinfo=timezone.utc)


class FakeWeatherService(WeatherService):
    """Giữ nguyên logic cache của WeatherService, chỉ thay phần lấy dữ liệu."""

    def __init__(self, fail_for: dict[int | None, Exception] | None = None):
        super().__init__(client=object(), cache=TTLCache(ttl_seconds=60))
        self.calls = 0
        self.fail_for: dict[int | None, Exception] = fail_for or {}

    def _build_current(self, location):
        if location.id in self.fail_for:
            raise self.fail_for[location.id]
        if None in self.fail_for:
            raise self.fail_for[None]
        self.calls += 1
        return CurrentWeather(
            location_id=location.id, observed_at=FIXED_TIME,
            temperature_c=28.5, humidity_pct=70, us_aqi=85,
            aqi_category=category_from_us_aqi(85),
        )

    def _build_forecast(self, location):
        if location.id in self.fail_for:
            raise self.fail_for[location.id]
        if None in self.fail_for:
            raise self.fail_for[None]
        self.calls += 1
        return Forecast(
            location_id=location.id,
            hourly=[HourlyPoint(time=FIXED_TIME, temperature_c=28.0) for _ in range(168)],
            daily=[DailyPoint(date=date(2026, 10, 21), temperature_max_c=31, temperature_min_c=24)
                   for _ in range(7)],
        )


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_locations(session)
        yield session


@pytest.fixture(name="weather_service")
def weather_service_fixture():
    return FakeWeatherService()


@pytest.fixture(name="client")
def client_fixture(session, weather_service):
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_weather_service] = lambda: weather_service
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    app.dependency_overrides.clear()
