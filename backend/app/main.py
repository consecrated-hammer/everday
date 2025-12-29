import logging
import os
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging
from app.modules.core.router import router as core_router

setup_logging()

app = FastAPI(title="Everday API")
logger = logging.getLogger("app.request")
startup_logger = logging.getLogger("app.startup")
startup_logger.info("startup complete")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
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
    return response


app.include_router(core_router)
