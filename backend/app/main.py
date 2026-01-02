import logging
import os
import time
import uuid
import warnings

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SAWarning

from app.core.bootstrap import EnsureDatabaseSetup
from app.core.logging import setup_logging
from app.core.migrations import RunMigrations
from app.modules.auth.router import router as auth_router
from app.modules.core.router import router as core_router
from app.modules.budget.router import router as budget_router
from app.modules.settings.router import router as settings_router
from app.modules.health.router import router as health_router

setup_logging()
warnings.filterwarnings(
    "ignore",
    message="Unrecognized server version info",
    category=SAWarning,
)

app = FastAPI(title="Everday API")
logger = logging.getLogger("app.request")
startup_logger = logging.getLogger("app.startup")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
if not allowed_origins:
    raise RuntimeError("Missing required env var: ALLOWED_ORIGINS")
origin_list = [origin.strip() for origin in allowed_origins.split(",") if origin.strip()]

if origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def request_logger(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    
    # Build diagnostic context
    parts = [f"{request.method} {request.url.path}"]
    
    # Add query params if present
    if request.url.query:
        parts.append(f"query={request.url.query}")
    
    # Add status with context
    status = response.status_code
    if status >= 400:
        if status == 404:
            parts.append(f"ERROR: endpoint not found")
        elif status >= 500:
            parts.append(f"ERROR: server error")
        else:
            parts.append(f"ERROR: client error")
    
    parts.append(f"status={status}")
    parts.append(f"{duration_ms}ms")
    
    # Log with appropriate level
    log_msg = " | ".join(parts)
    if status >= 500:
        logger.error(log_msg)
    elif status >= 400:
        logger.warning(log_msg)
    else:
        logger.info(log_msg)
    
    response.headers["X-Request-Id"] = request_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response


app.include_router(core_router)
app.include_router(auth_router)
app.include_router(budget_router)
app.include_router(settings_router)
app.include_router(health_router)


@app.on_event("startup")
async def startup_tasks() -> None:
    try:
        setup_logging()
        EnsureDatabaseSetup()
        RunMigrations()
        startup_logger.info("startup complete")
    except Exception:
        startup_logger.exception("startup failed")
        raise
