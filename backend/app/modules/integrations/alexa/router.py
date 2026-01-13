import json
import logging
import threading
import time
import uuid

from ask_sdk_core.exceptions import AskSdkException
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.models import User
from app.modules.integrations.alexa.skill import BuildSkillHandler, LoadAlexaConfig, ResetAlexaContext, SetAlexaContext

router = APIRouter(prefix="/api/alexa", tags=["alexa"])
logger = logging.getLogger("integrations.alexa")

class _RateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = {}

    def Allow(self, key: str, limit: int, window_seconds: int) -> bool:
        if limit <= 0 or window_seconds <= 0:
            return True
        now = time.time()
        with self._lock:
            entry = self._state.get(key)
            if not entry or now - entry["start"] > window_seconds:
                self._state[key] = {"start": now, "count": 1}
                return True
            if entry["count"] >= limit:
                return False
            entry["count"] += 1
            return True


_rate_limiter = _RateLimiter()


def _extract_application_id(payload: dict) -> str | None:
    context = payload.get("context") or {}
    system = context.get("System") or {}
    app = system.get("application") or {}
    app_id = app.get("applicationId")
    if app_id:
        return app_id

    session = payload.get("session") or {}
    app = session.get("application") or {}
    return app.get("applicationId")


def _extract_request_context(payload: dict) -> tuple[str, str, str]:
    request = payload.get("request") or {}
    context = payload.get("context") or {}
    system = context.get("System") or {}
    user = system.get("user") or {}
    request_id = request.get("requestId") or "unknown"
    intent = request.get("intent") or {}
    intent_name = intent.get("name") or request.get("type") or "unknown"
    user_id = user.get("userId") or "unknown"
    return request_id, intent_name, user_id


def _alexa_text_response(message: str) -> JSONResponse:
    payload = {
        "version": "1.0",
        "response": {
            "outputSpeech": {"type": "PlainText", "text": message},
            "shouldEndSession": True,
        },
    }
    return JSONResponse(content=payload)


def _require_service_user_access(db: Session, user_id: int, write: bool) -> None:
    user = db.query(User).filter(User.Id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if user.Role != "Parent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.post("", response_class=Response)
async def AlexaWebhook(
    request: Request,
    db: Session = Depends(GetDb),
) -> Response:
    logger.info("Alexa webhook called")
    correlation_id = str(uuid.uuid4())
    
    try:
        config = LoadAlexaConfig()
        logger.debug("Alexa config loaded: enabled=%s", config.Enabled)
    except Exception as exc:
        logger.exception("Failed to load Alexa config")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Configuration error") from exc
    
    if not config.Enabled:
        logger.warning("Alexa integration is disabled")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    content_type = request.headers.get("content-type", "").lower()
    logger.debug("Request content-type: %s", content_type)
    if "application/json" not in content_type:
        logger.warning("Unsupported content type: %s", content_type)
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported content type")

    client_host = request.client.host if request.client else "unknown"
    if not _rate_limiter.Allow(
        client_host,
        config.RateLimitRequests,
        config.RateLimitWindowSeconds,
    ):
        logger.warning("Rate limit exceeded for client: %s", client_host)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")

    body = await request.body()
    logger.debug("Request body size: %d bytes", len(body) if body else 0)
    if not body:
        logger.warning("Empty request body")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")
    if len(body) > config.MaxBodyBytes:
        logger.warning("Request body too large: %d > %d", len(body), config.MaxBodyBytes)
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Payload too large")

    try:
        payload_text = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        logger.warning("Failed to decode request body as UTF-8")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request") from exc

    try:
        payload = json.loads(payload_text)
        logger.debug("Request payload parsed successfully")
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse JSON payload: %s", str(exc))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request") from exc
    request_id, intent_name, user_id = _extract_request_context(payload)

    if config.SkillId:
        application_id = _extract_application_id(payload)
        logger.debug("Application ID from payload: %s", application_id)
        if not application_id or application_id != config.SkillId:
            logger.warning("Application ID mismatch: expected=%s, got=%s", config.SkillId, application_id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    tokens = None
    if config.ServiceUserId is None:
        logger.warning(
            "Alexa user not mapped correlation_id=%s request_id=%s intent=%s user_id=%s",
            correlation_id,
            request_id,
            intent_name,
            user_id,
        )
        return _alexa_text_response("I can't find your Everday account yet.")

    try:
        _require_service_user_access(db, config.ServiceUserId, write=True)
        logger.debug("Service user access validated: user_id=%s", config.ServiceUserId)
    except HTTPException:
        logger.warning(
            "Alexa user not mapped correlation_id=%s request_id=%s intent=%s user_id=%s",
            correlation_id,
            request_id,
            intent_name,
            user_id,
        )
        return _alexa_text_response("I can't find your Everday account yet.")
    except Exception as exc:
        logger.exception(
            "Alexa access validation error correlation_id=%s request_id=%s intent=%s user_id=%s",
            correlation_id,
            request_id,
            intent_name,
            user_id,
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Access validation error") from exc

    try:
        logger.debug("Building skill handler and setting context")
        skill_handler = BuildSkillHandler(config)
        tokens = SetAlexaContext(db, config, correlation_id=correlation_id)
        logger.debug("Dispatching request to skill handler")
        response_body = skill_handler.verify_request_and_dispatch(
            dict(request.headers),
            payload_text,
        )
        logger.info("Alexa request processed successfully")
    except AskSdkException as exc:
        logger.exception(
            "Alexa request rejected correlation_id=%s request_id=%s intent=%s user_id=%s",
            correlation_id,
            request_id,
            intent_name,
            user_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request") from exc
    except Exception as exc:
        logger.exception(
            "Unexpected error processing Alexa request correlation_id=%s request_id=%s intent=%s user_id=%s",
            correlation_id,
            request_id,
            intent_name,
            user_id,
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Processing error") from exc
    finally:
        if tokens:
            ResetAlexaContext(tokens)

    if isinstance(response_body, dict):
        return JSONResponse(content=response_body)
    return Response(content=response_body, media_type="application/json")
