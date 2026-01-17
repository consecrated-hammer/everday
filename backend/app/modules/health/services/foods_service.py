import re
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.health.models import Food as FoodModel
from app.modules.health.models import MealEntry as MealEntryModel
from app.modules.health.models import MealTemplate as MealTemplateModel
from app.modules.health.models import MealTemplateItem as MealTemplateItemModel
from app.modules.health.schemas import CreateFoodInput, Food, UpdateFoodInput
from app.modules.health.utils.defaults import DefaultFoods


FractionPattern = re.compile(r"^(\d+)/(\d+)$")
ServingPattern = re.compile(r"^(\d+(?:\.\d+)?|\d+/\d+)\s+([a-zA-Z]+)")


def _ParseQuantity(value: str) -> float | None:
    if not value:
        return None
    match = FractionPattern.match(value)
    if match:
        numerator = float(match.group(1))
        denominator = float(match.group(2))
        if denominator == 0:
            return None
        return numerator / denominator
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _ParseServingDescription(description: str) -> tuple[float, str]:
    if not description:
        return 1.0, "serving"
    match = ServingPattern.match(description.strip())
    if not match:
        return 1.0, "serving"
    quantity = _ParseQuantity(match.group(1))
    unit = match.group(2)
    if not quantity:
        return 1.0, "serving"
    return quantity, unit


def _DisplayName(user: User) -> str:
    parts = [user.FirstName, user.LastName]
    name = " ".join([part for part in parts if part])
    return name or user.Username


def _NormalizeName(value: str) -> str:
    return value.strip().lower()


def _EnsureUniqueName(db: Session, name: str, FoodId: str | None = None) -> None:
    normalized = _NormalizeName(name)
    food_query = db.query(FoodModel).filter(func.lower(FoodModel.FoodName) == normalized)
    if FoodId:
        food_query = food_query.filter(FoodModel.FoodId != FoodId)
    if food_query.first() is not None:
        raise ValueError("Name already exists.")
    template_query = db.query(MealTemplateModel).filter(
        func.lower(MealTemplateModel.TemplateName) == normalized
    )
    if template_query.first() is not None:
        raise ValueError("Name already exists.")


def _BuildFood(row: FoodModel, created_by_name: str | None = None) -> Food:
    return Food(
        FoodId=row.FoodId,
        OwnerUserId=row.OwnerUserId,
        CreatedByName=created_by_name,
        FoodName=row.FoodName,
        ServingDescription=row.ServingDescription,
        ServingQuantity=float(row.ServingQuantity) if row.ServingQuantity is not None else 1.0,
        ServingUnit=row.ServingUnit or "serving",
        CaloriesPerServing=int(row.CaloriesPerServing),
        ProteinPerServing=float(row.ProteinPerServing),
        FibrePerServing=float(row.FibrePerServing) if row.FibrePerServing is not None else None,
        CarbsPerServing=float(row.CarbsPerServing) if row.CarbsPerServing is not None else None,
        FatPerServing=float(row.FatPerServing) if row.FatPerServing is not None else None,
        SaturatedFatPerServing=float(row.SaturatedFatPerServing)
        if row.SaturatedFatPerServing is not None
        else None,
        SugarPerServing=float(row.SugarPerServing) if row.SugarPerServing is not None else None,
        SodiumPerServing=float(row.SodiumPerServing) if row.SodiumPerServing is not None else None,
        DataSource=row.DataSource or "manual",
        CountryCode=row.CountryCode or "AU",
        IsFavourite=bool(row.IsFavourite),
        CreatedAt=row.CreatedAt,
    )


def SeedFoodsForUser(db: Session, UserId: int) -> None:
    seeded = db.query(FoodModel).filter(FoodModel.DataSource == "seed").first()
    if seeded:
        return

    existing_food_names = {
        _NormalizeName(row.FoodName) for row in db.query(FoodModel.FoodName).all()
    }
    existing_template_names = {
        _NormalizeName(row.TemplateName) for row in db.query(MealTemplateModel.TemplateName).all()
    }
    existing_names = existing_food_names.union(existing_template_names)
    inserted = False
    for FoodName, ServingDescription, CaloriesPerServing, ProteinPerServing in DefaultFoods:
        if _NormalizeName(FoodName) in existing_names:
            continue
        quantity, unit = _ParseServingDescription(ServingDescription)
        record = FoodModel(
            FoodId=str(uuid.uuid4()),
            OwnerUserId=UserId,
            FoodName=FoodName,
            ServingDescription=ServingDescription,
            ServingQuantity=quantity,
            ServingUnit=unit,
            CaloriesPerServing=CaloriesPerServing,
            ProteinPerServing=ProteinPerServing,
            DataSource="seed",
            CountryCode="AU",
            IsFavourite=False,
        )
        db.add(record)
        inserted = True
    if inserted:
        db.commit()


def GetFoods(db: Session, UserId: int) -> list[Food]:
    SeedFoodsForUser(db, UserId)

    rows = db.query(FoodModel).order_by(FoodModel.FoodName.asc()).all()
    owner_ids = {row.OwnerUserId for row in rows if row.OwnerUserId}
    owners = db.query(User).filter(User.Id.in_(owner_ids)).all() if owner_ids else []
    owner_map = {owner.Id: _DisplayName(owner) for owner in owners}
    return [_BuildFood(row, owner_map.get(row.OwnerUserId)) for row in rows]


def UpsertFood(db: Session, UserId: int, Input: CreateFoodInput, IsAdmin: bool = False) -> Food:
    food_name = Input.FoodName.strip()
    ServingDescription = f"{Input.ServingQuantity} {Input.ServingUnit}".strip()

    _EnsureUniqueName(db, food_name)

    record = FoodModel(
        FoodId=str(uuid.uuid4()),
        OwnerUserId=UserId,
        FoodName=food_name,
        ServingDescription=ServingDescription,
        ServingQuantity=Input.ServingQuantity,
        ServingUnit=Input.ServingUnit,
        CaloriesPerServing=Input.CaloriesPerServing,
        ProteinPerServing=Input.ProteinPerServing,
        FibrePerServing=Input.FibrePerServing,
        CarbsPerServing=Input.CarbsPerServing,
        FatPerServing=Input.FatPerServing,
        SaturatedFatPerServing=Input.SaturatedFatPerServing,
        SugarPerServing=Input.SugarPerServing,
        SodiumPerServing=Input.SodiumPerServing,
        DataSource=Input.DataSource,
        CountryCode=Input.CountryCode,
        IsFavourite=Input.IsFavourite,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _BuildFood(record)


def GetFoodById(db: Session, FoodId: str) -> Food:
    row = db.query(FoodModel).filter(FoodModel.FoodId == FoodId).first()
    if row is None:
        raise ValueError("Food not found")
    return _BuildFood(row)


def UpdateFood(db: Session, UserId: int, FoodId: str, Input: UpdateFoodInput, IsAdmin: bool = False) -> Food:
    existing = db.query(FoodModel).filter(FoodModel.FoodId == FoodId).first()
    if existing is None:
        raise ValueError("Food not found")

    if Input.FoodName is not None:
        name = Input.FoodName.strip()
        if _NormalizeName(name) != _NormalizeName(existing.FoodName):
            _EnsureUniqueName(db, name, FoodId=FoodId)
        existing.FoodName = name

    if Input.ServingQuantity is not None or Input.ServingUnit is not None:
        new_quantity = Input.ServingQuantity if Input.ServingQuantity is not None else float(existing.ServingQuantity)
        new_unit = Input.ServingUnit if Input.ServingUnit is not None else existing.ServingUnit
        existing.ServingQuantity = new_quantity
        existing.ServingUnit = new_unit
        existing.ServingDescription = f"{new_quantity} {new_unit}".strip()

    if Input.CaloriesPerServing is not None:
        existing.CaloriesPerServing = Input.CaloriesPerServing
    if Input.ProteinPerServing is not None:
        existing.ProteinPerServing = Input.ProteinPerServing
    if Input.FibrePerServing is not None:
        existing.FibrePerServing = Input.FibrePerServing
    if Input.CarbsPerServing is not None:
        existing.CarbsPerServing = Input.CarbsPerServing
    if Input.FatPerServing is not None:
        existing.FatPerServing = Input.FatPerServing
    if Input.SaturatedFatPerServing is not None:
        existing.SaturatedFatPerServing = Input.SaturatedFatPerServing
    if Input.SugarPerServing is not None:
        existing.SugarPerServing = Input.SugarPerServing
    if Input.SodiumPerServing is not None:
        existing.SodiumPerServing = Input.SodiumPerServing
    if Input.IsFavourite is not None:
        existing.IsFavourite = Input.IsFavourite

    db.add(existing)
    db.commit()
    db.refresh(existing)
    return _BuildFood(existing)


def DeleteFood(db: Session, UserId: int, FoodId: str, IsAdmin: bool = False) -> None:
    existing = db.query(FoodModel).filter(FoodModel.FoodId == FoodId).first()
    if existing is None:
        raise ValueError("Food not found")

    meal_entry_count = db.query(func.count(MealEntryModel.MealEntryId)).filter(
        MealEntryModel.FoodId == FoodId
    ).scalar() or 0
    template_count = db.query(func.count(MealTemplateItemModel.MealTemplateItemId)).filter(
        MealTemplateItemModel.FoodId == FoodId
    ).scalar() or 0

    if meal_entry_count > 0 or template_count > 0:
        parts: list[str] = []
        if meal_entry_count > 0:
            parts.append(f"{meal_entry_count} log entries")
        if template_count > 0:
            parts.append(f"{template_count} meal templates")
        usage = " and ".join(parts)
        raise ValueError(
            f"Food is used in {usage}. Remove it from those items before deleting."
        )

    db.delete(existing)
    db.commit()
