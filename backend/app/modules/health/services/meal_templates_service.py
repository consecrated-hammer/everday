import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.health.models import (
    DailyLog as DailyLogModel,
    Food as FoodModel,
    MealEntry as MealEntryModel,
    MealTemplate as MealTemplateModel,
    MealTemplateItem as MealTemplateItemModel,
)
from app.modules.health.schemas import (
    ApplyMealTemplateResponse,
    CreateMealEntryInput,
    CreateMealTemplateInput,
    MealTemplate,
    MealTemplateItem,
    MealTemplateItemInput,
    MealTemplateWithItems,
    UpdateMealTemplateInput,
)
from app.modules.health.services.daily_logs_service import CreateMealEntry, EnsureDailyLogForDate
from app.modules.health.services.portion_entry_service import BuildServePortion, ResolvePortionBase
from app.modules.health.services.serving_conversion_service import ConvertEntryToServings


def _ResolveTemplateItemAmount(
    FoodRow: FoodModel,
    Item: MealTemplateItemInput,
) -> tuple[float, float, str]:
    if (Item.EntryQuantity is None) != (Item.EntryUnit is None):
        raise ValueError("EntryQuantity and EntryUnit must be provided together.")

    EntryQuantity = Item.EntryQuantity if Item.EntryQuantity is not None else Item.Quantity
    EntryUnit = Item.EntryUnit or "serving"

    if EntryUnit == "serving":
        return EntryQuantity, EntryQuantity, EntryUnit

    Quantity, _Detail, NormalizedUnit = ConvertEntryToServings(
        FoodRow.FoodName,
        float(FoodRow.ServingQuantity) if FoodRow.ServingQuantity else 1.0,
        FoodRow.ServingUnit or "serving",
        EntryQuantity,
        EntryUnit,
    )
    return Quantity, EntryQuantity, NormalizedUnit


def _BuildMealTemplateItem(item: MealTemplateItemModel, food: FoodModel) -> MealTemplateItem:
    return MealTemplateItem(
        MealTemplateItemId=item.MealTemplateItemId,
        MealTemplateId=item.MealTemplateId,
        FoodId=item.FoodId,
        MealType=item.MealType,
        Quantity=float(item.Quantity),
        EntryQuantity=float(item.EntryQuantity) if item.EntryQuantity is not None else None,
        EntryUnit=item.EntryUnit,
        EntryNotes=item.EntryNotes,
        SortOrder=item.SortOrder,
        FoodName=food.FoodName,
        ServingDescription=food.ServingDescription,
    )


def _BuildMealTemplate(template: MealTemplateModel, items: list[MealTemplateItem]) -> MealTemplateWithItems:
    return MealTemplateWithItems(
        Template=MealTemplate(
            MealTemplateId=template.MealTemplateId,
            TemplateName=template.TemplateName,
            Servings=float(template.Servings) if template.Servings is not None else 1.0,
            IsFavourite=bool(template.IsFavourite),
            CreatedAt=template.CreatedAt,
        ),
        Items=items,
    )


def _FetchMealTemplateRecord(db: Session, MealTemplateId: str, UserId: int, IsAdmin: bool) -> MealTemplateModel:
    query = db.query(MealTemplateModel).filter(MealTemplateModel.MealTemplateId == MealTemplateId)
    record = query.first()
    if not record:
        raise ValueError("Template not found.")
    return record


def _NormalizeName(value: str) -> str:
    return value.strip().lower()


def _EnsureUniqueName(db: Session, name: str, MealTemplateId: str | None = None) -> None:
    normalized = _NormalizeName(name)
    template_query = db.query(MealTemplateModel).filter(
        func.lower(MealTemplateModel.TemplateName) == normalized
    )
    if MealTemplateId:
        template_query = template_query.filter(MealTemplateModel.MealTemplateId != MealTemplateId)
    if template_query.first() is not None:
        raise ValueError("Name already exists.")
    food_query = db.query(FoodModel).filter(func.lower(FoodModel.FoodName) == normalized)
    if food_query.first() is not None:
        raise ValueError("Name already exists.")


def CreateMealTemplate(db: Session, UserId: int, Input: CreateMealTemplateInput) -> MealTemplateWithItems:
    TemplateName = Input.TemplateName.strip()
    if not TemplateName:
        raise ValueError("Template name is required.")
    if not Input.Items:
        raise ValueError("Template items are required.")
    servings = float(Input.Servings or 1.0)
    if servings <= 0:
        raise ValueError("Servings must be greater than zero.")

    _EnsureUniqueName(db, TemplateName)

    template = MealTemplateModel(
        MealTemplateId=str(uuid.uuid4()),
        UserId=UserId,
        TemplateName=TemplateName,
        Servings=servings,
        IsFavourite=bool(Input.IsFavourite),
    )
    db.add(template)
    db.flush()

    items: list[MealTemplateItem] = []
    for Item in Input.Items:
        FoodRow = db.query(FoodModel).filter(FoodModel.FoodId == Item.FoodId).first()
        if FoodRow is None:
            raise ValueError("Food not found.")

        Quantity, EntryQuantity, EntryUnit = _ResolveTemplateItemAmount(FoodRow, Item)

        record = MealTemplateItemModel(
            MealTemplateItemId=str(uuid.uuid4()),
            MealTemplateId=template.MealTemplateId,
            FoodId=Item.FoodId,
            MealType=Item.MealType,
            Quantity=Quantity,
            EntryQuantity=EntryQuantity,
            EntryUnit=EntryUnit,
            EntryNotes=Item.EntryNotes,
            SortOrder=Item.SortOrder,
        )
        db.add(record)
        items.append(_BuildMealTemplateItem(record, FoodRow))

    db.commit()
    db.refresh(template)
    return _BuildMealTemplate(template, items)


def GetMealTemplate(db: Session, UserId: int, MealTemplateId: str, IsAdmin: bool = False) -> MealTemplateWithItems:
    template = _FetchMealTemplateRecord(db, MealTemplateId, UserId, IsAdmin)

    rows = (
        db.query(MealTemplateItemModel, FoodModel)
        .join(FoodModel, FoodModel.FoodId == MealTemplateItemModel.FoodId)
        .filter(MealTemplateItemModel.MealTemplateId == template.MealTemplateId)
        .order_by(MealTemplateItemModel.SortOrder.asc())
        .all()
    )

    items = [_BuildMealTemplateItem(item, food) for item, food in rows]
    return _BuildMealTemplate(template, items)


def GetMealTemplates(db: Session, UserId: int) -> list[MealTemplateWithItems]:
    templates = (
        db.query(MealTemplateModel)
        .order_by(MealTemplateModel.CreatedAt.desc())
        .all()
    )

    if not templates:
        return []

    template_ids = [template.MealTemplateId for template in templates]
    items_rows = (
        db.query(MealTemplateItemModel, FoodModel)
        .join(FoodModel, FoodModel.FoodId == MealTemplateItemModel.FoodId)
        .filter(MealTemplateItemModel.MealTemplateId.in_(template_ids))
        .order_by(MealTemplateItemModel.SortOrder.asc())
        .all()
    )

    items_by_template: dict[str, list[MealTemplateItem]] = {}
    for item, food in items_rows:
        items_by_template.setdefault(item.MealTemplateId, []).append(_BuildMealTemplateItem(item, food))

    results: list[MealTemplateWithItems] = []
    for template in templates:
        results.append(
            _BuildMealTemplate(template, items_by_template.get(template.MealTemplateId, []))
        )
    return results


def UpdateMealTemplate(
    db: Session,
    UserId: int,
    MealTemplateId: str,
    Input: UpdateMealTemplateInput,
    IsAdmin: bool = False,
) -> MealTemplateWithItems:
    template = _FetchMealTemplateRecord(db, MealTemplateId, UserId, IsAdmin)

    if Input.TemplateName is not None:
        TemplateName = Input.TemplateName.strip()
        if not TemplateName:
            raise ValueError("Template name is required.")
        if _NormalizeName(TemplateName) != _NormalizeName(template.TemplateName):
            _EnsureUniqueName(db, TemplateName, MealTemplateId=template.MealTemplateId)
        template.TemplateName = TemplateName
    if Input.Servings is not None:
        servings = float(Input.Servings)
        if servings <= 0:
            raise ValueError("Servings must be greater than zero.")
        template.Servings = servings
    if Input.IsFavourite is not None:
        template.IsFavourite = bool(Input.IsFavourite)

    if Input.Items is not None:
        db.query(MealTemplateItemModel).filter(
            MealTemplateItemModel.MealTemplateId == template.MealTemplateId
        ).delete(synchronize_session=False)

        for Item in Input.Items:
            FoodRow = db.query(FoodModel).filter(FoodModel.FoodId == Item.FoodId).first()
            if FoodRow is None:
                raise ValueError("Food not found.")

            Quantity, EntryQuantity, EntryUnit = _ResolveTemplateItemAmount(FoodRow, Item)

            record = MealTemplateItemModel(
                MealTemplateItemId=str(uuid.uuid4()),
                MealTemplateId=template.MealTemplateId,
                FoodId=Item.FoodId,
                MealType=Item.MealType,
                Quantity=Quantity,
                EntryQuantity=EntryQuantity,
                EntryUnit=EntryUnit,
                EntryNotes=Item.EntryNotes,
                SortOrder=Item.SortOrder,
            )
            db.add(record)

    db.add(template)
    db.commit()
    db.refresh(template)
    return GetMealTemplate(db, UserId, MealTemplateId, IsAdmin=IsAdmin)


def DeleteMealTemplate(db: Session, UserId: int, MealTemplateId: str, IsAdmin: bool = False) -> None:
    template = _FetchMealTemplateRecord(db, MealTemplateId, UserId, IsAdmin)

    entry_count = (
        db.query(MealEntryModel)
        .filter(MealEntryModel.MealTemplateId == MealTemplateId)
        .count()
    )
    if entry_count > 0:
        raise ValueError("Template is used in logs. Remove entries before deleting.")

    db.query(MealTemplateItemModel).filter(
        MealTemplateItemModel.MealTemplateId == MealTemplateId
    ).delete(synchronize_session=False)
    db.delete(template)
    db.commit()


def ApplyMealTemplate(
    db: Session,
    UserId: int,
    MealTemplateId: str,
    LogDate: str,
) -> ApplyMealTemplateResponse:
    template = GetMealTemplate(db, UserId, MealTemplateId)
    daily_log = EnsureDailyLogForDate(db, UserId, LogDate)
    servings = float(template.Template.Servings or 1.0)
    if servings <= 0:
        servings = 1.0
    per_serving_multiplier = 1.0 / servings

    existing_entries = (
        db.query(MealEntryModel)
        .filter(MealEntryModel.DailyLogId == daily_log.DailyLogId)
        .all()
    )
    next_sort_order = max((entry.SortOrder for entry in existing_entries), default=-1) + 1

    if not template.Items:
        return ApplyMealTemplateResponse(CreatedCount=0)

    created_count = 0
    for index, Item in enumerate(template.Items):
        food_row = db.query(FoodModel).filter(FoodModel.FoodId == Item.FoodId).first()
        if food_row is None:
            raise ValueError("Food not found.")

        portion_label = "serving"
        portion_unit = None
        portion_amount = None
        item_quantity = Item.Quantity * per_serving_multiplier
        display_quantity = item_quantity

        if Item.EntryQuantity is not None and Item.EntryUnit:
            portion_label = Item.EntryUnit
            portion_unit, portion_amount = ResolvePortionBase(food_row, Item.EntryUnit, 1.0)
            display_quantity = Item.EntryQuantity * per_serving_multiplier
        else:
            portion_unit, portion_amount, _base_total = BuildServePortion(food_row, item_quantity)

        if portion_unit is None or portion_amount is None:
            raise ValueError("Portion data is required.")

        resolved_unit = portion_unit

        CreateMealEntry(
            db,
            UserId,
            CreateMealEntryInput(
                DailyLogId=daily_log.DailyLogId,
                MealType=Item.MealType,
                FoodId=Item.FoodId,
                Quantity=display_quantity,
                PortionOptionId=None,
                PortionLabel=portion_label,
                PortionBaseUnit=resolved_unit,
                PortionBaseAmount=portion_amount,
                EntryNotes=Item.EntryNotes,
                SortOrder=next_sort_order + index,
                ScheduleSlotId=None,
            ),
        )
        created_count += 1

    return ApplyMealTemplateResponse(CreatedCount=created_count)
