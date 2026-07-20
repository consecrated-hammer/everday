from __future__ import annotations

import json
from datetime import date, datetime, timedelta
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.health.models import (
    BodyMeasurement as BodyMeasurementModel,
    DailyLog as DailyLogModel,
    Experiment as ExperimentModel,
    Food as FoodModel,
    Insight as InsightModel,
    ProductReview as ProductReviewModel,
    RecipeReview as RecipeReviewModel,
    WeeklyReviewNote as WeeklyReviewNoteModel,
)
from app.modules.health.schemas import (
    BodyMeasurement,
    CreateRecipeReviewInput,
    Experiment,
    Insight,
    ProductReview,
    RecipeReview,
    RecipeStat,
    UpsertBodyMeasurementInput,
    UpsertExperimentInput,
    UpsertInsightInput,
    UpsertProductReviewInput,
    UpsertWeeklyReviewNoteInput,
    UpdateRecipeReviewInput,
    WeeklyReviewNote,
    WeeklyReviewSnapshot,
)
from app.modules.health.services.daily_logs_service import GetDailyLogByDate, GetEntriesForLog, GetWeightHistory
from app.modules.health.services.summary_service import GetWeeklySummary
from app.modules.health.utils.dates import ParseIsoDate


YES_NO_MAYBE_VALUES = {"yes", "no", "maybe", "pending", "adopt", "reject", "inconclusive", "keep testing"}
YES_NO_VALUES = {"yes", "no", "maybe"}
HALL_OF_FAME_VALUES = {"yes", "no"}
INSIGHT_STATUS_VALUES = {"active", "superseded", "archived"}
INSIGHT_CONFIDENCE_VALUES = {"low", "medium", "high"}
INSIGHT_PERIOD_VALUES = {"day", "week", "month", "custom"}


def _normalize_optional_enum(value: str | None, allowed: set[str]) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    lowered = cleaned.lower()
    if lowered not in allowed:
        raise ValueError(f"Unsupported value: {cleaned}")
    return lowered


def _hall_of_fame_override_for_rating(rating: float | None, override: str | None) -> str | None:
    return override if rating is not None else None


def _is_hall_of_fame(value: str | None) -> bool:
    return value == "yes"


def _build_recipe_review(row: RecipeReviewModel) -> RecipeReview:
    return RecipeReview(
        RecipeReviewId=row.RecipeReviewId,
        RecipeName=row.RecipeName,
        LogDate=row.LogDate,
        MealEntryId=row.MealEntryId,
        Rating=float(row.Rating) if row.Rating is not None else None,
        WouldMakeAgain=row.WouldMakeAgain,
        HallOfFameOverride=row.HallOfFameOverride,
        Notes=row.Notes,
        CreatedAt=row.CreatedAt,
        UpdatedAt=row.UpdatedAt,
    )


def _build_product_review(row: ProductReviewModel) -> ProductReview:
    return ProductReview(
        ProductReviewId=row.ProductReviewId,
        FoodId=row.FoodId,
        ProductName=row.ProductName,
        Brand=row.Brand,
        Category=row.Category,
        BuyAgain=row.BuyAgain,
        Rating=float(row.Rating) if row.Rating is not None else None,
        CaloriesPerServing=int(row.CaloriesPerServing) if row.CaloriesPerServing is not None else None,
        ProteinPerServing=float(row.ProteinPerServing) if row.ProteinPerServing is not None else None,
        Notes=row.Notes,
        CreatedAt=row.CreatedAt,
        UpdatedAt=row.UpdatedAt,
    )


def _build_experiment(row: ExperimentModel) -> Experiment:
    duration_days = None
    if row.EndDate is not None:
        duration_days = (row.EndDate - row.StartDate).days + 1
    else:
        duration_days = (date.today() - row.StartDate).days + 1
    return Experiment(
        ExperimentId=row.ExperimentId,
        StartDate=row.StartDate,
        EndDate=row.EndDate,
        VariableChanged=row.VariableChanged,
        Reason=row.Reason,
        ExpectedOutcome=row.ExpectedOutcome,
        ActualOutcome=row.ActualOutcome,
        Decision=row.Decision,
        Status=row.Status,
        DurationDays=max(duration_days, 1),
        CreatedAt=row.CreatedAt,
        UpdatedAt=row.UpdatedAt,
    )


def _build_body_measurement(row: BodyMeasurementModel, weight_kg: float | None) -> BodyMeasurement:
    return BodyMeasurement(
        BodyMeasurementId=row.BodyMeasurementId,
        LogDate=row.LogDate,
        WaistCm=float(row.WaistCm) if row.WaistCm is not None else None,
        HipsCm=float(row.HipsCm) if row.HipsCm is not None else None,
        RestingHeartRate=int(row.RestingHeartRate) if row.RestingHeartRate is not None else None,
        PeriodCycleNotes=row.PeriodCycleNotes,
        Notes=row.Notes,
        WeightKg=weight_kg,
        CreatedAt=row.CreatedAt,
        UpdatedAt=row.UpdatedAt,
    )


def _build_weekly_review_note(row: WeeklyReviewNoteModel) -> WeeklyReviewNote:
    return WeeklyReviewNote(
        WeeklyReviewNoteId=row.WeeklyReviewNoteId,
        WeekStart=row.WeekStart,
        BiggestNutritionWin=row.BiggestNutritionWin,
        ImprovementForNextWeek=row.ImprovementForNextWeek,
        CreatedAt=row.CreatedAt,
        UpdatedAt=row.UpdatedAt,
    )


def _normalize_json_dict(value: object | None) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    raise ValueError("Payload must be a JSON object.")


def _normalize_tags(value: list[str] | None) -> list[str]:
    if not value:
        return []
    items: list[str] = []
    for tag in value:
        cleaned = str(tag or "").strip()
        if cleaned:
            items.append(cleaned)
    seen: set[str] = set()
    unique: list[str] = []
    for tag in items:
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(tag)
    return unique


def _build_insight(row: InsightModel) -> Insight:
    payload = json.loads(row.PayloadJson) if row.PayloadJson else None
    tags = json.loads(row.TagsJson) if row.TagsJson else []
    return Insight(
        InsightId=row.InsightId,
        InsightType=row.InsightType,
        PeriodType=row.PeriodType,
        PeriodStart=row.PeriodStart,
        PeriodEnd=row.PeriodEnd,
        Title=row.Title,
        Summary=row.Summary,
        Confidence=row.Confidence,
        Status=row.Status,
        Source=row.Source,
        SchemaVersion=row.SchemaVersion,
        Payload=payload,
        Tags=tags,
        CreatedAt=row.CreatedAt,
        UpdatedAt=row.UpdatedAt,
    )


def UpsertRecipeReview(db: Session, user_id: int, payload: CreateRecipeReviewInput | UpdateRecipeReviewInput, review_id: str | None = None) -> RecipeReview:
    log_date = ParseIsoDate(payload.LogDate) if getattr(payload, "LogDate", None) else None
    supplied_fields = payload.model_fields_set
    recipe_name = str(getattr(payload, "RecipeName", "") or "").strip()

    if review_id:
        row = db.query(RecipeReviewModel).filter(RecipeReviewModel.RecipeReviewId == review_id, RecipeReviewModel.UserId == user_id).first()
        if row is None:
            raise ValueError("Recipe review not found.")
    else:
        if not recipe_name or log_date is None:
            raise ValueError("RecipeName and LogDate are required.")
        row = (
            db.query(RecipeReviewModel)
            .filter(
                RecipeReviewModel.UserId == user_id,
                RecipeReviewModel.RecipeName == recipe_name,
                RecipeReviewModel.LogDate == log_date,
            )
            .first()
        )
        if row is None:
            row = RecipeReviewModel(
                RecipeReviewId=str(uuid.uuid4()),
                UserId=user_id,
                RecipeName=recipe_name,
                LogDate=log_date,
            )
            db.add(row)

    if recipe_name:
        row.RecipeName = recipe_name
    if log_date is not None:
        row.LogDate = log_date
    if not review_id or "MealEntryId" in supplied_fields:
        row.MealEntryId = getattr(payload, "MealEntryId", None)
    if not review_id or "Rating" in supplied_fields:
        row.Rating = getattr(payload, "Rating", None)
    if not review_id or "WouldMakeAgain" in supplied_fields:
        row.WouldMakeAgain = _normalize_optional_enum(getattr(payload, "WouldMakeAgain", None), YES_NO_VALUES)
    if not review_id or "HallOfFameOverride" in supplied_fields:
        row.HallOfFameOverride = _normalize_optional_enum(
            getattr(payload, "HallOfFameOverride", None), HALL_OF_FAME_VALUES
        )
    if not review_id or "Notes" in supplied_fields:
        row.Notes = getattr(payload, "Notes", None)
    row.HallOfFameOverride = _hall_of_fame_override_for_rating(
        float(row.Rating) if row.Rating is not None else None,
        row.HallOfFameOverride,
    )
    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _build_recipe_review(row)


def GetRecipeReviews(db: Session, user_id: int, limit: int = 200) -> list[RecipeReview]:
    rows = (
        db.query(RecipeReviewModel)
        .filter(RecipeReviewModel.UserId == user_id)
        .order_by(RecipeReviewModel.LogDate.desc(), RecipeReviewModel.CreatedAt.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [_build_recipe_review(row) for row in rows]


def DeleteRecipeReview(db: Session, user_id: int, review_id: str) -> None:
    row = db.query(RecipeReviewModel).filter(
        RecipeReviewModel.RecipeReviewId == review_id,
        RecipeReviewModel.UserId == user_id,
    ).first()
    if row is None:
        raise ValueError("Recipe review not found.")
    db.delete(row)
    db.commit()


def GetRecipeStats(db: Session, user_id: int, start_date: str | None = None, end_date: str | None = None, limit: int = 100) -> list[RecipeStat]:
    recipe_reviews_query = db.query(RecipeReviewModel).filter(RecipeReviewModel.UserId == user_id)
    if start_date:
        recipe_reviews_query = recipe_reviews_query.filter(RecipeReviewModel.LogDate >= ParseIsoDate(start_date))
    if end_date:
        recipe_reviews_query = recipe_reviews_query.filter(RecipeReviewModel.LogDate <= ParseIsoDate(end_date))
    review_rows = recipe_reviews_query.all()

    aggregated: dict[str, dict[str, object]] = {}
    for row in review_rows:
        if row.Rating is None:
            continue
        bucket = aggregated.setdefault(
            row.RecipeName,
            {
                "RecipeName": row.RecipeName,
                "TimesEaten": 0,
                "Calories": [],
                "Protein": [],
                "LatestLogDate": row.LogDate,
                "Notes": [],
                "Ratings": [],
                "WouldMakeAgain": [],
                "HallOfFameOverride": [],
            },
        )
        bucket["TimesEaten"] = int(bucket["TimesEaten"]) + 1
        if row.Rating is not None:
            bucket["Ratings"].append(float(row.Rating))
        if row.Notes:
            bucket["Notes"].append(row.Notes)
        if row.HallOfFameOverride:
            bucket["HallOfFameOverride"].append(row.HallOfFameOverride)
        bucket["LatestLogDate"] = max(bucket["LatestLogDate"], row.LogDate)

    items: list[RecipeStat] = []
    for bucket in aggregated.values():
        calories = bucket["Calories"]
        protein = bucket["Protein"]
        ratings = bucket["Ratings"]
        hall_of_fame_values = bucket["HallOfFameOverride"]
        notes = bucket["Notes"]
        hall_of_fame = hall_of_fame_values[-1] if hall_of_fame_values else ("yes" if ratings and max(ratings) >= 9 else "no")
        items.append(
            RecipeStat(
                RecipeName=str(bucket["RecipeName"]),
                TimesEaten=int(bucket["TimesEaten"]),
                AverageRating=round(sum(ratings) / len(ratings), 2) if ratings else None,
                AverageCalories=round(sum(calories) / len(calories), 2) if calories else None,
                AverageProtein=round(sum(protein) / len(protein), 2) if protein else None,
                HallOfFame=_is_hall_of_fame(hall_of_fame),
                Notes=notes[-1] if notes else None,
                LatestLogDate=bucket["LatestLogDate"],
            )
        )

    items.sort(key=lambda item: ((item.AverageRating or -1), item.TimesEaten, item.RecipeName), reverse=True)
    return items[: max(1, min(limit, 500))]


def UpsertProductReview(db: Session, user_id: int, payload: UpsertProductReviewInput) -> ProductReview:
    product_name = payload.ProductName.strip()
    brand = payload.Brand.strip() if payload.Brand else None
    row = (
        db.query(ProductReviewModel)
        .filter(
            ProductReviewModel.UserId == user_id,
            ProductReviewModel.ProductName == product_name,
            ProductReviewModel.Brand == brand,
        )
        .first()
    )
    if row is None:
        row = ProductReviewModel(
            ProductReviewId=str(uuid.uuid4()),
            UserId=user_id,
            ProductName=product_name,
            Brand=brand,
        )
        db.add(row)
    row.FoodId = payload.FoodId
    row.ProductName = product_name
    row.Brand = brand
    row.Category = payload.Category.strip() if payload.Category else None
    row.BuyAgain = _normalize_optional_enum(payload.BuyAgain, YES_NO_VALUES)
    row.Rating = payload.Rating
    row.CaloriesPerServing = payload.CaloriesPerServing
    row.ProteinPerServing = payload.ProteinPerServing
    row.Notes = payload.Notes
    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _build_product_review(row)


def UpsertInsight(db: Session, user_id: int, payload: UpsertInsightInput) -> Insight:
    insight_id = str(payload.InsightId or "").strip() or None
    status = _normalize_optional_enum(payload.Status, INSIGHT_STATUS_VALUES) or "active"
    confidence = _normalize_optional_enum(payload.Confidence, INSIGHT_CONFIDENCE_VALUES)
    period_type = _normalize_optional_enum(payload.PeriodType, INSIGHT_PERIOD_VALUES)
    if period_type is None:
        raise ValueError("PeriodType is required.")
    insight_type = payload.InsightType.strip()
    title = payload.Title.strip()
    if not insight_type or not title:
        raise ValueError("InsightType and Title are required.")
    payload_dict = _normalize_json_dict(payload.Payload)
    tags = _normalize_tags(payload.Tags)

    row = None
    if insight_id:
        row = db.query(InsightModel).filter(InsightModel.InsightId == insight_id, InsightModel.UserId == user_id).first()
        if row is None:
            raise ValueError("Insight not found.")
    if row is None:
        row = (
            db.query(InsightModel)
            .filter(
                InsightModel.UserId == user_id,
                InsightModel.InsightType == insight_type,
                InsightModel.PeriodType == period_type,
                InsightModel.PeriodStart == payload.PeriodStart,
                InsightModel.Title == title,
                InsightModel.Source == payload.Source.strip().lower(),
            )
            .first()
        )
    if row is None:
        row = InsightModel(
            InsightId=str(uuid.uuid4()),
            UserId=user_id,
        )
        db.add(row)

    row.InsightType = insight_type
    row.PeriodType = period_type
    row.PeriodStart = payload.PeriodStart
    row.PeriodEnd = payload.PeriodEnd
    row.Title = title
    row.Summary = payload.Summary
    row.Confidence = confidence
    row.Status = status
    row.Source = payload.Source.strip().lower()
    row.SchemaVersion = payload.SchemaVersion
    row.PayloadJson = json.dumps(payload_dict, ensure_ascii=True, separators=(",", ":")) if payload_dict is not None else None
    row.TagsJson = json.dumps(tags, ensure_ascii=True, separators=(",", ":"))
    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _build_insight(row)


def GetInsights(
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
) -> list[Insight]:
    query = db.query(InsightModel).filter(InsightModel.UserId == user_id)
    if insight_type:
        query = query.filter(InsightModel.InsightType == insight_type.strip())
    if period_type:
        normalized_period_type = _normalize_optional_enum(period_type, INSIGHT_PERIOD_VALUES)
        if normalized_period_type is None:
            raise ValueError("Invalid period type.")
        query = query.filter(InsightModel.PeriodType == normalized_period_type)
    if status:
        normalized_status = _normalize_optional_enum(status, INSIGHT_STATUS_VALUES)
        if normalized_status is None:
            raise ValueError("Invalid insight status.")
        query = query.filter(InsightModel.Status == normalized_status)
    if source:
        query = query.filter(InsightModel.Source == source.strip().lower())
    if start_date:
        query = query.filter(InsightModel.PeriodStart >= ParseIsoDate(start_date))
    if end_date:
        query = query.filter(InsightModel.PeriodStart <= ParseIsoDate(end_date))
    if tag:
        like_value = f"%\"{tag.strip()}\"%"
        query = query.filter(InsightModel.TagsJson.like(like_value))

    rows = (
        query.order_by(
            InsightModel.PeriodStart.desc(),
            InsightModel.UpdatedAt.desc(),
            InsightModel.InsightId.desc(),
        )
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [_build_insight(row) for row in rows]


def GetProductReviews(db: Session, user_id: int, limit: int = 200) -> list[ProductReview]:
    rows = (
        db.query(ProductReviewModel)
        .filter(ProductReviewModel.UserId == user_id)
        .order_by(ProductReviewModel.ProductName.asc(), ProductReviewModel.CreatedAt.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [_build_product_review(row) for row in rows]


def UpsertExperiment(db: Session, user_id: int, payload: UpsertExperimentInput) -> Experiment:
    start_date = ParseIsoDate(payload.StartDate)
    end_date = ParseIsoDate(payload.EndDate) if payload.EndDate else None
    if end_date is not None and end_date < start_date:
        raise ValueError("EndDate must be on or after StartDate.")
    row: ExperimentModel | None = None
    if payload.ExperimentId:
        row = db.query(ExperimentModel).filter(ExperimentModel.ExperimentId == payload.ExperimentId, ExperimentModel.UserId == user_id).first()
        if row is None:
            raise ValueError("Experiment not found.")
    if row is None:
        row = ExperimentModel(
            ExperimentId=str(uuid.uuid4()),
            UserId=user_id,
            StartDate=start_date,
        )
        db.add(row)
    row.StartDate = start_date
    row.EndDate = end_date
    row.VariableChanged = payload.VariableChanged.strip()
    row.Reason = payload.Reason
    row.ExpectedOutcome = payload.ExpectedOutcome
    row.ActualOutcome = payload.ActualOutcome
    row.Decision = _normalize_optional_enum(payload.Decision, YES_NO_MAYBE_VALUES) if payload.Decision else None
    row.Status = payload.Status.strip()
    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _build_experiment(row)


def GetExperiments(db: Session, user_id: int, limit: int = 200) -> list[Experiment]:
    rows = (
        db.query(ExperimentModel)
        .filter(ExperimentModel.UserId == user_id)
        .order_by(ExperimentModel.StartDate.desc(), ExperimentModel.CreatedAt.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [_build_experiment(row) for row in rows]


def UpsertBodyMeasurement(db: Session, user_id: int, payload: UpsertBodyMeasurementInput) -> BodyMeasurement:
    log_date = ParseIsoDate(payload.LogDate)
    row = (
        db.query(BodyMeasurementModel)
        .filter(BodyMeasurementModel.UserId == user_id, BodyMeasurementModel.LogDate == log_date)
        .first()
    )
    if row is None:
        row = BodyMeasurementModel(
            BodyMeasurementId=str(uuid.uuid4()),
            UserId=user_id,
            LogDate=log_date,
        )
        db.add(row)
    row.WaistCm = payload.WaistCm
    row.HipsCm = payload.HipsCm
    row.RestingHeartRate = payload.RestingHeartRate
    if payload.RestingHeartRate is not None:
        row.RestingHeartRateUpdatedAt = datetime.utcnow()
        row.RestingHeartRateSource = "user"
    row.PeriodCycleNotes = payload.PeriodCycleNotes
    row.Notes = payload.Notes
    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    weight = GetDailyLogByDate(db, user_id, log_date)
    return _build_body_measurement(row, weight.WeightKg if weight else None)


def GetBodyMeasurements(db: Session, user_id: int, start_date: str | None = None, end_date: str | None = None, limit: int = 200) -> list[BodyMeasurement]:
    query = db.query(BodyMeasurementModel).filter(BodyMeasurementModel.UserId == user_id)
    if start_date:
        query = query.filter(BodyMeasurementModel.LogDate >= ParseIsoDate(start_date))
    if end_date:
        query = query.filter(BodyMeasurementModel.LogDate <= ParseIsoDate(end_date))
    rows = query.order_by(BodyMeasurementModel.LogDate.desc()).limit(max(1, min(limit, 500))).all()
    items: list[BodyMeasurement] = []
    for row in rows:
        weight = GetDailyLogByDate(db, user_id, row.LogDate)
        items.append(_build_body_measurement(row, weight.WeightKg if weight else None))
    return items


def UpsertWeeklyReviewNote(db: Session, user_id: int, payload: UpsertWeeklyReviewNoteInput) -> WeeklyReviewNote:
    week_start = ParseIsoDate(payload.WeekStart)
    row = (
        db.query(WeeklyReviewNoteModel)
        .filter(WeeklyReviewNoteModel.UserId == user_id, WeeklyReviewNoteModel.WeekStart == week_start)
        .first()
    )
    if row is None:
        row = WeeklyReviewNoteModel(
            WeeklyReviewNoteId=str(uuid.uuid4()),
            UserId=user_id,
            WeekStart=week_start,
        )
        db.add(row)
    row.BiggestNutritionWin = payload.BiggestNutritionWin
    row.ImprovementForNextWeek = payload.ImprovementForNextWeek
    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _build_weekly_review_note(row)


def GetWeeklyReviewNote(db: Session, user_id: int, week_start: str) -> WeeklyReviewNote | None:
    row = (
        db.query(WeeklyReviewNoteModel)
        .filter(WeeklyReviewNoteModel.UserId == user_id, WeeklyReviewNoteModel.WeekStart == ParseIsoDate(week_start))
        .first()
    )
    return _build_weekly_review_note(row) if row else None


def GetWeeklyReviewSnapshot(db: Session, user_id: int, week_start: str) -> WeeklyReviewSnapshot:
    start_value = ParseIsoDate(week_start)
    end_value = start_value + timedelta(days=6)
    weekly_summary = GetWeeklySummary(db, user_id, start_value.isoformat())
    note = GetWeeklyReviewNote(db, user_id, start_value.isoformat())
    logs = (
        db.query(DailyLogModel)
        .filter(
            DailyLogModel.UserId == user_id,
            DailyLogModel.LogDate >= start_value,
            DailyLogModel.LogDate <= end_value,
        )
        .order_by(DailyLogModel.LogDate.asc())
        .all()
    )

    best_meal: tuple[float, str] | None = None
    worst_meal: tuple[float, str] | None = None
    highest_recipe: tuple[float, str] | None = None
    sleep_values: list[float] = []
    adherence_values: list[int] = []
    friday_takeaway = None

    reviews = {
        (review.LogDate, review.RecipeName): review
        for review in db.query(RecipeReviewModel)
        .filter(
            RecipeReviewModel.UserId == user_id,
            RecipeReviewModel.LogDate >= start_value,
            RecipeReviewModel.LogDate <= end_value,
        )
        .all()
    }

    for log in logs:
        if log.SleepHours is not None:
            sleep_values.append(float(log.SleepHours))
        if log.AdherentDay is not None:
            adherence_values.append(1 if bool(log.AdherentDay) else 0)
        if log.LogDate.weekday() == 4:
            friday_takeaway = bool(log.Takeaway) if log.Takeaway is not None else None
        for entry in GetEntriesForLog(db, user_id, log.DailyLogId):
            recipe_name = str(entry.TemplateName or entry.FoodName or "").strip()
            review = reviews.get((log.LogDate, recipe_name))
            if review is None or review.Rating is None:
                continue
            label = recipe_name
            rating = float(review.Rating)
            if best_meal is None or rating > best_meal[0]:
                best_meal = (rating, label)
            if worst_meal is None or rating < worst_meal[0]:
                worst_meal = (rating, label)
            if highest_recipe is None or rating > highest_recipe[0]:
                highest_recipe = (rating, label)

    weight_change = None
    weights = GetWeightHistory(db, user_id, start_value.isoformat(), end_value.isoformat())
    if len(weights) >= 2:
        weight_change = round(float(weights[-1].WeightKg) - float(weights[0].WeightKg), 2)

    averages = weekly_summary.Averages if weekly_summary.Days else {}
    return WeeklyReviewSnapshot(
        WeekStart=start_value,
        WeekEnd=end_value,
        AverageCalories=float(averages.get("AverageCalories")) if averages.get("AverageCalories") is not None else None,
        AverageProtein=float(averages.get("AverageProtein")) if averages.get("AverageProtein") is not None else None,
        AverageCarbs=float(averages.get("AverageCarbs")) if averages.get("AverageCarbs") is not None else None,
        AverageFat=float(averages.get("AverageFat")) if averages.get("AverageFat") is not None else None,
        AverageFibre=float(averages.get("AverageFibre")) if averages.get("AverageFibre") is not None else None,
        AverageSteps=float(averages.get("AverageSteps")) if averages.get("AverageSteps") is not None else None,
        AverageSleep=round(sum(sleep_values) / len(sleep_values), 2) if sleep_values else None,
        WeightChange=weight_change,
        AdherenceRatio=round(sum(adherence_values) / len(adherence_values), 4) if adherence_values else None,
        BestMeal=best_meal[1] if best_meal else None,
        WorstMeal=worst_meal[1] if worst_meal else None,
        HighestRatedRecipe=highest_recipe[1] if highest_recipe else None,
        FridayTakeaway=friday_takeaway,
        Note=note,
    )
