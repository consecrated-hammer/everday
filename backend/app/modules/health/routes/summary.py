from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import WeeklySummary
from app.modules.health.services.summary_service import GetWeeklySummary

router = APIRouter()


@router.get("/weekly", response_model=WeeklySummary)
def GetWeeklySummaryRoute(
    start_date: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> WeeklySummary:
    try:
        return GetWeeklySummary(db, user.Id, start_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
