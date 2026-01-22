from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import (
    CreateDailyLogInput,
    CreateMealEntryInput,
    DailyLog,
    DailySummary,
    DailyTotals,
    MealEntry,
    MealEntryWithFood,
    ShareMealEntryInput,
    StepsHistoryResponse,
    StepUpdateInput,
    Targets,
    UpdateMealEntryInput,
    WeightHistoryResponse,
)
from app.modules.health.services.calculations import BuildDailySummary, CalculateDailyTotals
from app.modules.health.services.daily_logs_service import (
    CreateMealEntry,
    DeleteMealEntry,
    GetDailyLogByDate,
    GetWeightHistory,
    GetStepsHistory,
    GetEntriesForLog,
    ShareMealEntry,
    UpdateMealEntry,
    UpdateSteps,
    UpsertDailyLog,
)
from app.modules.health.services.settings_service import GetSettings
from app.modules.health.utils.rbac import IsParent

router = APIRouter()


class DailyLogResponse(BaseModel):
    DailyLog: Optional[DailyLog]
    Entries: list[MealEntryWithFood]
    Totals: DailyTotals
    Summary: DailySummary
    Targets: Targets


class DailyLogCreateResponse(BaseModel):
    DailyLog: DailyLog


class MealEntryResponse(BaseModel):
    MealEntry: MealEntry


@router.post("", response_model=DailyLogCreateResponse, status_code=status.HTTP_201_CREATED)
def CreateDailyLogRoute(
    payload: CreateDailyLogInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> DailyLogCreateResponse:
    try:
        daily_log = UpsertDailyLog(db, user.Id, payload)
        return DailyLogCreateResponse(DailyLog=daily_log)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{log_date}", response_model=DailyLogResponse)
def GetDailyLog(
    log_date: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> DailyLogResponse:
    daily_log = GetDailyLogByDate(db, user.Id, log_date)
    settings = GetSettings(db, user.Id)

    if daily_log is None:
        empty_totals = CalculateDailyTotals([], 0, settings.StepKcalFactor, settings)
        empty_summary = BuildDailySummary(log_date, 0, empty_totals)
        return DailyLogResponse(
            DailyLog=None,
            Entries=[],
            Totals=empty_totals,
            Summary=empty_summary,
            Targets=settings,
        )

    entries = GetEntriesForLog(db, user.Id, daily_log.DailyLogId)
    step_factor = (
        daily_log.StepKcalFactorOverride
        if daily_log.StepKcalFactorOverride is not None
        else settings.StepKcalFactor
    )
    totals = CalculateDailyTotals(entries, daily_log.Steps, step_factor, settings)
    summary = BuildDailySummary(daily_log.LogDate, daily_log.Steps, totals)

    return DailyLogResponse(
        DailyLog=daily_log,
        Entries=entries,
        Totals=totals,
        Summary=summary,
        Targets=settings,
    )


@router.get("/weights/history", response_model=WeightHistoryResponse)
def GetWeightHistoryRoute(
    start_date: str,
    end_date: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> WeightHistoryResponse:
    try:
        weights = GetWeightHistory(db, user.Id, start_date, end_date)
        return WeightHistoryResponse(Weights=weights)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/steps/history", response_model=StepsHistoryResponse)
def GetStepsHistoryRoute(
    start_date: str,
    end_date: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> StepsHistoryResponse:
    try:
        steps = GetStepsHistory(db, user.Id, start_date, end_date)
        return StepsHistoryResponse(Steps=steps)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{log_date}/steps", response_model=DailyLogCreateResponse)
def UpdateStepsRoute(
    log_date: str,
    payload: StepUpdateInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> DailyLogCreateResponse:
    try:
        daily_log = UpdateSteps(
            db,
            user.Id,
            log_date,
            payload.Steps,
            payload.StepKcalFactorOverride,
            payload.WeightKg,
        )
        return DailyLogCreateResponse(DailyLog=daily_log)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/meal-entries", response_model=MealEntryResponse, status_code=status.HTTP_201_CREATED)
def CreateMealEntryRoute(
    payload: CreateMealEntryInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealEntryResponse:
    try:
        meal_entry = CreateMealEntry(db, user.Id, payload)
        return MealEntryResponse(MealEntry=meal_entry)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/meal-entries/share", response_model=MealEntryResponse, status_code=status.HTTP_201_CREATED)
def ShareMealEntryRoute(
    payload: ShareMealEntryInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealEntryResponse:
    try:
        meal_entry = ShareMealEntry(db, user.Id, payload, IsAdmin=IsParent(user))
        return MealEntryResponse(MealEntry=meal_entry)
    except ValueError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_403_FORBIDDEN
            if "Unauthorized" in detail
            else status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.patch("/meal-entries/{meal_entry_id}", response_model=MealEntryResponse)
def UpdateMealEntryRoute(
    meal_entry_id: str,
    payload: UpdateMealEntryInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealEntryResponse:
    try:
        meal_entry = UpdateMealEntry(db, user.Id, meal_entry_id, payload)
        return MealEntryResponse(MealEntry=meal_entry)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/meal-entries/{meal_entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteMealEntryRoute(
    meal_entry_id: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> Response:
    try:
        DeleteMealEntry(db, user.Id, meal_entry_id, IsAdmin=IsParent(user))
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
