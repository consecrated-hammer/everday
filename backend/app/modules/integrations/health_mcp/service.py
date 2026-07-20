from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.health.models import DailyLog as DailyLogModel
from app.modules.health.models import Food as FoodModel
from app.modules.health.models import MealEntry as MealEntryModel
from app.modules.health.schemas import (
    CreateFoodInput,
    CreateWorkoutInput,
    CreateMealEntryInput,
    CreateDailyLogInput,
    DailyLog,
    DailySummary,
    DailyTotals,
    Food,
    MealEntry,
    MealEntryWithFood,
    MealType,
    Targets,
    UpsertBodyMeasurementInput,
    UpsertExperimentInput,
    UpsertInsightInput,
    UpsertProductReviewInput,
    UpsertWeeklyReviewNoteInput,
    UpdateFoodInput,
    Workout,
)
from app.modules.health.services.knowledge_service import (
    GetBodyMeasurements,
    GetExperiments,
    GetInsights,
    GetProductReviews,
    GetWeeklyReviewNote,
    GetWeeklyReviewSnapshot,
    UpsertBodyMeasurement,
    UpsertExperiment,
    UpsertInsight,
    UpsertProductReview,
    UpsertWeeklyReviewNote,
)
from app.modules.health.services.calculations import BuildDailySummary, CalculateDailyTotals
from app.modules.health.services.daily_logs_service import (
    CreateMealEntry,
    DeleteMealEntry,
    EnsureDailyLogForDate,
    GetDailyLogByDate,
    GetEntriesForLog,
    GetStepsHistory,
    GetWeightHistory,
    UpdateDailyLog as UpdateHealthDailyLog,
    UpdateSteps,
)
from app.modules.health.services.foods_service import GetFoodById, UpdateFood as UpdateFoodRecord, UpsertFood
from app.modules.health.services.image_scan_service import ParseImageScan
from app.modules.health.services.meal_text_parse_service import ParseMealText
from app.modules.health.services.portion_entry_service import BuildPortionValues
from app.modules.health.services.settings_service import GetSettings, GetUserSettings
from app.modules.health.services.recommendation_logs_service import GetRecommendationLogsByUser
from app.modules.health.services.workouts_service import (
    CreateWorkout,
    DeleteWorkout as DeleteWorkoutRecord,
    GetWorkoutById,
    GetWorkoutCaloriesForDate,
    GetWorkoutHistory,
    GetWorkoutsForDate,
    UpdateWorkout as UpdateWorkoutRecord,
)
from app.modules.health.utils.dates import ParseIsoDate

OfficeModeOptions = [
    {"value": "office", "label": "Office", "aliases": ["office", "work", "onsite"]},
    {"value": "wfh", "label": "WFH", "aliases": ["wfh", "work from home", "home"]},
    {"value": "other", "label": "Other", "aliases": ["other"]},
]

AdherentStatusOptions = [
    {"value": "yes", "label": "Yes", "aliases": ["yes", "true", "adherent", "complete"]},
    {"value": "no", "label": "No", "aliases": ["no", "false", "not adherent"]},
    {"value": "pending", "label": "Pending", "aliases": ["pending", "in progress", "partial"]},
]

MealSlotOptions = [
    {"value": MealType.Breakfast.value, "label": "Breakfast", "aliases": ["breakfast"], "order": 1},
    {"value": MealType.Snack1.value, "label": "Morning snack", "aliases": ["morning snack", "snack1", "snack 1"], "order": 2},
    {"value": MealType.Lunch.value, "label": "Lunch", "aliases": ["lunch"], "order": 3},
    {
        "value": MealType.Snack2.value,
        "label": "Afternoon snack",
        "aliases": ["afternoon snack", "bridge", "snack2", "snack 2"],
        "order": 4,
    },
    {"value": MealType.Dinner.value, "label": "Dinner", "aliases": ["dinner"], "order": 5},
    {
        "value": MealType.Snack3.value,
        "label": "Evening snack",
        "aliases": ["evening snack", "dessert", "night snack", "snack3", "snack 3"],
        "order": 6,
    },
]

HistoryTypeOptions = [
    {"value": "weight", "description": "Per-day weight history."},
    {"value": "steps", "description": "Per-day step history and step calories."},
    {"value": "workouts", "description": "Workout ledger entries."},
    {"value": "days", "description": "Per-day calorie and burn summaries with workbook-style daily metadata."},
    {"value": "meals", "description": "Meal entry history with ids, slot labels, and nutrition metadata."},
]

WorkoutTypeOptions = [
    {"value": "walk", "label": "Walk", "aliases": ["walk", "walking", "steps walk"]},
    {"value": "run", "label": "Run", "aliases": ["run", "running", "jog", "jogging"]},
    {"value": "cycle", "label": "Cycle", "aliases": ["cycle", "cycling", "bike", "biking"]},
    {"value": "strength", "label": "Strength", "aliases": ["strength", "weights", "lifting", "gym"]},
    {"value": "hiit", "label": "HIIT", "aliases": ["hiit", "intervals", "interval training"]},
    {"value": "yoga", "label": "Yoga", "aliases": ["yoga"]},
    {"value": "pilates", "label": "Pilates", "aliases": ["pilates", "reformer"]},
    {"value": "swim", "label": "Swim", "aliases": ["swim", "swimming"]},
    {"value": "sport", "label": "Sport", "aliases": ["sport", "sports"]},
    {"value": "other", "label": "Other", "aliases": ["other"]},
]


def _ResolveMealType(value: str | None) -> MealType:
    if value is None:
        return MealType.Lunch
    cleaned = str(value).strip()
    if not cleaned:
        return MealType.Lunch
    aliases = {
        "breakfast": MealType.Breakfast,
        "morning snack": MealType.Snack1,
        "morningsnack": MealType.Snack1,
        "snack 1": MealType.Snack1,
        "snack1": MealType.Snack1,
        "lunch": MealType.Lunch,
        "afternoon snack": MealType.Snack2,
        "afternoonsnack": MealType.Snack2,
        "bridge": MealType.Snack2,
        "snack 2": MealType.Snack2,
        "snack2": MealType.Snack2,
        "dinner": MealType.Dinner,
        "evening snack": MealType.Snack3,
        "eveningsnack": MealType.Snack3,
        "dessert": MealType.Snack3,
        "night snack": MealType.Snack3,
        "nightsnack": MealType.Snack3,
        "snack 3": MealType.Snack3,
        "snack3": MealType.Snack3,
    }
    alias_match = aliases.get(cleaned.lower())
    if alias_match is not None:
        return alias_match
    try:
        return MealType(cleaned)
    except ValueError as exc:
        raise ValueError("Invalid meal type.") from exc


def _MealTypeLabel(value: MealType | str) -> str:
    normalized = value.value if hasattr(value, "value") else str(value)
    labels = {
        MealType.Breakfast.value: "Breakfast",
        MealType.Snack1.value: "Morning snack",
        MealType.Lunch.value: "Lunch",
        MealType.Snack2.value: "Afternoon snack",
        MealType.Dinner.value: "Dinner",
        MealType.Snack3.value: "Evening snack",
    }
    return labels.get(normalized, normalized)


def _NormalizeOfficeMode(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip().lower()
    if not cleaned:
        return None
    for option in OfficeModeOptions:
        if cleaned == option["value"] or cleaned in option["aliases"]:
            return str(option["value"])
    raise ValueError("Invalid office mode. Use one of: office, wfh, other.")


def _NormalizeWorkoutType(value: str) -> str:
    cleaned = str(value or "").strip().lower()
    if not cleaned:
        raise ValueError("Invalid workout type.")
    for option in WorkoutTypeOptions:
        if cleaned == option["value"] or cleaned in option["aliases"]:
            return str(option["value"])
    raise ValueError(
        "Invalid workout type. Use one of: "
        + ", ".join(option["value"] for option in WorkoutTypeOptions)
        + "."
    )


def _NormalizePeriodLabel(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _NormalizeAdherentStatus(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip().lower()
    if not cleaned:
        return None
    for option in AdherentStatusOptions:
        if cleaned == option["value"] or cleaned in option["aliases"]:
            return str(option["value"])
    return cleaned


def _DerivePeriodBoolean(period_label: str | None) -> bool | None:
    if period_label is None:
        return None
    lowered = period_label.strip().lower()
    if not lowered:
        return None
    if lowered in {"no", "none", "false", "not on period"}:
        return False
    return True


def _DeriveAdherentBoolean(adherent_status: str | None) -> bool | None:
    if adherent_status is None:
        return None
    if adherent_status == "yes":
        return True
    if adherent_status == "no":
        return False
    return None


def _BuildDaySnapshot(
    db: Session,
    user_id: int,
    log_date: str,
) -> tuple[DailyLog | None, list[Workout], list[MealEntryWithFood], DailyTotals, DailySummary, Targets]:
    daily_log = GetDailyLogByDate(db, user_id, log_date)
    settings = GetSettings(db, user_id)
    if daily_log is None:
        totals = CalculateDailyTotals([], 0, settings.StepKcalFactor, settings, WorkoutCaloriesBurned=0)
        summary = BuildDailySummary(ParseIsoDate(log_date), 0, totals, WorkoutCount=0)
        return None, [], [], totals, summary, settings

    entries = GetEntriesForLog(db, user_id, daily_log.DailyLogId)
    workouts = GetWorkoutsForDate(db, user_id, daily_log.LogDate)
    workout_calories, workout_count = GetWorkoutCaloriesForDate(db, user_id, daily_log.LogDate)
    step_factor = (
        daily_log.StepKcalFactorOverride
        if daily_log.StepKcalFactorOverride is not None
        else settings.StepKcalFactor
    )
    totals = CalculateDailyTotals(
        entries,
        daily_log.Steps,
        step_factor,
        settings,
        WorkoutCaloriesBurned=workout_calories,
    )
    summary = BuildDailySummary(daily_log.LogDate, daily_log.Steps, totals, WorkoutCount=workout_count)
    return daily_log, workouts, entries, totals, summary, settings


def _BuildAiFoodName(base_name: str) -> str:
    cleaned = " ".join(part for part in str(base_name or "").split())
    return cleaned or "AI meal"


def _FloatEqual(left: float | None, right: float | None, tolerance: float = 0.05) -> bool:
    if left is None and right is None:
        return True
    if left is None or right is None:
        return False
    return math.isclose(float(left), float(right), abs_tol=tolerance)


def _FindReusableFood(db: Session, user_id: int, parsed_meal: dict[str, Any]) -> FoodModel | None:
    food_name = _BuildAiFoodName(parsed_meal.get("FoodName") or parsed_meal.get("MealName"))
    candidates = (
        db.query(FoodModel)
        .filter(
            FoodModel.OwnerUserId == user_id,
            func.lower(FoodModel.FoodName) == food_name.lower(),
        )
        .order_by(FoodModel.CreatedAt.desc())
        .all()
    )
    for row in candidates:
        if (
            int(row.CaloriesPerServing or 0) == int(parsed_meal.get("CaloriesPerServing") or 0)
            and _FloatEqual(float(row.ProteinPerServing or 0), parsed_meal.get("ProteinPerServing"))
            and _FloatEqual(
                float(row.ServingQuantity or 1.0),
                float(parsed_meal.get("ServingQuantity") or 1.0),
            )
            and (row.ServingUnit or "serving") == (parsed_meal.get("ServingUnit") or "serving")
        ):
            return row
    return None


def _BuildUniqueFoodName(db: Session, user_id: int, base_name: str, calories_per_serving: float) -> str:
    normalized = " ".join(base_name.split()) or "Manual meal"
    existing = (
        db.query(FoodModel)
        .filter(FoodModel.OwnerUserId == user_id, func.lower(FoodModel.FoodName) == normalized.lower())
        .first()
    )
    if existing is None:
        return normalized
    return f"{normalized} ({int(round(calories_per_serving))} kcal)"


def _CreateAiFood(db: Session, user_id: int, parsed_meal: dict[str, Any]) -> Food:
    reusable = _FindReusableFood(db, user_id, parsed_meal)
    if reusable is not None:
        return Food.model_validate(
            {
                "FoodId": reusable.FoodId,
                "OwnerUserId": reusable.OwnerUserId,
                "FoodName": reusable.FoodName,
                "ServingDescription": reusable.ServingDescription,
                "ServingQuantity": float(reusable.ServingQuantity or 1.0),
                "ServingUnit": reusable.ServingUnit or "serving",
                "CaloriesPerServing": int(reusable.CaloriesPerServing),
                "ProteinPerServing": float(reusable.ProteinPerServing),
                "FibrePerServing": float(reusable.FibrePerServing) if reusable.FibrePerServing is not None else None,
                "CarbsPerServing": float(reusable.CarbsPerServing) if reusable.CarbsPerServing is not None else None,
                "FatPerServing": float(reusable.FatPerServing) if reusable.FatPerServing is not None else None,
                "SaturatedFatPerServing": float(reusable.SaturatedFatPerServing)
                if reusable.SaturatedFatPerServing is not None
                else None,
                "SugarPerServing": float(reusable.SugarPerServing) if reusable.SugarPerServing is not None else None,
                "SodiumPerServing": float(reusable.SodiumPerServing) if reusable.SodiumPerServing is not None else None,
                "DataSource": reusable.DataSource or "ai",
                "CountryCode": reusable.CountryCode or "AU",
                "IsFavourite": bool(reusable.IsFavourite),
                "ImageUrl": reusable.ImageUrl,
                "CreatedAt": reusable.CreatedAt,
            }
        )

    payload = CreateFoodInput(
        FoodName=_BuildAiFoodName(parsed_meal.get("FoodName") or parsed_meal.get("MealName")),
        ServingQuantity=float(parsed_meal.get("ServingQuantity") or 1.0),
        ServingUnit=str(parsed_meal.get("ServingUnit") or "serving"),
        CaloriesPerServing=float(parsed_meal.get("CaloriesPerServing") or 0),
        ProteinPerServing=float(parsed_meal.get("ProteinPerServing") or 0),
        FibrePerServing=parsed_meal.get("FibrePerServing"),
        CarbsPerServing=parsed_meal.get("CarbsPerServing"),
        FatPerServing=parsed_meal.get("FatPerServing"),
        SaturatedFatPerServing=parsed_meal.get("SaturatedFatPerServing"),
        SugarPerServing=parsed_meal.get("SugarPerServing"),
        SodiumPerServing=parsed_meal.get("SodiumPerServing"),
        DataSource="ai",
        CountryCode="AU",
        IsFavourite=False,
    )
    return UpsertFood(db, user_id, payload)


def _CreateManualFood(
    db: Session,
    user_id: int,
    food_name: str,
    calories_per_serving: float,
    protein_per_serving: float = 0,
    fibre_per_serving: float | None = None,
    carbs_per_serving: float | None = None,
    fat_per_serving: float | None = None,
    saturated_fat_per_serving: float | None = None,
    sugar_per_serving: float | None = None,
    sodium_per_serving: float | None = None,
    serving_quantity: float = 1.0,
    serving_unit: str = "serving",
) -> Food:
    parsed_meal = {
        "FoodName": food_name,
        "MealName": food_name,
        "ServingQuantity": serving_quantity,
        "ServingUnit": serving_unit,
        "CaloriesPerServing": calories_per_serving,
        "ProteinPerServing": protein_per_serving,
        "FibrePerServing": fibre_per_serving,
        "CarbsPerServing": carbs_per_serving,
        "FatPerServing": fat_per_serving,
        "SaturatedFatPerServing": saturated_fat_per_serving,
        "SugarPerServing": sugar_per_serving,
        "SodiumPerServing": sodium_per_serving,
    }
    reusable = _FindReusableFood(db, user_id, parsed_meal)
    if reusable is not None:
        return Food.model_validate(
            {
                "FoodId": reusable.FoodId,
                "OwnerUserId": reusable.OwnerUserId,
                "FoodName": reusable.FoodName,
                "ServingDescription": reusable.ServingDescription,
                "ServingQuantity": float(reusable.ServingQuantity or 1.0),
                "ServingUnit": reusable.ServingUnit or "serving",
                "CaloriesPerServing": int(reusable.CaloriesPerServing),
                "ProteinPerServing": float(reusable.ProteinPerServing),
                "FibrePerServing": float(reusable.FibrePerServing) if reusable.FibrePerServing is not None else None,
                "CarbsPerServing": float(reusable.CarbsPerServing) if reusable.CarbsPerServing is not None else None,
                "FatPerServing": float(reusable.FatPerServing) if reusable.FatPerServing is not None else None,
                "SaturatedFatPerServing": float(reusable.SaturatedFatPerServing)
                if reusable.SaturatedFatPerServing is not None
                else None,
                "SugarPerServing": float(reusable.SugarPerServing) if reusable.SugarPerServing is not None else None,
                "SodiumPerServing": float(reusable.SodiumPerServing) if reusable.SodiumPerServing is not None else None,
                "DataSource": reusable.DataSource or "manual",
                "CountryCode": reusable.CountryCode or "AU",
                "IsFavourite": bool(reusable.IsFavourite),
                "ImageUrl": reusable.ImageUrl,
                "CreatedAt": reusable.CreatedAt,
            }
        )

    payload = CreateFoodInput(
        FoodName=_BuildUniqueFoodName(db, user_id, food_name, calories_per_serving),
        ServingQuantity=serving_quantity,
        ServingUnit=serving_unit,
        CaloriesPerServing=calories_per_serving,
        ProteinPerServing=protein_per_serving,
        FibrePerServing=fibre_per_serving,
        CarbsPerServing=carbs_per_serving,
        FatPerServing=fat_per_serving,
        SaturatedFatPerServing=saturated_fat_per_serving,
        SugarPerServing=sugar_per_serving,
        SodiumPerServing=sodium_per_serving,
        DataSource="manual",
        CountryCode="AU",
        IsFavourite=False,
    )
    return UpsertFood(db, user_id, payload)


def _GetNextSortOrder(db: Session, daily_log_id: str) -> int:
    max_sort = (
        db.query(func.max(MealEntryModel.SortOrder))
        .filter(MealEntryModel.DailyLogId == daily_log_id)
        .scalar()
    )
    return int(max_sort or -1) + 1


def _CreateMealEntryFromFood(
    db: Session,
    user_id: int,
    daily_log_id: str,
    meal_type: MealType,
    food: Food,
    note: str | None = None,
) -> MealEntry:
    payload = CreateMealEntryInput(
        DailyLogId=daily_log_id,
        MealType=meal_type,
        FoodId=food.FoodId,
        MealTemplateId=None,
        Quantity=1.0,
        PortionOptionId=None,
        PortionLabel=food.ServingUnit or "serving",
        PortionBaseUnit=food.ServingUnit or "serving",
        PortionBaseAmount=float(food.ServingQuantity or 1.0),
        EntryNotes=note,
        SortOrder=_GetNextSortOrder(db, daily_log_id),
        ScheduleSlotId=None,
    )
    return CreateMealEntry(db, user_id, payload)


def LogMealFromText(
    db: Session,
    user_id: int,
    text: str,
    log_date: str,
    meal_type: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    parsed = ParseMealText(text)
    parsed["FoodName"] = parsed.get("MealName") or parsed.get("FoodName") or "AI meal"
    daily_log = EnsureDailyLogForDate(db, user_id, log_date)
    food = _CreateAiFood(db, user_id, parsed)
    entry_note = note or parsed.get("Summary")
    entry = _CreateMealEntryFromFood(db, user_id, daily_log.DailyLogId, _ResolveMealType(meal_type), food, entry_note)
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "Created": True,
        "Reason": None,
        "ParsedMeal": parsed,
        "MealEntryId": entry.MealEntryId,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def LogMealFromImage(
    db: Session,
    user_id: int,
    image_base64: str,
    log_date: str,
    meal_type: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    parsed = ParseImageScan(image_base64, "meal", note)
    should_write = parsed.get("Confidence") != "Low" or not parsed.get("Questions")
    if not should_write:
        snapshot = _BuildDaySnapshot(db, user_id, log_date)
        return {
            "Created": False,
            "Reason": "clarification_required",
            "ParsedMeal": parsed,
            "MealEntryId": None,
            "DailyLog": snapshot[0],
            "Workouts": snapshot[1],
            "Entries": snapshot[2],
            "Totals": snapshot[3],
            "Summary": snapshot[4],
            "Targets": snapshot[5],
        }

    daily_log = EnsureDailyLogForDate(db, user_id, log_date)
    food = _CreateAiFood(db, user_id, parsed)
    entry_note = note or parsed.get("Summary")
    entry = _CreateMealEntryFromFood(db, user_id, daily_log.DailyLogId, _ResolveMealType(meal_type), food, entry_note)
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "Created": True,
        "Reason": None,
        "ParsedMeal": parsed,
        "MealEntryId": entry.MealEntryId,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def LogMealManual(
    db: Session,
    user_id: int,
    log_date: str,
    food_name: str,
    calories_per_serving: float,
    protein_per_serving: float = 0,
    fibre_per_serving: float | None = None,
    carbs_per_serving: float | None = None,
    fat_per_serving: float | None = None,
    saturated_fat_per_serving: float | None = None,
    sugar_per_serving: float | None = None,
    sodium_per_serving: float | None = None,
    serving_quantity: float = 1.0,
    serving_unit: str = "serving",
    meal_type: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    cleaned_name = " ".join(str(food_name or "").split())
    if not cleaned_name:
        raise ValueError("Food name is required.")
    daily_log = EnsureDailyLogForDate(db, user_id, log_date)
    food = _CreateManualFood(
        db,
        user_id,
        cleaned_name,
        calories_per_serving,
        protein_per_serving,
        fibre_per_serving,
        carbs_per_serving,
        fat_per_serving,
        saturated_fat_per_serving,
        sugar_per_serving,
        sodium_per_serving,
        serving_quantity,
        serving_unit,
    )
    entry = _CreateMealEntryFromFood(
        db,
        user_id,
        daily_log.DailyLogId,
        _ResolveMealType(meal_type),
        food,
        note,
    )
    parsed = {
        "FoodName": cleaned_name,
        "MealName": cleaned_name,
        "ServingQuantity": serving_quantity,
        "ServingUnit": serving_unit,
        "CaloriesPerServing": int(round(calories_per_serving)),
        "ProteinPerServing": protein_per_serving,
        "FibrePerServing": fibre_per_serving,
        "CarbsPerServing": carbs_per_serving,
        "FatPerServing": fat_per_serving,
        "SaturatedFatPerServing": saturated_fat_per_serving,
        "SugarPerServing": sugar_per_serving,
        "SodiumPerServing": sodium_per_serving,
        "Summary": note,
        "Confidence": "Exact",
        "Questions": [],
    }
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "Created": True,
        "Reason": None,
        "ParsedMeal": parsed,
        "MealEntryId": entry.MealEntryId,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def UpdateMeal(
    db: Session,
    user_id: int,
    meal_entry_id: str,
    log_date: str | None = None,
    meal_type: str | None = None,
    note: str | None = None,
    quantity: float | None = None,
    food_name: str | None = None,
    calories_per_serving: float | None = None,
    protein_per_serving: float | None = None,
    fibre_per_serving: float | None = None,
    carbs_per_serving: float | None = None,
    fat_per_serving: float | None = None,
    saturated_fat_per_serving: float | None = None,
    sugar_per_serving: float | None = None,
    sodium_per_serving: float | None = None,
    serving_quantity: float | None = None,
    serving_unit: str | None = None,
) -> dict[str, Any]:
    row = (
        db.query(MealEntryModel, DailyLogModel)
        .join(DailyLogModel, DailyLogModel.DailyLogId == MealEntryModel.DailyLogId)
        .filter(MealEntryModel.MealEntryId == meal_entry_id, DailyLogModel.UserId == user_id)
        .first()
    )
    if row is None:
        raise ValueError("Meal entry not found.")

    record, current_log_row = row
    current_log_date = current_log_row.LogDate.isoformat()
    target_log_date = (log_date or current_log_date).strip()
    target_log = EnsureDailyLogForDate(db, user_id, target_log_date)

    current_food_row = None
    if record.FoodId:
        current_food_row = db.query(FoodModel).filter(FoodModel.FoodId == record.FoodId).first()

    has_food_changes = any(
        value is not None
        for value in (
            food_name,
            calories_per_serving,
            protein_per_serving,
            fibre_per_serving,
            carbs_per_serving,
            fat_per_serving,
            saturated_fat_per_serving,
            sugar_per_serving,
            sodium_per_serving,
            serving_quantity,
            serving_unit,
        )
    )

    if has_food_changes:
        base_food_name = food_name or (
            current_food_row.FoodName if current_food_row is not None else "Manual meal"
        )
        new_food = _CreateManualFood(
            db,
            user_id,
            base_food_name,
            calories_per_serving
            if calories_per_serving is not None
            else float(current_food_row.CaloriesPerServing if current_food_row is not None else 0),
            protein_per_serving
            if protein_per_serving is not None
            else float(current_food_row.ProteinPerServing if current_food_row is not None else 0),
            fibre_per_serving
            if fibre_per_serving is not None
            else (float(current_food_row.FibrePerServing) if current_food_row and current_food_row.FibrePerServing is not None else None),
            carbs_per_serving
            if carbs_per_serving is not None
            else (float(current_food_row.CarbsPerServing) if current_food_row and current_food_row.CarbsPerServing is not None else None),
            fat_per_serving
            if fat_per_serving is not None
            else (float(current_food_row.FatPerServing) if current_food_row and current_food_row.FatPerServing is not None else None),
            saturated_fat_per_serving
            if saturated_fat_per_serving is not None
            else (
                float(current_food_row.SaturatedFatPerServing)
                if current_food_row and current_food_row.SaturatedFatPerServing is not None
                else None
            ),
            sugar_per_serving
            if sugar_per_serving is not None
            else (float(current_food_row.SugarPerServing) if current_food_row and current_food_row.SugarPerServing is not None else None),
            sodium_per_serving
            if sodium_per_serving is not None
            else (float(current_food_row.SodiumPerServing) if current_food_row and current_food_row.SodiumPerServing is not None else None),
            serving_quantity
            if serving_quantity is not None
            else float(current_food_row.ServingQuantity if current_food_row is not None else 1.0),
            serving_unit or (current_food_row.ServingUnit if current_food_row is not None else "serving"),
        )
        record.FoodId = new_food.FoodId
        record.MealTemplateId = None
        current_food_row = db.query(FoodModel).filter(FoodModel.FoodId == new_food.FoodId).first()

    if meal_type is not None:
        record.MealType = _ResolveMealType(meal_type)

    if note is not None:
        record.EntryNotes = note

    if target_log.DailyLogId != record.DailyLogId:
        record.DailyLogId = target_log.DailyLogId
        record.SortOrder = _GetNextSortOrder(db, target_log.DailyLogId)

    display_quantity = float(quantity) if quantity is not None else float(record.DisplayQuantity or record.Quantity or 1.0)
    if display_quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    if current_food_row is not None:
        portion_base_unit = serving_unit or current_food_row.ServingUnit or record.PortionBaseUnit or "serving"
        portion_base_amount = (
            float(serving_quantity)
            if serving_quantity is not None
            else float(current_food_row.ServingQuantity or record.PortionBaseAmount or 1.0)
        )
        servings, resolved_unit, base_total = BuildPortionValues(
            current_food_row,
            display_quantity,
            portion_base_unit,
            portion_base_amount,
        )
        record.Quantity = servings
        record.DisplayQuantity = display_quantity
        record.PortionLabel = portion_base_unit
        record.PortionBaseUnit = resolved_unit
        record.PortionBaseAmount = portion_base_amount
        record.PortionBaseTotal = base_total
    else:
        portion_base_unit = serving_unit or record.PortionBaseUnit or "serving"
        portion_base_amount = float(serving_quantity) if serving_quantity is not None else float(record.PortionBaseAmount or 1.0)
        record.Quantity = display_quantity
        record.DisplayQuantity = display_quantity
        record.PortionLabel = portion_base_unit
        record.PortionBaseUnit = portion_base_unit
        record.PortionBaseAmount = portion_base_amount
        record.PortionBaseTotal = display_quantity * portion_base_amount

    db.add(record)
    db.commit()
    db.refresh(record)

    parsed = {
        "FoodName": current_food_row.FoodName if current_food_row is not None else None,
        "MealName": current_food_row.FoodName if current_food_row is not None else None,
        "ServingQuantity": float(current_food_row.ServingQuantity) if current_food_row and current_food_row.ServingQuantity is not None else record.PortionBaseAmount,
        "ServingUnit": current_food_row.ServingUnit if current_food_row is not None else record.PortionBaseUnit,
        "CaloriesPerServing": int(current_food_row.CaloriesPerServing) if current_food_row is not None else None,
        "ProteinPerServing": float(current_food_row.ProteinPerServing) if current_food_row is not None else None,
        "FibrePerServing": float(current_food_row.FibrePerServing) if current_food_row and current_food_row.FibrePerServing is not None else None,
        "CarbsPerServing": float(current_food_row.CarbsPerServing) if current_food_row and current_food_row.CarbsPerServing is not None else None,
        "FatPerServing": float(current_food_row.FatPerServing) if current_food_row and current_food_row.FatPerServing is not None else None,
        "SaturatedFatPerServing": float(current_food_row.SaturatedFatPerServing)
        if current_food_row and current_food_row.SaturatedFatPerServing is not None
        else None,
        "SugarPerServing": float(current_food_row.SugarPerServing) if current_food_row and current_food_row.SugarPerServing is not None else None,
        "SodiumPerServing": float(current_food_row.SodiumPerServing) if current_food_row and current_food_row.SodiumPerServing is not None else None,
        "Summary": record.EntryNotes,
        "Confidence": "Updated",
        "Questions": [],
    }
    snapshot = _BuildDaySnapshot(db, user_id, target_log_date)
    return {
        "Updated": True,
        "Reason": None,
        "ParsedMeal": parsed,
        "MealEntryId": record.MealEntryId,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
        "PreviousLogDate": current_log_date,
        "TargetLogDate": target_log_date,
    }


def LogWeight(
    db: Session,
    user_id: int,
    log_date: str,
    weight_kg: float,
) -> dict[str, Any]:
    existing = GetDailyLogByDate(db, user_id, log_date)
    current_steps = existing.Steps if existing is not None else 0
    current_override = existing.StepKcalFactorOverride if existing is not None else None
    daily_log = UpdateSteps(db, user_id, log_date, current_steps, current_override, weight_kg)
    history = GetWeightHistory(db, user_id, "1900-01-01", log_date)
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "DailyLog": daily_log,
        "RecentWeights": history[-14:],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def GetSummary(
    db: Session,
    user_id: int,
    log_date: str,
) -> dict[str, Any]:
    daily_log, workouts, entries, totals, summary, targets = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "DailyLog": daily_log,
        "Workouts": workouts,
        "Entries": entries,
        "Totals": totals,
        "Summary": summary,
        "Targets": targets,
    }


def LogWorkout(
    db: Session,
    user_id: int,
    log_date: str,
    workout_type: str,
    workout_name: str,
    duration_minutes: float | None = None,
    calories_burned: int = 0,
    distance_km: float | None = None,
    started_at: Any = None,
    ended_at: Any = None,
    notes: str | None = None,
) -> dict[str, Any]:
    payload = CreateWorkoutInput(
        LogDate=log_date,
        WorkoutType=_NormalizeWorkoutType(workout_type),
        WorkoutName=workout_name,
        DurationMinutes=duration_minutes,
        CaloriesBurned=calories_burned,
        DistanceKm=distance_km,
        StartedAt=started_at,
        EndedAt=ended_at,
        Notes=notes,
    )
    workout = CreateWorkout(db, user_id, payload)
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "Workout": workout,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def GetMeal(db: Session, user_id: int, meal_entry_id: str) -> dict[str, Any]:
    row = (
        db.query(MealEntryModel, DailyLogModel)
        .join(DailyLogModel, DailyLogModel.DailyLogId == MealEntryModel.DailyLogId)
        .filter(MealEntryModel.MealEntryId == meal_entry_id, DailyLogModel.UserId == user_id)
        .first()
    )
    if row is None:
        raise ValueError("Meal entry not found.")
    record, log_row = row
    entry = next(
        item for item in GetEntriesForLog(db, user_id, log_row.DailyLogId) if item.MealEntryId == meal_entry_id
    )
    return {
        "Item": {
            "LogDate": log_row.LogDate.isoformat(),
            "MealEntryId": entry.MealEntryId,
            "MealType": entry.MealType,
            "MealTypeLabel": _MealTypeLabel(entry.MealType),
            "FoodId": entry.FoodId,
            "FoodName": entry.FoodName,
            "ServingDescription": entry.ServingDescription,
            "ServingUnit": entry.PortionBaseUnit or entry.PortionLabel,
            "Quantity": entry.Quantity,
            "DisplayQuantity": entry.DisplayQuantity,
            "CaloriesPerServing": entry.CaloriesPerServing,
            "ProteinPerServing": entry.ProteinPerServing,
            "FibrePerServing": entry.FibrePerServing,
            "CarbsPerServing": entry.CarbsPerServing,
            "FatPerServing": entry.FatPerServing,
            "SaturatedFatPerServing": entry.SaturatedFatPerServing,
            "SugarPerServing": entry.SugarPerServing,
            "SodiumPerServing": entry.SodiumPerServing,
            "EntryNotes": entry.EntryNotes,
            "FoodSource": (
                db.query(FoodModel.DataSource)
                .filter(FoodModel.FoodId == entry.FoodId)
                .scalar()
                if entry.FoodId
                else None
            ),
            "CreatedAt": entry.CreatedAt.isoformat() if entry.CreatedAt else None,
        }
    }


def GetTodayMeals(db: Session, user_id: int, log_date: str) -> dict[str, Any]:
    daily_log, workouts, entries, totals, summary, targets = _BuildDaySnapshot(db, user_id, log_date)
    items: list[dict[str, Any]] = []
    food_ids = [entry.FoodId for entry in entries if entry.FoodId]
    source_map: dict[str, str | None] = {}
    if food_ids:
        for food_id, source in db.query(FoodModel.FoodId, FoodModel.DataSource).filter(FoodModel.FoodId.in_(food_ids)).all():
            source_map[str(food_id)] = source
    for entry in entries:
        items.append(
            {
                "LogDate": log_date,
                "MealEntryId": entry.MealEntryId,
                "MealType": entry.MealType,
                "MealTypeLabel": _MealTypeLabel(entry.MealType),
                "FoodId": entry.FoodId,
                "FoodName": entry.FoodName,
                "ServingDescription": entry.ServingDescription,
                "ServingUnit": entry.PortionBaseUnit or entry.PortionLabel,
                "Quantity": entry.Quantity,
                "DisplayQuantity": entry.DisplayQuantity,
                "CaloriesPerServing": entry.CaloriesPerServing,
                "ProteinPerServing": entry.ProteinPerServing,
                "EntryNotes": entry.EntryNotes,
                "FoodSource": source_map.get(entry.FoodId or ""),
                "CreatedAt": entry.CreatedAt.isoformat() if entry.CreatedAt else None,
            }
        )
    return {
        "LogDate": log_date,
        "DailyLog": daily_log,
        "Workouts": workouts,
        "Items": items,
        "Totals": totals,
        "Summary": summary,
        "Targets": targets,
    }


def SearchMeals(
    db: Session,
    user_id: int,
    query: str,
    log_date: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    cleaned_query = query.strip().lower()
    if not cleaned_query:
        raise ValueError("query is required.")
    bounded_limit = max(1, min(int(limit or 50), 200))
    if log_date:
        logs = _QueryLogsInRange(db, user_id, log_date, log_date)
    else:
        end_value = date.today()
        start_value = end_value - timedelta(days=30)
        logs = _QueryLogsInRange(db, user_id, start_value.isoformat(), end_value.isoformat())
    items: list[dict[str, Any]] = []
    for row in logs:
        for entry in GetEntriesForLog(db, user_id, row.DailyLogId):
            haystack = " ".join(
                [
                    str(entry.FoodName or ""),
                    str(entry.EntryNotes or ""),
                    str(_MealTypeLabel(entry.MealType)),
                ]
            ).lower()
            if cleaned_query not in haystack:
                continue
            items.append(
                {
                    "LogDate": row.LogDate.isoformat(),
                    "MealEntryId": entry.MealEntryId,
                    "MealType": entry.MealType,
                    "MealTypeLabel": _MealTypeLabel(entry.MealType),
                    "FoodId": entry.FoodId,
                    "FoodName": entry.FoodName,
                    "ServingDescription": entry.ServingDescription,
                    "ServingUnit": entry.PortionBaseUnit or entry.PortionLabel,
                    "Quantity": entry.Quantity,
                    "DisplayQuantity": entry.DisplayQuantity,
                    "CaloriesPerServing": entry.CaloriesPerServing,
                    "ProteinPerServing": entry.ProteinPerServing,
                    "EntryNotes": entry.EntryNotes,
                    "CreatedAt": entry.CreatedAt.isoformat() if entry.CreatedAt else None,
                }
            )
    return {
        "Query": query,
        "Items": items[-bounded_limit:],
    }


def DeleteMeal(db: Session, user_id: int, meal_entry_id: str) -> dict[str, Any]:
    row = (
        db.query(MealEntryModel, DailyLogModel)
        .join(DailyLogModel, DailyLogModel.DailyLogId == MealEntryModel.DailyLogId)
        .filter(MealEntryModel.MealEntryId == meal_entry_id, DailyLogModel.UserId == user_id)
        .first()
    )
    if row is None:
        raise ValueError("Meal entry not found.")
    _record, log_row = row
    log_date = log_row.LogDate.isoformat()
    DeleteMealEntry(db, user_id, meal_entry_id)
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "Deleted": True,
        "MealEntryId": meal_entry_id,
        "LogDate": log_date,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def UpdateWorkout(
    db: Session,
    user_id: int,
    workout_id: str,
    log_date: str | None = None,
    workout_type: str | None = None,
    workout_name: str | None = None,
    duration_minutes: float | None = None,
    calories_burned: int | None = None,
    distance_km: float | None = None,
    started_at: Any = None,
    ended_at: Any = None,
    notes: str | None = None,
) -> dict[str, Any]:
    existing = GetWorkoutById(db, user_id, workout_id)
    updated = UpdateWorkoutRecord(
        db,
        user_id,
        workout_id,
        log_date=log_date,
        workout_type=_NormalizeWorkoutType(workout_type) if workout_type is not None else None,
        workout_name=workout_name,
        duration_minutes=duration_minutes,
        calories_burned=calories_burned,
        distance_km=distance_km,
        started_at=started_at,
        ended_at=ended_at,
        notes=notes,
    )
    snapshot = _BuildDaySnapshot(db, user_id, updated.LogDate.isoformat())
    return {
        "Updated": True,
        "Workout": updated,
        "PreviousLogDate": existing.LogDate.isoformat(),
        "TargetLogDate": updated.LogDate.isoformat(),
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def DeleteWorkout(
    db: Session,
    user_id: int,
    workout_id: str,
) -> dict[str, Any]:
    existing = GetWorkoutById(db, user_id, workout_id)
    log_date = DeleteWorkoutRecord(db, user_id, workout_id).isoformat()
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "Deleted": True,
        "WorkoutId": workout_id,
        "LogDate": log_date,
        "DeletedWorkout": existing,
        "DailyLog": snapshot[0],
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def GetConnectionContext(db: Session, user_id: int) -> dict[str, Any]:
    settings = GetUserSettings(db, user_id)
    return {
        "ReminderTimeZone": settings.ReminderTimeZone,
        "TodayLayout": settings.TodayLayout,
        "MealSlots": MealSlotOptions,
        "HistoryTypes": HistoryTypeOptions,
        "WorkoutTypes": WorkoutTypeOptions,
        "DailyLogFields": [
            {
                "name": "OfficeMode",
                "type": "enum",
                "description": "Work location for the day.",
                "allowed_values": [option["value"] for option in OfficeModeOptions],
                "default": "other",
            },
            {"name": "WaterLitres", "type": "number", "description": "Water intake for the day in litres.", "minimum": 0, "maximum": 20},
            {"name": "WalkingPadMinutes", "type": "integer", "description": "Walking pad minutes for the day.", "minimum": 0, "maximum": 1440},
            {"name": "ExerciseNotes", "type": "string", "description": "Free-text exercise summary for the day."},
            {"name": "SleepHours", "type": "number", "description": "Sleep duration in hours.", "minimum": 0, "maximum": 24},
            {"name": "Period", "type": "boolean", "description": "Set true if this is a period day; false otherwise."},
            {
                "name": "PeriodLabel",
                "type": "string",
                "description": "Exact period status label for the day, for example 'No', 'Day 1', or 'Day 2'.",
            },
            {"name": "HungerBeforeDinner", "type": "integer", "description": "Hunger score before dinner.", "minimum": 1, "maximum": 10},
            {"name": "OverallSatisfaction", "type": "integer", "description": "Overall satisfaction score for the day.", "minimum": 1, "maximum": 10},
            {"name": "Takeaway", "type": "boolean", "description": "Set true if takeaway was eaten that day; false otherwise."},
            {"name": "LoggedComplete", "type": "boolean", "description": "Set true when daily logging is complete; false otherwise."},
            {"name": "AdherentDay", "type": "boolean", "description": "Set true when the day counts as adherent; false otherwise."},
            {
                "name": "AdherentStatus",
                "type": "enum",
                "description": "Exact adherence status label for the day.",
                "allowed_values": [option["value"] for option in AdherentStatusOptions],
            },
            {"name": "Notes", "type": "string", "description": "General free-text day notes."},
            {"name": "DailyCalorieTargetSnapshot", "type": "integer", "description": "Historical calorie target snapshot for that date.", "minimum": 0},
            {"name": "ProteinTargetSnapshot", "type": "number", "description": "Historical protein target snapshot in grams for that date.", "minimum": 0},
            {"name": "StepTargetSnapshot", "type": "integer", "description": "Historical step target snapshot for that date.", "minimum": 0},
        ],
    }


def GetWeightTrend(db: Session, user_id: int, days: int = 14) -> dict[str, Any]:
    bounded_days = max(1, min(int(days or 14), 365))
    end_value = date.today()
    start_value = end_value - timedelta(days=bounded_days - 1)
    items = GetWeightHistory(db, user_id, start_value.isoformat(), end_value.isoformat())
    delta = None
    if len(items) >= 2:
        delta = round(float(items[-1].WeightKg) - float(items[0].WeightKg), 2)
    return {
        "Days": bounded_days,
        "StartDate": start_value.isoformat(),
        "EndDate": end_value.isoformat(),
        "Items": [
            {"LogDate": item.LogDate.isoformat(), "WeightKg": float(item.WeightKg)}
            for item in items
        ],
        "DeltaKg": delta,
    }


def GetStepSummary(
    db: Session,
    user_id: int,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    steps = GetStepsHistory(db, user_id, start_date, end_date)
    settings = GetSettings(db, user_id)
    items: list[dict[str, Any]] = []
    total_steps = 0
    total_calories = 0
    for item in steps:
        calories = int(round(int(item.Steps or 0) * float(settings.StepKcalFactor)))
        total_steps += int(item.Steps or 0)
        total_calories += calories
        items.append(
            {
                "LogDate": item.LogDate.isoformat(),
                "Steps": int(item.Steps or 0),
                "CaloriesBurnedFromSteps": calories,
            }
        )
    days_count = len(items) or 1
    return {
        "StartDate": start_date,
        "EndDate": end_date,
        "Items": items,
        "TotalSteps": total_steps,
        "AverageSteps": round(total_steps / days_count, 1),
        "TotalCaloriesBurnedFromSteps": total_calories,
        "AverageCaloriesBurnedFromSteps": round(total_calories / days_count, 1),
        "StepTarget": settings.StepTarget,
        "StepKcalFactor": settings.StepKcalFactor,
    }


def GetTargetsHistory(db: Session, user_id: int, limit: int = 20) -> dict[str, Any]:
    bounded_limit = max(1, min(int(limit or 20), 100))
    logs = GetRecommendationLogsByUser(db, user_id, Limit=bounded_limit)
    current = GetSettings(db, user_id)
    return {
        "CurrentTargets": current.model_dump(),
        "Items": [
            {
                "RecommendationLogId": log.RecommendationLogId,
                "CreatedAt": log.CreatedAt.isoformat() if log.CreatedAt else None,
                "WeightKg": float(log.WeightKg),
                "ActivityLevel": log.ActivityLevel,
                "DailyCalorieTarget": log.DailyCalorieTarget,
                "ProteinTargetMin": float(log.ProteinTargetMin),
                "ProteinTargetMax": float(log.ProteinTargetMax),
                "FibreTarget": float(log.FibreTarget) if log.FibreTarget is not None else None,
                "CarbsTarget": float(log.CarbsTarget) if log.CarbsTarget is not None else None,
                "FatTarget": float(log.FatTarget) if log.FatTarget is not None else None,
                "SaturatedFatTarget": float(log.SaturatedFatTarget) if log.SaturatedFatTarget is not None else None,
                "SugarTarget": float(log.SugarTarget) if log.SugarTarget is not None else None,
                "SodiumTarget": float(log.SodiumTarget) if log.SodiumTarget is not None else None,
                "Explanation": log.Explanation,
            }
            for log in logs
        ],
    }


def SaveFoodFromMeal(
    db: Session,
    user_id: int,
    meal_entry_id: str,
    food_name: str | None = None,
) -> dict[str, Any]:
    meal = GetMeal(db, user_id, meal_entry_id)["Item"]
    if meal.get("FoodId"):
        try:
            current_food = GetFoodById(db, meal["FoodId"])
            updated = UpdateFoodRecord(
                db,
                user_id,
                current_food.FoodId,
                UpdateFoodInput(IsFavourite=True),
            )
            return {
                "Saved": True,
                "MealEntryId": meal_entry_id,
                "Food": updated.model_dump(),
                "Mode": "existing_food_favourited",
            }
        except ValueError:
            pass

    saved_food = _CreateManualFood(
        db,
        user_id,
        food_name or str(meal.get("FoodName") or "Saved meal"),
        float(meal.get("CaloriesPerServing") or 0),
        float(meal.get("ProteinPerServing") or 0),
        float(meal.get("FibrePerServing")) if meal.get("FibrePerServing") is not None else None,
        float(meal.get("CarbsPerServing")) if meal.get("CarbsPerServing") is not None else None,
        float(meal.get("FatPerServing")) if meal.get("FatPerServing") is not None else None,
        float(meal.get("SaturatedFatPerServing")) if meal.get("SaturatedFatPerServing") is not None else None,
        float(meal.get("SugarPerServing")) if meal.get("SugarPerServing") is not None else None,
        float(meal.get("SodiumPerServing")) if meal.get("SodiumPerServing") is not None else None,
        float(meal.get("ServingUnit") and 1.0 or 1.0),
        str(meal.get("ServingUnit") or "serving"),
    )
    saved_food = UpdateFoodRecord(
        db,
        user_id,
        saved_food.FoodId,
        UpdateFoodInput(IsFavourite=True, FoodName=(food_name.strip() if food_name else None)),
    )
    return {
        "Saved": True,
        "MealEntryId": meal_entry_id,
        "Food": saved_food.model_dump(),
        "Mode": "created_or_reused_saved_food",
    }


def UpdateDailyLog(
    db: Session,
    user_id: int,
    log_date: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    allowed_fields = {
        "Steps",
        "StepKcalFactorOverride",
        "WeightKg",
        "OfficeMode",
        "WaterLitres",
        "WalkingPadMinutes",
        "ExerciseNotes",
        "SleepHours",
        "Period",
        "PeriodLabel",
        "HungerBeforeDinner",
        "OverallSatisfaction",
        "Takeaway",
        "LoggedComplete",
        "AdherentDay",
        "AdherentStatus",
        "Notes",
        "DailyCalorieTargetSnapshot",
        "ProteinTargetSnapshot",
        "StepTargetSnapshot",
    }
    unexpected = sorted(set(fields) - allowed_fields)
    if unexpected:
        raise ValueError(f"Unsupported daily log field(s): {', '.join(unexpected)}")
    if "OfficeMode" in fields:
        fields["OfficeMode"] = _NormalizeOfficeMode(fields.get("OfficeMode"))
    if "PeriodLabel" in fields:
        fields["PeriodLabel"] = _NormalizePeriodLabel(fields.get("PeriodLabel"))
        if "Period" not in fields:
            fields["Period"] = _DerivePeriodBoolean(fields.get("PeriodLabel"))
    if "AdherentStatus" in fields:
        fields["AdherentStatus"] = _NormalizeAdherentStatus(fields.get("AdherentStatus"))
        if "AdherentDay" not in fields:
            fields["AdherentDay"] = _DeriveAdherentBoolean(fields.get("AdherentStatus"))
    daily_log = UpdateHealthDailyLog(db, user_id, log_date, fields)
    snapshot = _BuildDaySnapshot(db, user_id, log_date)
    return {
        "DailyLog": daily_log,
        "Workouts": snapshot[1],
        "Entries": snapshot[2],
        "Totals": snapshot[3],
        "Summary": snapshot[4],
        "Targets": snapshot[5],
    }


def _QueryLogsInRange(db: Session, user_id: int, start_date: str, end_date: str) -> list[DailyLogModel]:
    start_value = ParseIsoDate(start_date)
    end_value = ParseIsoDate(end_date)
    if end_value < start_value:
        raise ValueError("End date must be on or after start date.")
    return (
        db.query(DailyLogModel)
        .filter(
            DailyLogModel.UserId == user_id,
            DailyLogModel.LogDate >= start_value,
            DailyLogModel.LogDate <= end_value,
        )
        .order_by(DailyLogModel.LogDate.asc())
        .all()
    )


def GetHistory(
    db: Session,
    user_id: int,
    history_type: str,
    start_date: str,
    end_date: str,
    limit: int = 200,
) -> list[dict[str, Any]]:
    history_key = str(history_type or "").strip().lower()
    bounded_limit = max(1, min(int(limit or 200), 500))

    if history_key == "weight":
        rows = GetWeightHistory(db, user_id, start_date, end_date)
        return [item.model_dump(mode="json") for item in rows[-bounded_limit:]]

    if history_key == "steps":
        settings = GetSettings(db, user_id)
        logs = _QueryLogsInRange(db, user_id, start_date, end_date)
        items: list[dict[str, Any]] = []
        for row in logs[-bounded_limit:]:
            step_factor = float(row.StepKcalFactorOverride) if row.StepKcalFactorOverride is not None else settings.StepKcalFactor
            steps = int(row.Steps or 0)
            items.append(
                {
                    "LogDate": row.LogDate.isoformat(),
                    "Steps": steps,
                    "CaloriesBurnedFromSteps": int(round(steps * step_factor)),
                }
            )
        return items

    if history_key == "workouts":
        workouts = GetWorkoutHistory(db, user_id, start_date, end_date, bounded_limit)
        return [item.model_dump(mode="json") for item in workouts]

    if history_key == "days":
        logs = _QueryLogsInRange(db, user_id, start_date, end_date)
        items: list[dict[str, Any]] = []
        for row in logs[-bounded_limit:]:
            snapshot = _BuildDaySnapshot(db, user_id, row.LogDate.isoformat())
            items.append(
                {
                    "LogDate": row.LogDate.isoformat(),
                    "DayName": row.LogDate.strftime("%A"),
                    "WeekNumber": int(row.LogDate.isocalendar().week),
                    "WeekStart": (row.LogDate - timedelta(days=row.LogDate.weekday())).isoformat(),
                    "TotalCalories": snapshot[3].TotalCalories,
                    "TotalProtein": snapshot[3].TotalProtein,
                    "TotalCarbs": snapshot[3].TotalCarbs,
                    "TotalFat": snapshot[3].TotalFat,
                    "TotalFibre": snapshot[3].TotalFibre,
                    "CaloriesBurnedFromSteps": snapshot[3].CaloriesBurnedFromSteps,
                    "CaloriesBurnedFromWorkouts": snapshot[3].CaloriesBurnedFromWorkouts,
                    "TotalCaloriesBurned": snapshot[3].TotalCaloriesBurned,
                    "NetCalories": snapshot[3].NetCalories,
                    "Steps": row.Steps,
                    "WeightKg": float(row.WeightKg) if row.WeightKg is not None else None,
                    "OfficeMode": row.OfficeMode,
                    "WaterLitres": float(row.WaterLitres) if row.WaterLitres is not None else None,
                    "WalkingPadMinutes": int(row.WalkingPadMinutes) if row.WalkingPadMinutes is not None else None,
                    "ExerciseNotes": row.ExerciseNotes,
                    "SleepHours": float(row.SleepHours) if row.SleepHours is not None else None,
                    "Period": bool(row.Period) if row.Period is not None else None,
                    "PeriodLabel": row.PeriodLabel,
                    "HungerBeforeDinner": int(row.HungerBeforeDinner) if row.HungerBeforeDinner is not None else None,
                    "OverallSatisfaction": int(row.OverallSatisfaction) if row.OverallSatisfaction is not None else None,
                    "Takeaway": bool(row.Takeaway) if row.Takeaway is not None else None,
                    "LoggedComplete": bool(row.LoggedComplete) if row.LoggedComplete is not None else None,
                    "AdherentDay": bool(row.AdherentDay) if row.AdherentDay is not None else None,
                    "AdherentStatus": row.AdherentStatus,
                    "Notes": row.Notes,
                    "DailyCalorieTargetSnapshot": row.DailyCalorieTargetSnapshot,
                    "ProteinTargetSnapshot": float(row.ProteinTargetSnapshot) if row.ProteinTargetSnapshot is not None else None,
                    "StepTargetSnapshot": row.StepTargetSnapshot,
                    "MealCount": len(snapshot[2]),
                    "WorkoutCount": len(snapshot[1]),
                }
            )
        return items

    if history_key == "meals":
        logs = _QueryLogsInRange(db, user_id, start_date, end_date)
        items: list[dict[str, Any]] = []
        for row in logs:
            for entry in GetEntriesForLog(db, user_id, row.DailyLogId):
                items.append(
                    {
                        "LogDate": row.LogDate.isoformat(),
                        "MealEntryId": entry.MealEntryId,
                        "MealType": entry.MealType,
                        "MealTypeLabel": _MealTypeLabel(entry.MealType),
                        "FoodId": entry.FoodId,
                        "FoodName": entry.FoodName,
                        "ServingDescription": entry.ServingDescription,
                        "ServingUnit": entry.PortionBaseUnit or entry.PortionLabel,
                        "Quantity": entry.Quantity,
                        "DisplayQuantity": entry.DisplayQuantity,
                        "CaloriesPerServing": entry.CaloriesPerServing,
                        "ProteinPerServing": entry.ProteinPerServing,
                        "CarbsPerServing": entry.CarbsPerServing,
                        "FoodSource": (
                            db.query(FoodModel.DataSource)
                            .filter(FoodModel.FoodId == entry.FoodId)
                            .scalar()
                            if entry.FoodId
                            else None
                        ),
                        "EntryNotes": entry.EntryNotes,
                        "CreatedAt": entry.CreatedAt.isoformat() if entry.CreatedAt else None,
                    }
                )
        return items[-bounded_limit:]

    raise ValueError("Unsupported history type. Use one of: weight, steps, workouts, days, meals.")


def GetSavedFoods(
    db: Session,
    user_id: int,
    query: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    bounded_limit = max(1, min(int(limit or 200), 500))
    food_query = db.query(FoodModel).filter(FoodModel.OwnerUserId == user_id)
    if query:
        like_value = f"%{query.strip().lower()}%"
        food_query = food_query.filter(func.lower(FoodModel.FoodName).like(like_value))
    rows = (
        food_query.order_by(FoodModel.FoodName.asc(), FoodModel.CreatedAt.desc())
        .limit(bounded_limit)
        .all()
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "FoodId": row.FoodId,
                "FoodName": row.FoodName,
                "ServingDescription": row.ServingDescription,
                "ServingQuantity": float(row.ServingQuantity or 1.0),
                "ServingUnit": row.ServingUnit or "serving",
                "CaloriesPerServing": int(row.CaloriesPerServing),
                "ProteinPerServing": float(row.ProteinPerServing),
                "FibrePerServing": float(row.FibrePerServing) if row.FibrePerServing is not None else None,
                "CarbsPerServing": float(row.CarbsPerServing) if row.CarbsPerServing is not None else None,
                "FatPerServing": float(row.FatPerServing) if row.FatPerServing is not None else None,
                "SaturatedFatPerServing": float(row.SaturatedFatPerServing)
                if row.SaturatedFatPerServing is not None
                else None,
                "SugarPerServing": float(row.SugarPerServing) if row.SugarPerServing is not None else None,
                "SodiumPerServing": float(row.SodiumPerServing) if row.SodiumPerServing is not None else None,
                "DataSource": row.DataSource or "manual",
                "CountryCode": row.CountryCode or "AU",
                "IsFavourite": bool(row.IsFavourite),
                "ImageUrl": row.ImageUrl,
                "CreatedAt": row.CreatedAt.isoformat() if row.CreatedAt else None,
            }
        )
    return items


def UpsertProductReviewRecord(
    db: Session,
    user_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = UpsertProductReview(db, user_id, UpsertProductReviewInput(**payload))
    return item.model_dump(mode="json")


def GetProductReviewHistory(
    db: Session,
    user_id: int,
    limit: int = 200,
) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json") for item in GetProductReviews(db, user_id, limit=limit)]


def UpsertExperimentRecord(
    db: Session,
    user_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = UpsertExperiment(db, user_id, UpsertExperimentInput(**payload))
    return item.model_dump(mode="json")


def GetExperimentHistory(
    db: Session,
    user_id: int,
    limit: int = 200,
) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json") for item in GetExperiments(db, user_id, limit=limit)]


def UpsertMeasurementRecord(
    db: Session,
    user_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = UpsertBodyMeasurement(db, user_id, UpsertBodyMeasurementInput(**payload))
    return item.model_dump(mode="json")


def GetMeasurementHistory(
    db: Session,
    user_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json") for item in GetBodyMeasurements(db, user_id, start_date, end_date, limit)]


def UpsertWeeklyReviewNoteRecord(
    db: Session,
    user_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = UpsertWeeklyReviewNote(db, user_id, UpsertWeeklyReviewNoteInput(**payload))
    return item.model_dump(mode="json")


def GetWeeklyReviewNoteRecord(
    db: Session,
    user_id: int,
    week_start: str,
) -> dict[str, Any] | None:
    item = GetWeeklyReviewNote(db, user_id, week_start)
    return item.model_dump(mode="json") if item else None


def GetWeeklyReviewView(
    db: Session,
    user_id: int,
    week_start: str,
) -> dict[str, Any]:
    return GetWeeklyReviewSnapshot(db, user_id, week_start).model_dump(mode="json")


def UpsertInsightRecord(
    db: Session,
    user_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = UpsertInsight(db, user_id, UpsertInsightInput(**payload))
    return item.model_dump(mode="json")


def GetInsightHistory(
    db: Session,
    user_id: int,
    insight_type: str | None = None,
    period_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    status: str | None = None,
    source: str | None = None,
    tag: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    return [
        item.model_dump(mode="json")
        for item in GetInsights(
            db,
            user_id,
            insight_type=insight_type,
            period_type=period_type,
            start_date=start_date,
            end_date=end_date,
            status=status,
            source=source,
            tag=tag,
            limit=limit,
        )
    ]
