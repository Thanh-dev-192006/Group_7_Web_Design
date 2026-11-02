"""Application settings, read from environment variables or `.env` (see `.env.example`)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent      # environmental-system/
FRONTEND_DIR = BASE_DIR / "frontend"


class Settings(BaseSettings):
    # Machine/environment-dependent values live here; do not hardcode them in routers/services.
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "Weather & AQI API"
    app_version: str = "0.1.0"

    database_url: str = f"sqlite:///{(BASE_DIR / 'weather.db').as_posix()}"

    # Open-Meteo needs no API key
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_air_quality_url: str = "https://air-quality-api.open-meteo.com/v1/air-quality"
    http_timeout_seconds: float = 10.0

    # Open-Meteo cache TTL, seconds
    cache_ttl_seconds: int = 900

    # Parallel workers for /api/current
    overview_max_workers: int = 8

    # Empty by default: FastAPI serves the frontend from the same origin.
    # e.g. .env: CORS_ORIGINS=["http://localhost:5500","http://127.0.0.1:5500"]
    cors_origins: list[str] = []

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
