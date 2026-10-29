"""Lỗi của ứng dụng và exception handler.

Mọi lỗi trả ra ĐỀU có dạng { "error": { "code", "message", "details"? } }.
Trong code: raise một subclass của AppError, không raise HTTPException trực tiếp.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas import ErrorResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, *, details: list[dict] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = 404

    def __init__(self, resource: str, resource_id: object):
        self.code = f"{resource.upper()}_NOT_FOUND"
        super().__init__(f"{resource.capitalize()} {resource_id} does not exist")


class UpstreamError(AppError):
    """Open-Meteo trả lỗi hoặc dữ liệu không đọc được."""
    status_code = 502
    code = "UPSTREAM_ERROR"


class UpstreamUnavailable(AppError):
    """Không kết nối được / timeout khi gọi Open-Meteo."""
    status_code = 503
    code = "UPSTREAM_UNAVAILABLE"


class NotImplementedFeature(AppError):
    """Dùng cho phần chưa làm xong, để frontend nhận lỗi rõ ràng thay vì 500."""
    status_code = 501
    code = "NOT_IMPLEMENTED"


# Dùng trong `responses=` của route để Swagger hiển thị đúng các lỗi.
def error_responses(*status_codes: int) -> dict:
    descriptions = {
        400: "Tham số không hợp lệ",
        404: "Không tìm thấy",
        501: "Chưa được triển khai",
        502: "Nguồn dữ liệu trả lỗi",
        503: "Không kết nối được nguồn dữ liệu",
    }
    return {
        code: {"model": ErrorResponse, "description": descriptions.get(code, "Lỗi")}
        for code in status_codes
    }


def _error_json(status_code: int, code: str, message: str, details=None) -> JSONResponse:
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


_HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return _error_json(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in err["loc"]), "message": err["msg"]}
            for err in exc.errors()
        ]
        return _error_json(400, "VALIDATION_ERROR", "Invalid request parameters", details)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = _HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
        return _error_json(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        logger.exception("Unhandled error: %s", exc)
        return _error_json(500, "INTERNAL_ERROR", "Internal server error")
