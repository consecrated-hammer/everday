import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.health.schemas import HaeImportResponse
from app.modules.health.services.hae_import_service import ImportHealthAutoExportPayload
from app.modules.health.services.settings_service import ResolveUserIdByHaeApiKey

router = APIRouter()
logger = logging.getLogger("health.imports")


def _ResolveApiKey(request: Request) -> str | None:
    header_key = request.headers.get("X-API-Key")
    if header_key:
        return header_key.strip()
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "", 1).strip()
    if auth_header:
        return auth_header
    return None


def RequireHaeApiKey(request: Request, db: Session = Depends(GetDb)) -> int:
    api_key = _ResolveApiKey(request)
    if not api_key:
        logger.warning("health import blocked: missing API key")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key required")

    user_id = ResolveUserIdByHaeApiKey(db, api_key)
    if user_id is None:
        logger.warning("health import blocked: invalid API key")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    return user_id


@router.post("/hae", response_model=HaeImportResponse)
async def ImportHaeRoute(
    request: Request,
    db: Session = Depends(GetDb),
    user_id: int = Depends(RequireHaeApiKey),
) -> HaeImportResponse:
    logger.info("health import received user_id=%s", user_id)
    try:
        payload = await request.json()
    except ValueError as exc:
        logger.warning("health import rejected: invalid json user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON") from exc

    if not isinstance(payload, dict):
        logger.warning("health import rejected: invalid payload user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")

    result = ImportHealthAutoExportPayload(db, user_id, payload)
    logger.info(
        "health import processed user_id=%s metrics=%s workouts=%s steps_updated=%s weight_updated=%s",
        user_id,
        result.MetricsCount,
        result.WorkoutsCount,
        result.StepsUpdated,
        result.WeightUpdated,
    )
    return HaeImportResponse(
        ImportId=result.ImportId,
        MetricsCount=result.MetricsCount,
        WorkoutsCount=result.WorkoutsCount,
        StepsUpdated=result.StepsUpdated,
        WeightUpdated=result.WeightUpdated,
    )
