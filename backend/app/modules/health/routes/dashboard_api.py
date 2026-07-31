from __future__ import annotations

import logging
import threading
import time

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.api_tokens import (
    ApiTokenContext,
    ApiTokenRequestError,
    HEALTH_DASHBOARD_READ_SCOPE,
    RequireApiToken,
)
from app.modules.health.services.dashboard_api_service import BuildDashboardResponse


router = APIRouter(prefix="/api/v1/health", tags=["health-dashboard-api"])
logger = logging.getLogger("health.dashboard_api")


class _TokenRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self._limit = limit
        self._window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, token_id: str) -> bool:
        now = time.monotonic()
        with self._lock:
            threshold = now - self._window_seconds
            for key, values in list(self._requests.items()):
                active_values = [value for value in values if value > threshold]
                if active_values:
                    self._requests[key] = active_values
                else:
                    self._requests.pop(key, None)
            timestamps = self._requests.get(token_id, [])
            if len(timestamps) >= self._limit:
                self._requests[token_id] = timestamps
                return False
            timestamps.append(now)
            self._requests[token_id] = timestamps
            return True


rate_limiter = _TokenRateLimiter(limit=60, window_seconds=3600)


def _Window(value: str, *, name: str, default: int, maximum: int) -> int:
    candidate = value or str(default)
    try:
        parsed = int(candidate)
    except (TypeError, ValueError) as exc:
        raise ApiTokenRequestError(status.HTTP_400_BAD_REQUEST, "invalid_parameter", f"{name} must be an integer.") from exc
    if not 7 <= parsed <= maximum:
        raise ApiTokenRequestError(
            status.HTTP_400_BAD_REQUEST, "invalid_parameter", f"{name} must be between 7 and {maximum}."
        )
    return parsed


@router.get("/dashboard")
def GetDashboardApi(
    request: Request,
    weightDays: str = Query(default="90"),
    stepDays: str = Query(default="30"),
    daySummaryDays: str = Query(default="14"),
    db: Session = Depends(GetDb),
    token: ApiTokenContext = Depends(RequireApiToken(HEALTH_DASHBOARD_READ_SCOPE)),
) -> dict:
    if not rate_limiter.allow(token.TokenId):
        raise ApiTokenRequestError(status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited", "Rate limit exceeded.")
    weight_days = _Window(weightDays, name="weightDays", default=90, maximum=365)
    step_days = _Window(stepDays, name="stepDays", default=30, maximum=365)
    day_summary_days = _Window(daySummaryDays, name="daySummaryDays", default=14, maximum=90)
    started = time.perf_counter()
    try:
        response = BuildDashboardResponse(
            db,
            token.UserId,
            weight_days=weight_days,
            step_days=step_days,
            day_summary_days=day_summary_days,
        )
        logger.info(
            "dashboard API token_id=%s user_id=%s status=200 duration_ms=%s ip=%s",
            token.TokenId,
            token.UserId,
            int((time.perf_counter() - started) * 1000),
            request.client.host if request.client else "unknown",
        )
        return response
    except Exception:
        logger.exception("dashboard API token_id=%s user_id=%s status=500", token.TokenId, token.UserId)
        raise ApiTokenRequestError(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal_error",
            "The dashboard data could not be loaded.",
        ) from None
