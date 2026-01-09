import logging
import os
import time
import uuid
import warnings
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SAWarning

from app.core.bootstrap import EnsureDatabaseSetup
from app.core.logging import setup_logging
from app.core.migrations import RunMigrations
from app.modules.auth.router import router as auth_router
from app.modules.core.router import router as core_router
from app.modules.budget.router import router as budget_router
from app.modules.settings.router import router as settings_router
from app.modules.health.router import router as health_router
from app.modules.kids.router import router as kids_router

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
app.include_router(kids_router)

class SpaStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = None
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
        if response is not None and response.status_code != 404:
            return response
        if scope.get("method") not in {"GET", "HEAD"}:
            raise StarletteHTTPException(status_code=404)
        if path.startswith("api/") or Path(path).suffix:
            raise StarletteHTTPException(status_code=404)
        return await super().get_response("index.html", scope)


static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/", SpaStaticFiles(directory=static_dir, html=True), name="static")


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
