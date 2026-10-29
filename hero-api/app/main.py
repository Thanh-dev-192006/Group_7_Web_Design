"""Điểm vào ứng dụng.

Chạy:  fastapi dev app/main.py   → http://127.0.0.1:8000  (web)
                                    http://127.0.0.1:8000/docs  (Swagger)

File này chỉ lắp ráp: router, exception handler, CORS (tùy chọn), frontend.
Không viết logic nghiệp vụ ở đây.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from app.config import FRONTEND_DIR, settings
from app.database import engine, init_db
from app.errors import register_exception_handlers
from app.routers import health, locations, overview, weather
from app.seed import seed_locations

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with Session(engine) as session:
        seed_locations(session)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API thời tiết và chất lượng không khí cho các thành phố Việt Nam. "
        "Dữ liệu từ [Open-Meteo](https://open-meteo.com/). "
        "Mọi response thành công có dạng `{data, meta}`, mọi lỗi có dạng `{error: {code, message}}`."
    ),
    lifespan=lifespan,
)

register_exception_handlers(app)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

app.include_router(locations.router)
app.include_router(overview.router)
app.include_router(weather.router)
app.include_router(health.router)


def _custom_openapi():
    """Bỏ response 422 mặc định của FastAPI khỏi Swagger,
    vì lỗi validation được đổi thành 400 VALIDATION_ERROR (app/errors.py)."""
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title, version=app.version, description=app.description, routes=app.routes,
    )
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            operation.get("responses", {}).pop("422", None)
    for name in ("HTTPValidationError", "ValidationError"):
        schema.get("components", {}).get("schemas", {}).pop(name, None)
    app.openapi_schema = schema
    return schema


app.openapi = _custom_openapi

# Frontend được phục vụ cùng origin → không cần CORS. Mount SAU cùng
# để các route /api/* được ưu tiên.
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
