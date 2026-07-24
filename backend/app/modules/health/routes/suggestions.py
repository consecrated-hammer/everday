from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import (
    DailyAiSuggestionsRunResponse,
    DailyTipRunRequest,
    DailyTipRunResponse,
    SuggestionsResponse,
)
from app.modules.health.services.ai_suggestions_service import GetAiSuggestions
from app.modules.health.services.daily_ai_service import RunDailyAiSuggestions
from app.modules.health.services.daily_tip_service import RunDailyTips


def _IsAdmin(user: UserContext) -> bool:
    return user.Role in {"Admin", "Parent"}


router = APIRouter()


@router.get("/ai", response_model=SuggestionsResponse)
def GetAiSuggestionsRoute(
    log_date: str = Query(alias="LogDate"),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> SuggestionsResponse:
    try:
        suggestions, model_used = GetAiSuggestions(db, user.Id, log_date)
        return SuggestionsResponse(Suggestions=suggestions, ModelUsed=model_used)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ai/run-daily", response_model=DailyAiSuggestionsRunResponse)
def RunDailyAiSuggestionsRoute(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> DailyAiSuggestionsRunResponse:
    if not _IsAdmin(user):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        result = RunDailyAiSuggestions(db, user.Id)
        return DailyAiSuggestionsRunResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/daily-tip/run", response_model=DailyTipRunResponse)
def RunDailyTipRoute(
    payload: DailyTipRunRequest | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> DailyTipRunResponse:
    if not _IsAdmin(user):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        result = RunDailyTips(
            db,
            admin_user_id=user.Id,
            run_date=payload.RunDate if payload else None,
            run_time=payload.RunTime if payload else None,
            slot=payload.Slot if payload else None,
            user_id=payload.UserId if payload else None,
        )
        return DailyTipRunResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
