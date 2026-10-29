"""Cấu hình ứng dụng, đọc từ biến môi trường hoặc file `.env`.

Mọi giá trị "có thể đổi theo máy/môi trường" phải nằm ở đây, không hardcode
trong router/service. Xem `.env.example` để biết danh sách biến.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent      # thư mục hero-api/
FRONTEND_DIR = BASE_DIR / "frontend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "Weather & AQI API"
    app_version: str = "0.1.0"

    # SQLite file nằm cạnh code; đổi được qua DATABASE_URL.
    database_url: str = f"sqlite:///{(BASE_DIR / 'weather.db').as_posix()}"

    # Open-Meteo (không cần API key)
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_air_quality_url: str = "https://air-quality-api.open-meteo.com/v1/air-quality"
    http_timeout_seconds: float = 10.0

    # Cache kết quả gọi Open-Meteo (giây)
    cache_ttl_seconds: int = 900

    # Số worker chạy song song khi lấy tóm tắt mọi địa điểm (/api/current)
    overview_max_workers: int = 8

    # Chỉ cần khi chạy frontend ở port khác (VD Live Server 5500).
    # Mặc định frontend do FastAPI phục vụ cùng origin nên để trống.
    # VD trong .env: CORS_ORIGINS=["http://localhost:5500","http://127.0.0.1:5500"]
    cors_origins: list[str] = []

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
