import logging
from datetime import datetime, timezone
import uuid
from datetime import date

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.health.models import DailyLog as DailyLogModel
from app.modules.health.models import Food as FoodModel
from app.modules.health.models import MealEntry as MealEntryModel
from app.modules.health.models import MealTemplate as MealTemplateModel
from app.modules.health.models import MealTemplateItem as MealTemplateItemModel
from app.modules.health.models import ScheduleSlot as ScheduleSlotModel
from app.modules.health.schemas import (
    CreateDailyLogInput,
    CreateMealEntryInput,
    DailyLog,
    MealEntry,
    MealEntryWithFood,
    ShareMealEntryInput,
    StepsHistoryEntry,
    UpdateMealEntryInput,
    WeightHistoryEntry,
)
from app.modules.health.services.portion_entry_service import BuildPortionValues
from app.modules.health.services.metric_entries_service import RecordMetricEntry
from app.modules.health.utils.dates import ParseIsoDate
from app.modules.notifications.services import CreateNotification

logger = logging.getLogger("health.daily_logs")


def _DisplayName(user: User) -> str:
    if user.FirstName:
        return user.FirstName.strip()
    if user.LastName:
        return user.LastName.strip()
    return user.Username


def _FormatShortDate(value: str) -> str:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").date()
        return parsed.strftime("%a %d %b")
    except ValueError:
        return value


def _BuildDailyLog(log: DailyLogModel) -> DailyLog:
    return DailyLog(
        DailyLogId=log.DailyLogId,
        LogDate=log.LogDate,
        Steps=log.Steps,
        StepKcalFactorOverride=float(log.StepKcalFactorOverride)
        if log.StepKcalFactorOverride is not None
        else None,
        WeightKg=float(log.WeightKg) if log.WeightKg is not None else None,
        Notes=log.Notes,
    )


def GetDailyLogByDate(db: Session, UserId: int, LogDate: str | date) -> DailyLog | None:
    LogDateValue = LogDate if isinstance(LogDate, date) else ParseIsoDate(LogDate)
    record = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.LogDate == LogDateValue)
        .first()
    )
    if not record:
        return None
    return _BuildDailyLog(record)


def GetDailyLogById(db: Session, UserId: int, DailyLogId: str) -> DailyLog | None:
    record = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.DailyLogId == DailyLogId)
        .first()
    )
    if not record:
        return None
    return _BuildDailyLog(record)


def GetWeightHistory(
    db: Session,
    UserId: int,
    StartDate: str,
    EndDate: str,
) -> list[WeightHistoryEntry]:
    StartValue = ParseIsoDate(StartDate)
    EndValue = ParseIsoDate(EndDate)
    if EndValue < StartValue:
        raise ValueError("End date must be on or after the start date.")
    rows = (
        db.query(DailyLogModel)
        .filter(
            DailyLogModel.UserId == UserId,
            DailyLogModel.LogDate >= StartValue,
            DailyLogModel.LogDate <= EndValue,
            DailyLogModel.WeightKg.isnot(None),
        )
        .order_by(DailyLogModel.LogDate.asc())
        .all()
    )
    return [
        WeightHistoryEntry(LogDate=row.LogDate, WeightKg=float(row.WeightKg))
        for row in rows
        if row.WeightKg is not None
    ]


def GetStepsHistory(
    db: Session,
    UserId: int,
    StartDate: str,
    EndDate: str,
) -> list[StepsHistoryEntry]:
    StartValue = ParseIsoDate(StartDate)
    EndValue = ParseIsoDate(EndDate)
    if EndValue < StartValue:
        raise ValueError("End date must be on or after the start date.")
    rows = (
        db.query(DailyLogModel)
        .filter(
            DailyLogModel.UserId == UserId,
            DailyLogModel.LogDate >= StartValue,
            DailyLogModel.LogDate <= EndValue,
        )
        .order_by(DailyLogModel.LogDate.asc())
        .all()
    )
    return [StepsHistoryEntry(LogDate=row.LogDate, Steps=int(row.Steps or 0)) for row in rows]


def _BuildMealEntrySchema(entry: MealEntryModel) -> MealEntry:
    return MealEntry(
        MealEntryId=entry.MealEntryId,
        DailyLogId=entry.DailyLogId,
        MealType=entry.MealType,
        FoodId=entry.FoodId,
        MealTemplateId=entry.MealTemplateId,
        Quantity=float(entry.Quantity),
        DisplayQuantity=float(entry.DisplayQuantity) if entry.DisplayQuantity is not None else None,
        PortionOptionId=entry.PortionOptionId,
        PortionLabel=entry.PortionLabel,
        PortionBaseUnit=entry.PortionBaseUnit,
        PortionBaseAmount=float(entry.PortionBaseAmount) if entry.PortionBaseAmount is not None else None,
        PortionBaseTotal=float(entry.PortionBaseTotal) if entry.PortionBaseTotal is not None else None,
        EntryNotes=entry.EntryNotes,
        SortOrder=entry.SortOrder,
        ScheduleSlotId=entry.ScheduleSlotId,
        CreatedAt=entry.CreatedAt,
    )


def _BuildTemplateTotals(db: Session, MealTemplateId: str) -> dict:
    rows = (
        db.query(MealTemplateItemModel, FoodModel)
        .join(FoodModel, FoodModel.FoodId == MealTemplateItemModel.FoodId)
        .filter(MealTemplateItemModel.MealTemplateId == MealTemplateId)
        .all()
    )

    totals = {
        "Calories": 0.0,
        "Protein": 0.0,
        "Fibre": 0.0,
        "Carbs": 0.0,
        "Fat": 0.0,
        "SaturatedFat": 0.0,
        "Sugar": 0.0,
        "Sodium": 0.0,
    }

    for item, food in rows:
        quantity = float(item.Quantity)
        totals["Calories"] += int(food.CaloriesPerServing) * quantity
        totals["Protein"] += float(food.ProteinPerServing) * quantity
        totals["Fibre"] += float(food.FibrePerServing or 0) * quantity
        totals["Carbs"] += float(food.CarbsPerServing or 0) * quantity
        totals["Fat"] += float(food.FatPerServing or 0) * quantity
        totals["SaturatedFat"] += float(food.SaturatedFatPerServing or 0) * quantity
        totals["Sugar"] += float(food.SugarPerServing or 0) * quantity
        totals["Sodium"] += float(food.SodiumPerServing or 0) * quantity

    return totals


def GetEntriesForLog(db: Session, UserId: int, DailyLogId: str) -> list[MealEntryWithFood]:
    rows = (
        db.query(MealEntryModel, FoodModel, MealTemplateModel)
        .join(DailyLogModel, DailyLogModel.DailyLogId == MealEntryModel.DailyLogId)
        .outerjoin(FoodModel, FoodModel.FoodId == MealEntryModel.FoodId)
        .outerjoin(MealTemplateModel, MealTemplateModel.MealTemplateId == MealEntryModel.MealTemplateId)
        .filter(MealEntryModel.DailyLogId == DailyLogId, DailyLogModel.UserId == UserId)
        .order_by(MealEntryModel.MealType, MealEntryModel.SortOrder, MealEntryModel.CreatedAt)
        .all()
    )

    results: list[MealEntryWithFood] = []
    for entry, food, template in rows:
        if entry.MealTemplateId:
            totals = _BuildTemplateTotals(db, entry.MealTemplateId)
            template_name = template.TemplateName if template else "Meal"
            servings = float(template.Servings) if template and template.Servings is not None else 1.0
            if servings <= 0:
                servings = 1.0
            per_serving = {
                "Calories": totals["Calories"] / servings,
                "Protein": totals["Protein"] / servings,
                "Fibre": totals["Fibre"] / servings,
                "Carbs": totals["Carbs"] / servings,
                "Fat": totals["Fat"] / servings,
                "SaturatedFat": totals["SaturatedFat"] / servings,
                "Sugar": totals["Sugar"] / servings,
                "Sodium": totals["Sodium"] / servings,
            }
            display_quantity = (
                float(entry.DisplayQuantity) if entry.DisplayQuantity is not None else float(entry.Quantity)
            )
            portion_label = entry.PortionLabel or "serving"
            portion_base_unit = entry.PortionBaseUnit or "each"
            portion_base_amount = (
                float(entry.PortionBaseAmount) if entry.PortionBaseAmount is not None else 1.0
            )
            portion_base_total = (
                float(entry.PortionBaseTotal) if entry.PortionBaseTotal is not None else None
            )
            results.append(
                MealEntryWithFood(
                    MealEntryId=entry.MealEntryId,
                    DailyLogId=entry.DailyLogId,
                    MealType=entry.MealType,
                    FoodId=None,
                    MealTemplateId=entry.MealTemplateId,
                    TemplateName=template_name,
                    FoodName=template_name,
                    ServingDescription="serving",
                    CaloriesPerServing=int(round(per_serving["Calories"])),
                    ProteinPerServing=float(per_serving["Protein"]),
                    FibrePerServing=float(per_serving["Fibre"]) if per_serving["Fibre"] else None,
                    CarbsPerServing=float(per_serving["Carbs"]) if per_serving["Carbs"] else None,
                    FatPerServing=float(per_serving["Fat"]) if per_serving["Fat"] else None,
                    SaturatedFatPerServing=float(per_serving["SaturatedFat"])
                    if per_serving["SaturatedFat"]
                    else None,
                    SugarPerServing=float(per_serving["Sugar"]) if per_serving["Sugar"] else None,
                    SodiumPerServing=float(per_serving["Sodium"]) if per_serving["Sodium"] else None,
                    Quantity=float(entry.Quantity),
                    DisplayQuantity=display_quantity,
                    PortionOptionId=entry.PortionOptionId,
                    PortionLabel=portion_label,
                    PortionBaseUnit=portion_base_unit,
                    PortionBaseAmount=portion_base_amount,
                    PortionBaseTotal=portion_base_total,
                    EntryNotes=entry.EntryNotes,
                    SortOrder=entry.SortOrder,
                    ScheduleSlotId=entry.ScheduleSlotId,
                    CreatedAt=entry.CreatedAt,
                )
            )
            continue

        if not food:
            continue

        results.append(
            MealEntryWithFood(
                MealEntryId=entry.MealEntryId,
                DailyLogId=entry.DailyLogId,
                MealType=entry.MealType,
                FoodId=entry.FoodId,
                MealTemplateId=None,
                TemplateName=None,
                FoodName=food.FoodName,
                ServingDescription=food.ServingDescription,
                CaloriesPerServing=int(food.CaloriesPerServing),
                ProteinPerServing=float(food.ProteinPerServing),
                FibrePerServing=float(food.FibrePerServing) if food.FibrePerServing is not None else None,
                CarbsPerServing=float(food.CarbsPerServing) if food.CarbsPerServing is not None else None,
                FatPerServing=float(food.FatPerServing) if food.FatPerServing is not None else None,
                SaturatedFatPerServing=float(food.SaturatedFatPerServing)
                if food.SaturatedFatPerServing is not None
                else None,
                SugarPerServing=float(food.SugarPerServing) if food.SugarPerServing is not None else None,
                SodiumPerServing=float(food.SodiumPerServing) if food.SodiumPerServing is not None else None,
                ImageUrl=food.ImageUrl,
                Quantity=float(entry.Quantity),
                DisplayQuantity=float(entry.DisplayQuantity) if entry.DisplayQuantity is not None else None,
                PortionOptionId=entry.PortionOptionId,
                PortionLabel=entry.PortionLabel,
                PortionBaseUnit=entry.PortionBaseUnit,
                PortionBaseAmount=float(entry.PortionBaseAmount) if entry.PortionBaseAmount is not None else None,
                PortionBaseTotal=float(entry.PortionBaseTotal) if entry.PortionBaseTotal is not None else None,
                EntryNotes=entry.EntryNotes,
                SortOrder=entry.SortOrder,
                ScheduleSlotId=entry.ScheduleSlotId,
                CreatedAt=entry.CreatedAt,
            )
        )

    return results


def UpsertDailyLog(db: Session, UserId: int, Input: CreateDailyLogInput) -> DailyLog:
    LogDateValue = ParseIsoDate(Input.LogDate)
    occurred_at = datetime.now(tz=timezone.utc)

    record = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.LogDate == LogDateValue)
        .first()
    )

    if record:
        steps_changed = record.Steps != Input.Steps
        weight_changed = (
            (record.WeightKg is None and Input.WeightKg is not None)
            or (record.WeightKg is not None and Input.WeightKg is None)
            or (record.WeightKg is not None and Input.WeightKg is not None and float(record.WeightKg) != Input.WeightKg)
        )
        record.StepKcalFactorOverride = Input.StepKcalFactorOverride
        record.Notes = Input.Notes
        if steps_changed:
            RecordMetricEntry(
                db,
                record,
                UserId,
                LogDateValue,
                "steps",
                float(Input.Steps),
                occurred_at,
                "user",
            )
        if weight_changed:
            if Input.WeightKg is None:
                record.WeightKg = None
                record.WeightUpdatedAt = occurred_at
                record.WeightSource = "user"
            else:
                RecordMetricEntry(
                    db,
                    record,
                    UserId,
                    LogDateValue,
                    "weight",
                    float(Input.WeightKg),
                    occurred_at,
                    "user",
                )
    else:
        record = DailyLogModel(
            DailyLogId=str(uuid.uuid4()),
            UserId=UserId,
            LogDate=LogDateValue,
            Steps=Input.Steps,
            StepKcalFactorOverride=Input.StepKcalFactorOverride,
            WeightKg=Input.WeightKg,
            Notes=Input.Notes,
        )
        if Input.Steps != 0:
            record.StepsUpdatedAt = occurred_at
            record.StepsSource = "user"
        if Input.WeightKg is not None:
            record.WeightUpdatedAt = occurred_at
            record.WeightSource = "user"
        db.add(record)
        if Input.Steps != 0:
            RecordMetricEntry(
                db,
                record,
                UserId,
                LogDateValue,
                "steps",
                float(Input.Steps),
                occurred_at,
                "user",
            )
        if Input.WeightKg is not None:
            RecordMetricEntry(
                db,
                record,
                UserId,
                LogDateValue,
                "weight",
                float(Input.WeightKg),
                occurred_at,
                "user",
            )

    db.commit()
    db.refresh(record)

    if Input.WeightKg is not None:
        UpdateUserWeightFromLatestLog(db, UserId)

    return _BuildDailyLog(record)


def UpdateSteps(
    db: Session,
    UserId: int,
    LogDate: str,
    Steps: int,
    StepKcalFactorOverride: float | None,
    WeightKg: float | None = None,
) -> DailyLog:
    LogDateValue = ParseIsoDate(LogDate)
    updated_at = datetime.now(tz=timezone.utc)

    record = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.LogDate == LogDateValue)
        .first()
    )

    if record:
        existing_step_override = (
            float(record.StepKcalFactorOverride) if record.StepKcalFactorOverride is not None else None
        )
        steps_changed = record.Steps != Steps or existing_step_override != StepKcalFactorOverride
        record.StepKcalFactorOverride = StepKcalFactorOverride
        if steps_changed:
            RecordMetricEntry(
                db,
                record,
                UserId,
                LogDateValue,
                "steps",
                float(Steps),
                updated_at,
                "user",
            )
        if WeightKg is not None:
            weight_changed = record.WeightKg is None or float(record.WeightKg) != WeightKg
            if weight_changed:
                RecordMetricEntry(
                    db,
                    record,
                    UserId,
                    LogDateValue,
                    "weight",
                    float(WeightKg),
                    updated_at,
                    "user",
                )
        elif record.WeightKg is not None:
            record.WeightKg = None
            record.WeightUpdatedAt = updated_at
            record.WeightSource = "user"
    else:
        record = DailyLogModel(
            DailyLogId=str(uuid.uuid4()),
            UserId=UserId,
            LogDate=LogDateValue,
            Steps=Steps,
            StepKcalFactorOverride=StepKcalFactorOverride,
            WeightKg=WeightKg,
        )
        db.add(record)
        RecordMetricEntry(
            db,
            record,
            UserId,
            LogDateValue,
            "steps",
            float(Steps),
            updated_at,
            "user",
        )
        if WeightKg is not None:
            RecordMetricEntry(
                db,
                record,
                UserId,
                LogDateValue,
                "weight",
                float(WeightKg),
                updated_at,
                "user",
            )

    db.commit()
    db.refresh(record)

    if WeightKg is not None:
        UpdateUserWeightFromLatestLog(db, UserId)

    return _BuildDailyLog(record)


def UpdateUserWeightFromLatestLog(db: Session, UserId: int) -> None:
    row = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.WeightKg.isnot(None))
        .order_by(DailyLogModel.LogDate.desc())
        .first()
    )
    if row is None or row.WeightKg is None:
        return

    user = db.query(User).filter(User.Id == UserId).first()
    if not user:
        return
    user.WeightKg = row.WeightKg
    db.add(user)
    db.commit()


def EnsureDailyLogForDate(db: Session, UserId: int, LogDate: str) -> DailyLog:
    existing = GetDailyLogByDate(db, UserId, LogDate)
    if existing is not None:
        return existing

    record = DailyLogModel(
        DailyLogId=str(uuid.uuid4()),
        UserId=UserId,
        LogDate=ParseIsoDate(LogDate),
        Steps=0,
        StepKcalFactorOverride=None,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = GetDailyLogByDate(db, UserId, LogDate)
        if existing is not None:
            return existing
        raise
    db.refresh(record)
    return _BuildDailyLog(record)


def CreateMealEntry(db: Session, UserId: int, Input: CreateMealEntryInput) -> MealEntry:
    log_row = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.DailyLogId == Input.DailyLogId, DailyLogModel.UserId == UserId)
        .first()
    )
    if log_row is None:
        raise ValueError("Daily log not found.")

    if (Input.FoodId and Input.MealTemplateId) or (not Input.FoodId and not Input.MealTemplateId):
        raise ValueError("Either FoodId or MealTemplateId must be provided (but not both).")

    food_row = None
    if Input.FoodId:
        food_row = db.query(FoodModel).filter(FoodModel.FoodId == Input.FoodId).first()
        if food_row is None:
            raise ValueError("Food not found.")

    if Input.MealTemplateId:
        template_row = (
            db.query(MealTemplateModel)
            .filter(
                MealTemplateModel.MealTemplateId == Input.MealTemplateId
            )
            .first()
        )
        if template_row is None:
            raise ValueError("Meal template not found.")

    if Input.ScheduleSlotId:
        slot_row = (
            db.query(ScheduleSlotModel)
            .filter(
                ScheduleSlotModel.ScheduleSlotId == Input.ScheduleSlotId,
                ScheduleSlotModel.UserId == UserId,
            )
            .first()
        )
        if slot_row is None:
            raise ValueError("Schedule slot not found.")

    Quantity = Input.Quantity
    PortionLabel = Input.PortionLabel
    PortionBaseUnit = Input.PortionBaseUnit
    PortionBaseAmount = Input.PortionBaseAmount
    PortionOptionId = Input.PortionOptionId
    PortionBaseTotal = None

    if Input.FoodId and food_row is not None:
        servings, resolved_unit, base_total = BuildPortionValues(
            food_row,
            Input.Quantity,
            PortionBaseUnit,
            PortionBaseAmount,
        )
        Quantity = servings
        PortionBaseUnit = resolved_unit
        PortionBaseTotal = base_total
    elif PortionBaseAmount is not None:
        PortionBaseTotal = float(Input.Quantity) * float(PortionBaseAmount)

    if Quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    record = MealEntryModel(
        MealEntryId=str(uuid.uuid4()),
        DailyLogId=Input.DailyLogId,
        MealType=Input.MealType,
        FoodId=Input.FoodId,
        MealTemplateId=Input.MealTemplateId,
        Quantity=Quantity,
        DisplayQuantity=Input.Quantity,
        PortionOptionId=PortionOptionId,
        PortionLabel=PortionLabel,
        PortionBaseUnit=PortionBaseUnit,
        PortionBaseAmount=PortionBaseAmount,
        PortionBaseTotal=PortionBaseTotal,
        EntryNotes=Input.EntryNotes,
        SortOrder=Input.SortOrder,
        ScheduleSlotId=Input.ScheduleSlotId,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return _BuildMealEntrySchema(record)


def ShareMealEntry(db: Session, UserId: int, Input: ShareMealEntryInput, IsAdmin: bool = False) -> MealEntry:
    if Input.TargetUserId != UserId and not IsAdmin:
        raise ValueError("Unauthorized")
    target = db.query(User).filter(User.Id == Input.TargetUserId).first()
    if not target:
        raise ValueError("User not found.")
    if target.Role != "Parent":
        raise ValueError("User not eligible for sharing.")
    daily_log = EnsureDailyLogForDate(db, Input.TargetUserId, Input.LogDate)
    max_sort = (
        db.query(func.max(MealEntryModel.SortOrder))
        .filter(MealEntryModel.DailyLogId == daily_log.DailyLogId)
        .scalar()
    )
    next_sort = int(max_sort or -1) + 1
    payload = CreateMealEntryInput(
        DailyLogId=daily_log.DailyLogId,
        MealType=Input.MealType,
        FoodId=Input.FoodId,
        MealTemplateId=Input.MealTemplateId,
        Quantity=Input.Quantity,
        PortionOptionId=Input.PortionOptionId,
        PortionLabel=Input.PortionLabel,
        PortionBaseUnit=Input.PortionBaseUnit,
        PortionBaseAmount=Input.PortionBaseAmount,
        EntryNotes=Input.EntryNotes,
        SortOrder=next_sort,
        ScheduleSlotId=Input.ScheduleSlotId,
    )
    meal_entry = CreateMealEntry(db, Input.TargetUserId, payload)
    try:
        actor = db.query(User).filter(User.Id == UserId).first()
        actor_name = _DisplayName(actor) if actor else "Someone"
        title = "Meal shared with you"
        meal_type = Input.MealType.value if hasattr(Input.MealType, "value") else str(Input.MealType)
        friendly_date = _FormatShortDate(Input.LogDate)
        body = f"{actor_name} shared {meal_type} for {friendly_date}."
        link_url = f"/health/log?date={Input.LogDate}"
        CreateNotification(
            db,
            user_id=Input.TargetUserId,
            created_by_user_id=UserId,
            title=title,
            body=body,
            notification_type="MealShare",
            link_url=link_url,
            action_label="Open log",
            action_type="link",
            source_module="health",
            source_id=meal_entry.MealEntryId,
            meta={"LogDate": Input.LogDate, "MealType": meal_type},
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to create share meal notification")
    return meal_entry


def DeleteMealEntry(db: Session, UserId: int, MealEntryId: str, IsAdmin: bool = False) -> None:
    query = db.query(MealEntryModel)
    if IsAdmin:
        record = query.filter(MealEntryModel.MealEntryId == MealEntryId).first()
    else:
        record = (
            query.join(DailyLogModel, DailyLogModel.DailyLogId == MealEntryModel.DailyLogId)
            .filter(MealEntryModel.MealEntryId == MealEntryId, DailyLogModel.UserId == UserId)
            .first()
        )

    if record is None:
        raise ValueError("Meal entry not found.")

    db.delete(record)
    db.commit()


def UpdateMealEntry(
    db: Session,
    UserId: int,
    MealEntryId: str,
    Input: UpdateMealEntryInput,
) -> MealEntry:
    record = (
        db.query(MealEntryModel)
        .join(DailyLogModel, DailyLogModel.DailyLogId == MealEntryModel.DailyLogId)
        .filter(MealEntryModel.MealEntryId == MealEntryId, DailyLogModel.UserId == UserId)
        .first()
    )
    if record is None:
        raise ValueError("Meal entry not found.")

    food_row = None
    if record.FoodId:
        food_row = db.query(FoodModel).filter(FoodModel.FoodId == record.FoodId).first()
        if food_row is None:
            raise ValueError("Food not found.")

    PortionLabel = Input.PortionLabel
    PortionBaseUnit = Input.PortionBaseUnit
    PortionBaseAmount = Input.PortionBaseAmount
    PortionOptionId = Input.PortionOptionId
    DisplayQuantity = Input.Quantity
    PortionBaseTotal = None
    Quantity = DisplayQuantity

    if food_row is not None:
        servings, resolved_unit, base_total = BuildPortionValues(
            food_row,
            DisplayQuantity,
            PortionBaseUnit,
            PortionBaseAmount,
        )
        Quantity = servings
        PortionBaseUnit = resolved_unit
        PortionBaseTotal = base_total
    elif PortionBaseAmount is not None:
        PortionBaseTotal = float(DisplayQuantity) * float(PortionBaseAmount)

    if Quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    if Input.MealType is not None:
        record.MealType = Input.MealType

    record.Quantity = Quantity
    record.DisplayQuantity = DisplayQuantity
    record.PortionOptionId = PortionOptionId
    record.PortionLabel = PortionLabel
    record.PortionBaseUnit = PortionBaseUnit
    record.PortionBaseAmount = PortionBaseAmount
    record.PortionBaseTotal = PortionBaseTotal
    record.EntryNotes = Input.EntryNotes

    db.add(record)
    db.commit()
    db.refresh(record)
    return _BuildMealEntrySchema(record)
