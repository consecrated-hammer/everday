import uuid
from datetime import date

from sqlalchemy import func
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
    UpdateMealEntryInput,
)
from app.modules.health.services.portion_entry_service import BuildPortionValues
from app.modules.health.utils.dates import ParseIsoDate


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
            display_quantity = (
                float(entry.DisplayQuantity) if entry.DisplayQuantity is not None else float(entry.Quantity)
            )
            portion_label = entry.PortionLabel or "meal"
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
                    ServingDescription="meal",
                    CaloriesPerServing=int(round(totals["Calories"])),
                    ProteinPerServing=float(totals["Protein"]),
                    FibrePerServing=float(totals["Fibre"]) if totals["Fibre"] else None,
                    CarbsPerServing=float(totals["Carbs"]) if totals["Carbs"] else None,
                    FatPerServing=float(totals["Fat"]) if totals["Fat"] else None,
                    SaturatedFatPerServing=float(totals["SaturatedFat"]) if totals["SaturatedFat"] else None,
                    SugarPerServing=float(totals["Sugar"]) if totals["Sugar"] else None,
                    SodiumPerServing=float(totals["Sodium"]) if totals["Sodium"] else None,
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

    record = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.LogDate == LogDateValue)
        .first()
    )

    if record:
        record.Steps = Input.Steps
        record.StepKcalFactorOverride = Input.StepKcalFactorOverride
        record.WeightKg = Input.WeightKg
        record.Notes = Input.Notes
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
        db.add(record)

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

    record = (
        db.query(DailyLogModel)
        .filter(DailyLogModel.UserId == UserId, DailyLogModel.LogDate == LogDateValue)
        .first()
    )

    if record:
        record.Steps = Steps
        record.StepKcalFactorOverride = StepKcalFactorOverride
        if WeightKg is not None:
            record.WeightKg = WeightKg
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
    db.commit()
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
                MealTemplateModel.MealTemplateId == Input.MealTemplateId,
                MealTemplateModel.UserId == UserId,
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
