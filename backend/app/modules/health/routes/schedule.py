from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import ScheduleSlotsResponse, ScheduleSlotsUpdateInput
from app.modules.health.services.schedule_service import GetScheduleSlots, UpdateScheduleSlots

router = APIRouter()


@router.get("", response_model=ScheduleSlotsResponse)
def GetScheduleRoute(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> ScheduleSlotsResponse:
    slots = GetScheduleSlots(db, user.Id)
    return ScheduleSlotsResponse(Slots=slots)


@router.put("", response_model=ScheduleSlotsResponse)
def UpdateScheduleRoute(
    payload: ScheduleSlotsUpdateInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> ScheduleSlotsResponse:
    try:
        slots = UpdateScheduleSlots(db, user.Id, payload.Slots)
        return ScheduleSlotsResponse(Slots=slots)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
