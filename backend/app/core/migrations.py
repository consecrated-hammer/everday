from pathlib import Path
import logging
import os
import threading
import time
import traceback

from alembic import command
from alembic.config import Config

from app.db import BuildAdminConnectionUrl

logger = logging.getLogger("app.migrations")


def _append_fallback_migration_log(message: str) -> None:
    log_path = os.getenv("LOG_FILE_PATH", "/app/logs/backend.log")
    if not os.path.isabs(log_path):
        log_path = os.path.abspath(log_path)
    log_dir = os.path.dirname(log_path)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(f"{timestamp} ERROR app.migrations {message}\n")


def _read_int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def RunMigrations() -> None:
    config_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    if not config_path.exists():
        raise RuntimeError("Missing alembic.ini for migrations")

    alembic_cfg = Config(str(config_path))
    alembic_cfg.set_main_option("sqlalchemy.url", BuildAdminConnectionUrl())
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    timeout_seconds = _read_int_env("MIGRATIONS_TIMEOUT_SECONDS", 600)
    progress_seconds = _read_int_env("MIGRATIONS_PROGRESS_LOG_SECONDS", 20)

    logger.info(
        "running migrations (timeout=%ss, progress_log=%ss)",
        timeout_seconds,
        progress_seconds,
    )

    error: dict[str, str] = {}
    done = threading.Event()

    def _run() -> None:
        try:
            command.upgrade(alembic_cfg, "head")
        except Exception:  # noqa: BLE001
            error["trace"] = traceback.format_exc()
        finally:
            done.set()

    thread = threading.Thread(target=_run, name="alembic-upgrade", daemon=True)
    thread.start()
    start = time.monotonic()

    while not done.wait(timeout=progress_seconds):
        elapsed = int(time.monotonic() - start)
        logger.info("migrations still running (%ss elapsed)", elapsed)
        if timeout_seconds > 0 and elapsed >= timeout_seconds:
            logger.error("migrations timed out after %ss", elapsed)
            _append_fallback_migration_log(f"migrations timed out after {elapsed}s")
            raise TimeoutError(f"migrations timed out after {elapsed}s")

    if "trace" in error:
        logger.error("migrations failed:\n%s", error["trace"])
        _append_fallback_migration_log("migrations failed (see traceback in logs)")
        raise RuntimeError("migrations failed")

    logger.info("migrations complete")
