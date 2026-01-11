import json
import logging
import os
import time
from logging.handlers import RotatingFileHandler


def _get_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y"}


class LocalTimeFormatter(logging.Formatter):
    converter = time.localtime


def setup_logging() -> None:
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_file_path = os.getenv("LOG_FILE_PATH", "/app/logs/backend.log")
    frontend_log_file_path = os.getenv("FRONTEND_LOG_FILE_PATH", "/app/logs/frontend.log")
    max_bytes = int(os.getenv("LOG_MAX_BYTES", "5000000"))
    backup_count = int(os.getenv("LOG_BACKUP_COUNT", "5"))
    json_enabled = _get_bool(os.getenv("LOG_JSON_ENABLED", "false"))

    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
    os.makedirs(os.path.dirname(frontend_log_file_path), exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()
    
    # Force enable logging (uvicorn may disable it)
    logging.disable(logging.NOTSET)

    formatter = LocalTimeFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if json_enabled:
        formatter = LocalTimeFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    backend_file_handler = RotatingFileHandler(
        log_file_path, maxBytes=max_bytes, backupCount=backup_count
    )
    backend_file_handler.setLevel(log_level)
    backend_file_handler.setFormatter(formatter)

    frontend_file_handler = RotatingFileHandler(
        frontend_log_file_path, maxBytes=max_bytes, backupCount=backup_count
    )
    frontend_file_handler.setLevel(log_level)
    frontend_file_handler.setFormatter(formatter)

    root_logger.addHandler(console_handler)
    root_logger.addHandler(backend_file_handler)

    request_logger = logging.getLogger("app.request")
    request_logger.handlers.clear()
    request_logger.propagate = False
    request_logger.setLevel(log_level)
    request_logger.addHandler(console_handler)
    request_logger.addHandler(backend_file_handler)

    frontend_logger = logging.getLogger("frontend")
    frontend_logger.handlers.clear()
    frontend_logger.propagate = False
    frontend_logger.setLevel(log_level)
    frontend_logger.addHandler(console_handler)
    frontend_logger.addHandler(frontend_file_handler)

    for logger_name in (
        "app.request",
        "app.startup",
        "app.bootstrap",
        "app.migrations",
        "app.auth",
        "app.auth.email",
        "integrations.alexa",
        "integrations.alexa.skill",
    ):
        logging.getLogger(logger_name).setLevel(log_level)

    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers.clear()
    uvicorn_access.propagate = False
    uvicorn_access.setLevel(log_level)
    uvicorn_access.addHandler(console_handler)
    uvicorn_access.addHandler(backend_file_handler)


def format_frontend_message(message: str, context: dict | None = None) -> str:
    if not context:
        return message
    payload = {"message": message, "context": context}
    return json.dumps(payload, separators=(",", ":"))
