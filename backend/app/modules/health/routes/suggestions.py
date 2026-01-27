from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import DailyAiSuggestionsRunResponse, SuggestionsResponse
from app.modules.health.services.ai_suggestions_service import GetAiSuggestions
from app.modules.health.services.daily_ai_service import RunDailyAiSuggestions


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
