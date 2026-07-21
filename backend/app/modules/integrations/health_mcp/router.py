from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import (
    BodyMeasurementListResponse,
    ExperimentListResponse,
    Insight,
    InsightListResponse,
    ProductReviewListResponse,
    RecipeReviewListResponse,
    RecipeStatsResponse,
    UpsertBodyMeasurementInput,
    UpsertExperimentInput,
    UpsertInsightInput,
    UpsertProductReviewInput,
    UpsertWeeklyReviewNoteInput,
    WeeklyReviewNote,
    WeeklyReviewSnapshot,
    Workout as HealthWorkout,
    DailyLog as HealthDailyLog,
    DailySummary as HealthDailySummary,
    DailyTotals as HealthDailyTotals,
    MealEntryWithFood as HealthMealEntryWithFood,
    Targets as HealthTargets,
    WeightHistoryEntry,
    CreateRecipeReviewInput,
    UpdateRecipeReviewInput,
    RecipeReview,
    ProductReview,
    Experiment,
    BodyMeasurement,
    HeadacheEvent,
    MedicationDose,
    UpsertHeadacheEventInput,
    UpsertMedicationDoseInput,
)
from app.modules.health.services.symptoms_service import GetDoses, GetHeadaches, UpsertDose, UpsertHeadache
from app.modules.integrations.health_mcp.service import (
    DeleteMeal,
    DeleteWorkout,
    GetConnectionContext,
    GetExperimentHistory,
    GetHistory,
    GetMeal,
    GetMeasurementHistory,
    GetInsightHistory,
    GetProductReviewHistory,
    GetSavedFoods,
    GetStepSummary,
    GetTodayMeals,
    GetTargetsHistory,
    GetWeightTrend,
    GetWeeklyReviewNoteRecord,
    GetWeeklyReviewView,
    LogMealManual,
    SearchMeals,
    SaveFoodFromMeal,
    UpsertExperimentRecord,
    UpsertInsightRecord,
    UpsertMeasurementRecord,
    UpsertProductReviewRecord,
    UpsertWeeklyReviewNoteRecord,
    UpdateDailyLog,
    UpdateMeal,
    GetSummary,
    LogMealFromImage,
    LogMealFromText,
    UpdateWorkout,
    LogWorkout,
    LogWeight,
)
from app.modules.integrations.health_mcp.recipe_reviews import (
    DeleteRecipeReviewRecord,
    GetRecipeReviewHistory,
    GetRecipeStatsView,
    UpsertRecipeReviewRecord,
)

router = APIRouter(prefix="/api/integrations/health-mcp", tags=["integrations-health-mcp"])


class LogMealInput(BaseModel):
    Date: str = Field(min_length=1)
    MealType: str | None = None
    Note: str | None = None
    Text: str | None = None
    ImageBase64: str | None = None


class LogManualMealInput(BaseModel):
    Date: str = Field(min_length=1)
    MealType: str | None = None
    Note: str | None = None
    FoodName: str = Field(min_length=1)
    CaloriesPerServing: float = Field(ge=0)
    ProteinPerServing: float = Field(default=0, ge=0)
    FibrePerServing: float | None = Field(default=None, ge=0)
    CarbsPerServing: float | None = Field(default=None, ge=0)
    FatPerServing: float | None = Field(default=None, ge=0)
    SaturatedFatPerServing: float | None = Field(default=None, ge=0)
    SugarPerServing: float | None = Field(default=None, ge=0)
    SodiumPerServing: float | None = Field(default=None, ge=0)
    ServingQuantity: float = Field(default=1.0, gt=0)
    ServingUnit: str = Field(default="serving", min_length=1)
    Quantity: float = Field(default=1.0, gt=0)


class ParsedMealOut(BaseModel):
    FoodName: str | None = None
    MealName: str | None = None
    ServingQuantity: float | None = None
    ServingUnit: str | None = None
    CaloriesPerServing: int | None = None
    ProteinPerServing: float | None = None
    FibrePerServing: float | None = None
    CarbsPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    SugarPerServing: float | None = None
    SodiumPerServing: float | None = None
    BaseServingQuantity: float | None = None
    BaseServingUnit: str | None = None
    QuantityMultiplier: float | None = None
    ConsumedQuantity: float | None = None
    ConsumedUnit: str | None = None
    EffectiveCalories: int | None = None
    EffectiveProtein: float | None = None
    Summary: str | None = None
    Confidence: str | None = None
    Questions: list[str] = Field(default_factory=list)


class MealLogResponse(BaseModel):
    Created: bool
    Reason: str | None = None
    ParsedMeal: ParsedMealOut
    MealEntryId: str | None = None
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets


class UpdateMealInput(BaseModel):
    MealEntryId: str = Field(min_length=1)
    Date: str | None = None
    MealType: str | None = None
    Note: str | None = None
    Quantity: float | None = Field(default=None, gt=0)
    FoodName: str | None = Field(default=None, min_length=1)
    CaloriesPerServing: float | None = Field(default=None, ge=0)
    ProteinPerServing: float | None = Field(default=None, ge=0)
    FibrePerServing: float | None = Field(default=None, ge=0)
    CarbsPerServing: float | None = Field(default=None, ge=0)
    FatPerServing: float | None = Field(default=None, ge=0)
    SaturatedFatPerServing: float | None = Field(default=None, ge=0)
    SugarPerServing: float | None = Field(default=None, ge=0)
    SodiumPerServing: float | None = Field(default=None, ge=0)
    ServingQuantity: float | None = Field(default=None, gt=0)
    ServingUnit: str | None = Field(default=None, min_length=1)


class MealUpdateResponse(BaseModel):
    Updated: bool
    Reason: str | None = None
    ParsedMeal: ParsedMealOut
    MealEntryId: str
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets
    PreviousLogDate: str
    TargetLogDate: str


class MealDeleteResponse(BaseModel):
    Deleted: bool
    MealEntryId: str
    LogDate: str
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets


class MealLookupResponse(BaseModel):
    Item: dict[str, Any]


class MealsResponse(BaseModel):
    LogDate: str | None = None
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout] = Field(default_factory=list)
    Items: list[dict[str, Any]]
    Totals: HealthDailyTotals | None = None
    Summary: HealthDailySummary | None = None
    Targets: HealthTargets | None = None
    Query: str | None = None


class LogWeightInput(BaseModel):
    Date: str = Field(min_length=1)
    WeightKg: float = Field(ge=20, le=500)


class WeightLogResponse(BaseModel):
    DailyLog: HealthDailyLog
    Workouts: list[HealthWorkout]
    RecentWeights: list[WeightHistoryEntry]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets


class SummaryResponse(BaseModel):
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets


class UpdateDailyLogInput(BaseModel):
    Date: str = Field(min_length=1)
    Steps: int | None = Field(default=None, ge=0)
    StepKcalFactorOverride: float | None = Field(default=None, ge=0)
    WeightKg: float | None = Field(default=None, ge=20, le=500)
    OfficeMode: str | None = Field(default=None, min_length=1, max_length=20)
    WaterLitres: float | None = Field(default=None, ge=0, le=20)
    WalkingPadMinutes: int | None = Field(default=None, ge=0, le=1440)
    ExerciseNotes: str | None = Field(default=None, max_length=1000)
    SleepHours: float | None = Field(default=None, ge=0, le=24)
    Period: bool | None = None
    HungerBeforeDinner: int | None = Field(default=None, ge=1, le=10)
    OverallSatisfaction: int | None = Field(default=None, ge=1, le=10)
    Takeaway: bool | None = None
    LoggedComplete: bool | None = None
    AdherentDay: bool | None = None
    Notes: str | None = None


class LogWorkoutInput(BaseModel):
    Date: str = Field(min_length=1)
    WorkoutType: str = Field(min_length=1)
    WorkoutName: str = Field(min_length=1)
    DurationMinutes: float | None = Field(default=None, gt=0, le=1440)
    CaloriesBurned: int = Field(default=0, ge=0, le=20000)
    DistanceKm: float | None = Field(default=None, ge=0, le=1000)
    StartedAt: datetime | None = None
    EndedAt: datetime | None = None
    Notes: str | None = None


class WorkoutLogResponse(BaseModel):
    Workout: HealthWorkout
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets


class UpdateWorkoutInput(BaseModel):
    WorkoutId: str = Field(min_length=1)
    Date: str | None = None
    WorkoutType: str | None = None
    WorkoutName: str | None = None
    DurationMinutes: float | None = Field(default=None, gt=0, le=1440)
    CaloriesBurned: int | None = Field(default=None, ge=0, le=20000)
    DistanceKm: float | None = Field(default=None, ge=0, le=1000)
    StartedAt: datetime | None = None
    EndedAt: datetime | None = None
    Notes: str | None = None


class WorkoutUpdateResponse(BaseModel):
    Updated: bool
    Workout: HealthWorkout
    PreviousLogDate: str
    TargetLogDate: str
    DailyLog: HealthDailyLog | None = None
    Workouts: list[HealthWorkout]
    Entries: list[HealthMealEntryWithFood]
    Totals: HealthDailyTotals
    Summary: HealthDailySummary
    Targets: HealthTargets


class WorkoutDeleteResponse(BaseModel):
    Deleted: bool
    WorkoutId: str
    LogDate: str
    DeletedWorkout: HealthWorkout


class WeeklyReviewNoteResponse(BaseModel):
    Item: WeeklyReviewNote | None = None


class WeeklyReviewSnapshotResponse(BaseModel):
    Item: WeeklyReviewSnapshot


class InsightFiltersResponse(BaseModel):
    Items: list[dict[str, Any]]


class HistoryResponse(BaseModel):
    HistoryType: str
    Items: list[dict[str, Any]]


class FoodsResponse(BaseModel):
    Items: list[dict[str, Any]]


class ConnectionContextResponse(BaseModel):
    ReminderTimeZone: str
    TodayLayout: list[str]
    MealSlots: list[dict[str, Any]]
    HistoryTypes: list[dict[str, Any]]
    WorkoutTypes: list[dict[str, Any]]
    DailyLogFields: list[dict[str, Any]]


class WeightTrendResponse(BaseModel):
    Days: int
    StartDate: str
    EndDate: str
    Items: list[dict[str, Any]]
    DeltaKg: float | None = None


class StepSummaryResponse(BaseModel):
    StartDate: str
    EndDate: str
    Items: list[dict[str, Any]]
    TotalSteps: int
    AverageSteps: float
    TotalCaloriesBurnedFromSteps: int
    AverageCaloriesBurnedFromSteps: float
    StepTarget: int
    StepKcalFactor: float


class TargetsHistoryResponse(BaseModel):
    CurrentTargets: dict[str, Any]
    Items: list[dict[str, Any]]


class SaveFoodFromMealInput(BaseModel):
    MealEntryId: str = Field(min_length=1)
    FoodName: str | None = Field(default=None, min_length=1)


class SaveFoodFromMealResponse(BaseModel):
    Saved: bool
    MealEntryId: str
    Food: dict[str, Any]
    Mode: str


@router.post("/log-meal", response_model=MealLogResponse)
def LogMealRoute(
    payload: LogMealInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealLogResponse:
    has_text = bool(payload.Text and payload.Text.strip())
    has_image = bool(payload.ImageBase64 and payload.ImageBase64.strip())
    if has_text == has_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide exactly one of Text or ImageBase64.",
        )
    try:
        result = (
            LogMealFromText(db, user.Id, payload.Text or "", payload.Date, payload.MealType, payload.Note)
            if has_text
            else LogMealFromImage(
                db,
                user.Id,
                payload.ImageBase64 or "",
                payload.Date,
                payload.MealType,
                payload.Note,
            )
        )
        return MealLogResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/log-meal-manual", response_model=MealLogResponse)
def LogManualMealRoute(
    payload: LogManualMealInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealLogResponse:
    try:
        return MealLogResponse(
            **LogMealManual(
                db,
                user.Id,
                log_date=payload.Date, food_name=payload.FoodName, calories_per_serving=payload.CaloriesPerServing,
                protein_per_serving=payload.ProteinPerServing, fibre_per_serving=payload.FibrePerServing,
                carbs_per_serving=payload.CarbsPerServing, fat_per_serving=payload.FatPerServing,
                saturated_fat_per_serving=payload.SaturatedFatPerServing, sugar_per_serving=payload.SugarPerServing,
                sodium_per_serving=payload.SodiumPerServing, serving_quantity=payload.ServingQuantity,
                serving_unit=payload.ServingUnit, quantity=payload.Quantity, meal_type=payload.MealType, note=payload.Note,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/update-meal", response_model=MealUpdateResponse)
def UpdateMealRoute(
    payload: UpdateMealInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealUpdateResponse:
    try:
        return MealUpdateResponse(
            **UpdateMeal(
                db,
                user.Id,
                payload.MealEntryId,
                payload.Date,
                payload.MealType,
                payload.Note,
                payload.Quantity,
                payload.FoodName,
                payload.CaloriesPerServing,
                payload.ProteinPerServing,
                payload.FibrePerServing,
                payload.CarbsPerServing,
                payload.FatPerServing,
                payload.SaturatedFatPerServing,
                payload.SugarPerServing,
                payload.SodiumPerServing,
                payload.ServingQuantity,
                payload.ServingUnit,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/meal/{meal_entry_id}", response_model=MealDeleteResponse)
def DeleteMealRoute(
    meal_entry_id: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealDeleteResponse:
    try:
        return MealDeleteResponse(**DeleteMeal(db, user.Id, meal_entry_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/log-weight", response_model=WeightLogResponse)
def LogWeightRoute(
    payload: LogWeightInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> WeightLogResponse:
    try:
        return WeightLogResponse(**LogWeight(db, user.Id, payload.Date, payload.WeightKg))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/daily-log", response_model=SummaryResponse)
def UpdateDailyLogRoute(
    payload: UpdateDailyLogInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> SummaryResponse:
    fields = payload.model_dump(exclude_unset=True)
    fields.pop("Date", None)
    if not fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide at least one field to update.")
    try:
        return SummaryResponse(**UpdateDailyLog(db, user.Id, payload.Date, fields))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/log-workout", response_model=WorkoutLogResponse)
def LogWorkoutRoute(
    payload: LogWorkoutInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> WorkoutLogResponse:
    try:
        return WorkoutLogResponse(
            **LogWorkout(
                db,
                user.Id,
                payload.Date,
                payload.WorkoutType,
                payload.WorkoutName,
                payload.DurationMinutes,
                payload.CaloriesBurned,
                payload.DistanceKm,
                payload.StartedAt,
                payload.EndedAt,
                payload.Notes,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/update-workout", response_model=WorkoutUpdateResponse)
def UpdateWorkoutRoute(
    payload: UpdateWorkoutInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> WorkoutUpdateResponse:
    try:
        return WorkoutUpdateResponse(
            **UpdateWorkout(
                db,
                user.Id,
                payload.WorkoutId,
                payload.Date,
                payload.WorkoutType,
                payload.WorkoutName,
                payload.DurationMinutes,
                payload.CaloriesBurned,
                payload.DistanceKm,
                payload.StartedAt,
                payload.EndedAt,
                payload.Notes,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/workout/{workout_id}", response_model=WorkoutDeleteResponse)
def DeleteWorkoutRoute(
    workout_id: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> WorkoutDeleteResponse:
    try:
        return WorkoutDeleteResponse(**DeleteWorkout(db, user.Id, workout_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/summary", response_model=SummaryResponse)
def GetSummaryRoute(
    date: str = Query(..., min_length=1),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> SummaryResponse:
    try:
        return SummaryResponse(**GetSummary(db, user.Id, date))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/meal/{meal_entry_id}", response_model=MealLookupResponse)
def GetMealRoute(
    meal_entry_id: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> MealLookupResponse:
    try:
        return MealLookupResponse(**GetMeal(db, user.Id, meal_entry_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/meals/today", response_model=MealsResponse)
def GetTodayMealsRoute(
    date: str = Query(..., min_length=1),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> MealsResponse:
    try:
        return MealsResponse(**GetTodayMeals(db, user.Id, date))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/meals/search", response_model=MealsResponse)
def SearchMealsRoute(
    query: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> MealsResponse:
    try:
        return MealsResponse(**SearchMeals(db, user.Id, query, date, limit))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/history", response_model=HistoryResponse)
def GetHistoryRoute(
    history_type: str = Query(..., min_length=1),
    start_date: str = Query(..., min_length=1),
    end_date: str = Query(..., min_length=1),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> HistoryResponse:
    try:
        items = GetHistory(db, user.Id, history_type, start_date, end_date, limit)
        return HistoryResponse(HistoryType=history_type, Items=items)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/context", response_model=ConnectionContextResponse)
def GetConnectionContextRoute(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> ConnectionContextResponse:
    return ConnectionContextResponse(**GetConnectionContext(db, user.Id))


@router.get("/weight-trend", response_model=WeightTrendResponse)
def GetWeightTrendRoute(
    days: int = Query(default=14, ge=1, le=365),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> WeightTrendResponse:
    return WeightTrendResponse(**GetWeightTrend(db, user.Id, days))


@router.get("/step-summary", response_model=StepSummaryResponse)
def GetStepSummaryRoute(
    start_date: str = Query(..., min_length=1),
    end_date: str = Query(..., min_length=1),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> StepSummaryResponse:
    try:
        return StepSummaryResponse(**GetStepSummary(db, user.Id, start_date, end_date))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/targets/history", response_model=TargetsHistoryResponse)
def GetTargetsHistoryRoute(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> TargetsHistoryResponse:
    return TargetsHistoryResponse(**GetTargetsHistory(db, user.Id, limit))


@router.post("/foods/from-meal", response_model=SaveFoodFromMealResponse)
def SaveFoodFromMealRoute(
    payload: SaveFoodFromMealInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> SaveFoodFromMealResponse:
    try:
        return SaveFoodFromMealResponse(**SaveFoodFromMeal(db, user.Id, payload.MealEntryId, payload.FoodName))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/foods", response_model=FoodsResponse)
def GetFoodsRoute(
    q: str | None = Query(default=None),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> FoodsResponse:
    return FoodsResponse(Items=GetSavedFoods(db, user.Id, q, limit))


@router.post("/recipe-reviews", response_model=RecipeReview)
def UpsertRecipeReviewRoute(
    payload: CreateRecipeReviewInput | UpdateRecipeReviewInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> RecipeReview:
    try:
        return RecipeReview(**UpsertRecipeReviewRecord(db, user.Id, payload.model_dump(exclude_unset=True)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/recipe-reviews", response_model=RecipeReviewListResponse)
def GetRecipeReviewsRoute(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> RecipeReviewListResponse:
    return RecipeReviewListResponse(Items=GetRecipeReviewHistory(db, user.Id, limit))


@router.delete("/recipe-reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteRecipeReviewRoute(review_id: str, db: Session = Depends(GetDb), user: UserContext = Depends(RequireModuleRole("health", write=True))) -> None:
    try:
        DeleteRecipeReviewRecord(db, user.Id, review_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/recipe-stats", response_model=RecipeStatsResponse)
def GetRecipeStatsRoute(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> RecipeStatsResponse:
    try:
        return RecipeStatsResponse(Items=GetRecipeStatsView(db, user.Id, start_date, end_date, limit))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/product-reviews", response_model=ProductReview)
def UpsertProductReviewRoute(
    payload: UpsertProductReviewInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> ProductReview:
    try:
        return ProductReview(**UpsertProductReviewRecord(db, user.Id, payload.model_dump(exclude_unset=True)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/product-reviews", response_model=ProductReviewListResponse)
def GetProductReviewsRoute(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> ProductReviewListResponse:
    return ProductReviewListResponse(Items=GetProductReviewHistory(db, user.Id, limit))


@router.post("/experiments", response_model=Experiment)
def UpsertExperimentRoute(
    payload: UpsertExperimentInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> Experiment:
    try:
        return Experiment(**UpsertExperimentRecord(db, user.Id, payload.model_dump(exclude_unset=True)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/experiments", response_model=ExperimentListResponse)
def GetExperimentsRoute(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> ExperimentListResponse:
    return ExperimentListResponse(Items=GetExperimentHistory(db, user.Id, limit))


@router.post("/measurements", response_model=BodyMeasurement)
def UpsertMeasurementRoute(
    payload: UpsertBodyMeasurementInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> BodyMeasurement:
    try:
        return BodyMeasurement(**UpsertMeasurementRecord(db, user.Id, payload.model_dump(exclude_unset=True)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/measurements", response_model=BodyMeasurementListResponse)
def GetMeasurementsRoute(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> BodyMeasurementListResponse:
    try:
        return BodyMeasurementListResponse(Items=GetMeasurementHistory(db, user.Id, start_date, end_date, limit))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/headaches", response_model=HeadacheEvent)
def UpsertHeadacheRoute(payload: UpsertHeadacheEventInput, db: Session = Depends(GetDb), user: UserContext = Depends(RequireModuleRole("health", write=True))) -> HeadacheEvent:
    return UpsertHeadache(db, user.Id, payload)


@router.get("/headaches", response_model=list[HeadacheEvent])
def GetHeadachesRoute(log_date: str | None = None, db: Session = Depends(GetDb), user: UserContext = Depends(RequireModuleRole("health", write=False))) -> list[HeadacheEvent]:
    return GetHeadaches(db, user.Id, log_date)


@router.post("/medication-doses", response_model=MedicationDose)
def UpsertMedicationDoseRoute(payload: UpsertMedicationDoseInput, db: Session = Depends(GetDb), user: UserContext = Depends(RequireModuleRole("health", write=True))) -> MedicationDose:
    return UpsertDose(db, user.Id, payload)


@router.get("/medication-doses", response_model=list[MedicationDose])
def GetMedicationDosesRoute(log_date: str | None = None, db: Session = Depends(GetDb), user: UserContext = Depends(RequireModuleRole("health", write=False))) -> list[MedicationDose]:
    return GetDoses(db, user.Id, log_date)


@router.post("/insights", response_model=Insight)
def UpsertInsightRoute(
    payload: UpsertInsightInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> Insight:
    try:
        return Insight(**UpsertInsightRecord(db, user.Id, payload.model_dump(exclude_unset=True)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/insights", response_model=InsightListResponse)
def GetInsightsRoute(
    insight_type: str | None = Query(default=None),
    period_type: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    status: str | None = Query(default=None),
    source: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> InsightListResponse:
    try:
        return InsightListResponse(
            Items=GetInsightHistory(
                db,
                user.Id,
                insight_type=insight_type,
                period_type=period_type,
                start_date=start_date,
                end_date=end_date,
                status=status,
                source=source,
                tag=tag,
                limit=limit,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/weekly-review-note", response_model=WeeklyReviewNote)
def UpsertWeeklyReviewNoteRoute(
    payload: UpsertWeeklyReviewNoteInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> WeeklyReviewNote:
    try:
        return WeeklyReviewNote(**UpsertWeeklyReviewNoteRecord(db, user.Id, payload.model_dump(exclude_unset=True)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/weekly-review-note", response_model=WeeklyReviewNoteResponse)
def GetWeeklyReviewNoteRoute(
    week_start: str = Query(..., min_length=1),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> WeeklyReviewNoteResponse:
    try:
        return WeeklyReviewNoteResponse(Item=GetWeeklyReviewNoteRecord(db, user.Id, week_start))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/weekly-review", response_model=WeeklyReviewSnapshotResponse)
def GetWeeklyReviewRoute(
    week_start: str = Query(..., min_length=1),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> WeeklyReviewSnapshotResponse:
    try:
        return WeeklyReviewSnapshotResponse(Item=WeeklyReviewSnapshot(**GetWeeklyReviewView(db, user.Id, week_start)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
