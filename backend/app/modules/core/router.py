import logging
import os
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.logging import format_frontend_message

router = APIRouter(prefix="/api", tags=["health"])
logger = logging.getLogger("core.health")
frontend_logger = logging.getLogger("frontend")


@router.get("/health")
async def api_health() -> dict:
    logger.debug("health check ok")
    return {"status": "ok"}


@router.get("/health/db")
async def api_health_db() -> dict:
    try:
        import pyodbc
    except ImportError:
        logger.exception("db check failed: pyodbc unavailable")
        return {"status": "error", "detail": "database unavailable"}

    driver = os.getenv("SQLSERVER_DRIVER", "")
    host = os.getenv("SQLSERVER_HOST", "")
    port = os.getenv("SQLSERVER_PORT", "")
    database = os.getenv("SQLSERVER_DB", "")
    user = os.getenv("SQLSERVER_USER_LOGIN", "")
    password = os.getenv("SQLSERVER_USER_PASSWORD", "")

    missing = [key for key, value in {
        "SQLSERVER_HOST": host,
        "SQLSERVER_PORT": port,
        "SQLSERVER_DB": database,
        "SQLSERVER_USER_LOGIN": user,
        "SQLSERVER_USER_PASSWORD": password,
        "SQLSERVER_DRIVER": driver,
    }.items() if not value]
    if missing:
        logger.error("db check failed: missing database configuration: %s", ", ".join(missing))
        return {"status": "error", "detail": "database unavailable"}

    connection_string = (
        "DRIVER={%s};SERVER=%s,%s;DATABASE=%s;UID=%s;PWD=%s;"
        "Encrypt=yes;TrustServerCertificate=yes;Connection Timeout=3"
        % (driver, host, port, database, user, password)
    )

    try:
        with pyodbc.connect(connection_string) as connection:
            cursor = connection.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
        logger.debug("db check ok")
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("db check failed")
        return {"status": "error", "detail": "database unavailable"}


class FrontendLogPayload(BaseModel):
    level: str = Field(default="info", max_length=16)
    message: str = Field(..., max_length=2000)
    context: dict | None = None


@router.post("/logs")
async def api_logs(payload: FrontendLogPayload, request: Request) -> dict:
    level = payload.level.lower()
    metadata = {
        "ip": request.client.host if request.client else "unknown",
        "ua": request.headers.get("user-agent", "unknown"),
    }
    message = format_frontend_message(payload.message, {**metadata, **(payload.context or {})})

    if level == "debug":
        frontend_logger.debug(message)
    elif level == "warning":
        frontend_logger.warning(message)
    elif level == "error":
        frontend_logger.error(message)
    else:
        frontend_logger.info(message)

    logger.debug("frontend log received")
    return {"status": "ok", "timestamp": time.time()}
