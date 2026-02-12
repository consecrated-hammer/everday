import asyncio
import logging
import os
import time
import uuid
import warnings
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SAWarning

from app.core.bootstrap import EnsureDatabaseSetup
from app.core.logging import setup_logging
from app.core.migrations import RunMigrations
import app.db as db_module
from app.modules.auth.router import router as auth_router
from app.modules.core.router import router as core_router
from app.modules.budget.router import router as budget_router
from app.modules.settings.router import router as settings_router
from app.modules.health.router import router as health_router
from app.modules.kids.router import router as kids_router
from app.modules.shopping.router import router as shopping_router
from app.modules.integrations.alexa.router import router as alexa_router
from app.modules.life_admin.router import router as life_admin_router
from app.modules.life_admin.documents_router import router as life_admin_documents_router
from app.modules.notifications.router import router as notifications_router
from app.modules.tasks.router import router as tasks_router
from app.modules.integrations.google.router import router as google_router
from app.modules.integrations.gmail.router import router as gmail_router
from app.modules.integrations.gmail.models import GmailIntegration
from app.modules.notes.routes.notes import router as notes_router
from app.modules.health.services.reminders_service import RunDailyHealthReminders
from app.modules.kids.services.reminders_service import RunDailyKidsReminders
from app.modules.life_admin import gmail_intake_service
from app.modules.life_admin import documents_service

setup_logging()
warnings.filterwarnings(
    "ignore",
    message="Unrecognized server version info",
    category=SAWarning,
)

app = FastAPI(title="Everday API")
logger = logging.getLogger("app.request")
startup_logger = logging.getLogger("app.startup")
reminders_logger = logging.getLogger("app.reminders")
kids_reminders_logger = logging.getLogger("app.kids_reminders")
gmail_intake_logger = logging.getLogger("app.gmail_intake")
_reminders_task: asyncio.Task | None = None
_reminders_stop_event = asyncio.Event()
_kids_reminders_task: asyncio.Task | None = None
_kids_reminders_stop_event = asyncio.Event()
_gmail_intake_task: asyncio.Task | None = None
_gmail_intake_stop_event = asyncio.Event()

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


def _append_fallback_request_log(message: str) -> None:
    if logger.handlers or logger.propagate:
        return
    log_path = os.getenv("LOG_FILE_PATH", "/app/logs/backend.log")
    if not os.path.isabs(log_path):
        log_path = os.path.abspath(log_path)
    log_dir = os.path.dirname(log_path)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(f"{timestamp} INFO app.request {message}\n")


def _append_fallback_startup_log(message: str) -> None:
    log_path = os.getenv("LOG_FILE_PATH", "/app/logs/backend.log")
    if not os.path.isabs(log_path):
        log_path = os.path.abspath(log_path)
    log_dir = os.path.dirname(log_path)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(f"{timestamp} ERROR app.startup {message}\n")


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def request_logger(request: Request, call_next):
    # Force re-enable all logging (uvicorn disables specific loggers)
    logging.disable(logging.NOTSET)
    logger.disabled = False
    
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    is_health_check = request.url.path in {"/api/health", "/api/health/db"}
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = int((time.perf_counter() - start) * 1000)
        parts = [f"{request.method} {request.url.path}"]
        parts.append(f"ip={_resolve_client_ip(request)}")
        if request.url.query:
            parts.append(f"query={request.url.query}")
        parts.append("ERROR: unhandled exception")
        parts.append("status=500")
        parts.append(f"{duration_ms}ms")
        log_msg = " | ".join(parts)
        logger.exception(log_msg)
        _append_fallback_request_log(log_msg)
        raise

    duration_ms = int((time.perf_counter() - start) * 1000)

    # Build diagnostic context
    client_ip = _resolve_client_ip(request)
    parts = [f"{request.method} {request.url.path}"]
    parts.append(f"ip={client_ip}")

    # Add query params if present
    if request.url.query:
        parts.append(f"query={request.url.query}")

    # Add status with context
    status = response.status_code
    if status >= 400:
        if status == 404:
            parts.append("ERROR: endpoint not found")
        elif status >= 500:
            parts.append("ERROR: server error")
        else:
            parts.append("ERROR: client error")

    parts.append(f"status={status}")
    parts.append(f"{duration_ms}ms")

    # Log with appropriate level
    log_msg = " | ".join(parts)

    if not (is_health_check and status == 200):
        if status >= 500:
            logger.error(log_msg)
        elif status >= 400:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
        _append_fallback_request_log(log_msg)
        
        _append_fallback_request_log(log_msg)

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
app.include_router(shopping_router)
app.include_router(alexa_router)
app.include_router(life_admin_router)
app.include_router(life_admin_documents_router)
app.include_router(notifications_router)
app.include_router(tasks_router)
app.include_router(google_router)
app.include_router(gmail_router)
app.include_router(notes_router)

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
    await _run_startup_db_tasks()
    global _reminders_task
    if _reminders_task is None or _reminders_task.done():
        _reminders_stop_event.clear()
        _reminders_task = asyncio.create_task(_health_reminders_loop())
    global _kids_reminders_task
    if _kids_reminders_task is None or _kids_reminders_task.done():
        _kids_reminders_stop_event.clear()
        _kids_reminders_task = asyncio.create_task(_kids_reminders_loop())
    global _gmail_intake_task
    if _gmail_intake_task is None or _gmail_intake_task.done():
        _gmail_intake_stop_event.clear()
        _gmail_intake_task = asyncio.create_task(_gmail_intake_loop())


@app.on_event("shutdown")
async def shutdown_tasks() -> None:
    global _reminders_task
    _reminders_stop_event.set()
    if _reminders_task and not _reminders_task.done():
        _reminders_task.cancel()
    global _kids_reminders_task
    _kids_reminders_stop_event.set()
    if _kids_reminders_task and not _kids_reminders_task.done():
        _kids_reminders_task.cancel()
    global _gmail_intake_task
    _gmail_intake_stop_event.set()
    if _gmail_intake_task and not _gmail_intake_task.done():
        _gmail_intake_task.cancel()


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return default


async def _health_reminders_loop() -> None:
    enabled = _env_bool("HEALTH_REMINDERS_SCHEDULER_ENABLED", True)
    if not enabled:
        reminders_logger.info("health reminders scheduler disabled via env")
        return

    interval_seconds = max(30, _env_int("HEALTH_REMINDERS_INTERVAL_SECONDS", 60))
    admin_user_id = _env_int("HEALTH_REMINDERS_ADMIN_USER_ID", 1)
    reminders_logger.info(
        "health reminders scheduler started (interval=%ss, admin_user_id=%s)",
        interval_seconds,
        admin_user_id,
    )

    while not _reminders_stop_event.is_set():
        started = time.perf_counter()
        try:
            db_module._ensure_engine()
            db = db_module.SessionLocal()
            try:
                result = RunDailyHealthReminders(db, admin_user_id=admin_user_id)
                reminders_logger.info(
                    "health reminders run complete eligible=%s processed=%s sent=%s skipped=%s errors=%s",
                    result.get("EligibleUsers", 0),
                    result.get("ProcessedUsers", 0),
                    result.get("NotificationsSent", 0),
                    result.get("Skipped", 0),
                    result.get("Errors", 0),
                )
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            reminders_logger.exception("health reminders scheduler run failed")

        elapsed_seconds = int(time.perf_counter() - started)
        sleep_for = max(1, interval_seconds - elapsed_seconds)
        try:
            await asyncio.wait_for(_reminders_stop_event.wait(), timeout=sleep_for)
        except asyncio.TimeoutError:
            continue


async def _kids_reminders_loop() -> None:
    enabled = _env_bool("KIDS_REMINDERS_SCHEDULER_ENABLED", True)
    if not enabled:
        kids_reminders_logger.info("kids reminders scheduler disabled via env")
        return

    interval_seconds = max(30, _env_int("KIDS_REMINDERS_INTERVAL_SECONDS", 60))
    admin_user_id = _env_int("KIDS_REMINDERS_ADMIN_USER_ID", 1)
    kids_reminders_logger.info(
        "kids reminders scheduler started (interval=%ss, admin_user_id=%s)",
        interval_seconds,
        admin_user_id,
    )

    while not _kids_reminders_stop_event.is_set():
        started = time.perf_counter()
        try:
            db_module._ensure_engine()
            db = db_module.SessionLocal()
            try:
                result = RunDailyKidsReminders(db, actor_user_id=admin_user_id)
                kids_reminders_logger.info(
                    "kids reminders run complete eligible=%s processed=%s sent=%s skipped=%s errors=%s",
                    result.get("EligibleKids", 0),
                    result.get("ProcessedKids", 0),
                    result.get("NotificationsSent", 0),
                    result.get("Skipped", 0),
                    result.get("Errors", 0),
                )
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            kids_reminders_logger.exception("kids reminders scheduler run failed")

        elapsed_seconds = int(time.perf_counter() - started)
        sleep_for = max(1, interval_seconds - elapsed_seconds)
        try:
            await asyncio.wait_for(_kids_reminders_stop_event.wait(), timeout=sleep_for)
        except asyncio.TimeoutError:
            continue


async def _gmail_intake_loop() -> None:
    enabled = _env_bool("GMAIL_INTAKE_SCHEDULER_ENABLED", False)
    if not enabled:
        gmail_intake_logger.info("gmail intake scheduler disabled via env")
        return

    interval_seconds = max(60, _env_int("GMAIL_INTAKE_INTERVAL_SECONDS", 600))
    owner_user_id = _env_int("GMAIL_INTAKE_OWNER_USER_ID", 0)
    max_messages = max(1, _env_int("GMAIL_INTAKE_MAX_MESSAGES", 10))
    gmail_intake_logger.info(
        "gmail intake scheduler started (interval=%ss, owner_user_id=%s, max_messages=%s)",
        interval_seconds,
        owner_user_id,
        max_messages,
    )

    while not _gmail_intake_stop_event.is_set():
        started = time.perf_counter()
        try:
            db_module._ensure_engine()
            db = db_module.SessionLocal()
            try:
                resolved_owner = owner_user_id
                if resolved_owner <= 0:
                    record = db.query(GmailIntegration).first()
                    resolved_owner = record.ConnectedByUserId if record else 0
                if resolved_owner <= 0:
                    gmail_intake_logger.warning("gmail intake skipped: owner user not resolved")
                elif not gmail_intake_service.CanStartIntake(
                    db, owner_user_id=resolved_owner, min_seconds=interval_seconds
                ):
                    gmail_intake_logger.info("gmail intake skipped: previous run still running")
                else:
                    result, document_ids = gmail_intake_service.RunGmailIntake(
                        db,
                        owner_user_id=resolved_owner,
                        max_messages=max_messages,
                        triggered_by_user_id=resolved_owner,
                    )
                    for document_id in document_ids:
                        documents_service.RunAiAnalysis(db, document_id=document_id)
                    gmail_intake_logger.info(
                        "gmail intake run complete messages=%s documents=%s errors=%s",
                        result.get("MessagesProcessed", 0),
                        result.get("DocumentsCreated", 0),
                        len(result.get("AttachmentErrors") or []),
                    )
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            gmail_intake_logger.exception("gmail intake scheduler run failed")

        elapsed_seconds = int(time.perf_counter() - started)
        sleep_for = max(1, interval_seconds - elapsed_seconds)
        try:
            await asyncio.wait_for(_gmail_intake_stop_event.wait(), timeout=sleep_for)
        except asyncio.TimeoutError:
            continue


async def _run_startup_db_tasks() -> None:
    retries = _env_int("DB_STARTUP_RETRIES", 12)
    delay_seconds = _env_float("DB_STARTUP_RETRY_SECONDS", 5.0)
    startup_logger.info(
        "startup tasks scheduled (retries=%s, delay=%ss)",
        retries,
        delay_seconds,
    )
    for attempt in range(1, retries + 1):
        try:
            await asyncio.to_thread(EnsureDatabaseSetup)
            await asyncio.to_thread(RunMigrations)
            startup_logger.info("startup complete")
            return
        except Exception as exc:  # noqa: BLE001
            if attempt >= retries:
                startup_logger.exception(
                    "startup failed after %s attempts, aborting startup: %s",
                    attempt,
                    exc,
                )
                _append_fallback_startup_log(f"startup failed after {attempt} attempts: {exc}")
                raise
            startup_logger.warning(
                "startup attempt %s failed, retrying in %ss: %s",
                attempt,
                delay_seconds,
                exc,
            )
            await asyncio.sleep(delay_seconds)
