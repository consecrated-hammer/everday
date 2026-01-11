from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.shopping.models import ShoppingItem

MAX_ITEM_LENGTH = 200


def NormalizeItemLabel(value: str) -> str:
    if value is None:
        return ""
    normalized = " ".join(value.strip().split())
    return normalized


def ValidateItemLabel(value: str) -> str:
    normalized = NormalizeItemLabel(value)
    if not normalized:
        raise ValueError("Item is required")
    if len(normalized) > MAX_ITEM_LENGTH:
        raise ValueError("Item is too long")
    return normalized


def AddItem(
    db: Session,
    household_id: int,
    owner_user_id: int,
    item_label: str,
    added_by_type: str = "User",
) -> ShoppingItem:
    normalized = ValidateItemLabel(item_label)
    existing = (
        db.query(ShoppingItem)
        .filter(
            ShoppingItem.HouseholdId == household_id,
            ShoppingItem.IsActive == 1,
            func.lower(ShoppingItem.Item) == normalized.lower(),
        )
        .order_by(ShoppingItem.CreatedAt.asc(), ShoppingItem.Id.asc())
        .first()
    )
    if existing:
        return existing
    max_sort = (
        db.query(func.coalesce(func.max(ShoppingItem.SortOrder), 0))
        .filter(ShoppingItem.HouseholdId == household_id)
        .scalar()
    )
    record = ShoppingItem(
        HouseholdId=household_id,
        OwnerUserId=owner_user_id,
        AddedByType=added_by_type,
        Item=normalized,
        SortOrder=(max_sort or 0) + 1,
        IsActive=True,
        UpdatedAt=NowUtc(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateItem(
    db: Session,
    item_id: int,
    household_id: int,
    item_label: str,
) -> ShoppingItem | None:
    normalized = ValidateItemLabel(item_label)
    entry = (
        db.query(ShoppingItem)
        .filter(ShoppingItem.Id == item_id, ShoppingItem.HouseholdId == household_id)
        .first()
    )
    if not entry:
        return None
    entry.Item = normalized
    entry.UpdatedAt = NowUtc()
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def DeleteItem(db: Session, item_id: int, household_id: int) -> bool:
    entry = (
        db.query(ShoppingItem)
        .filter(ShoppingItem.Id == item_id, ShoppingItem.HouseholdId == household_id)
        .first()
    )
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def ListItems(
    db: Session,
    household_id: int,
    include_inactive: bool = False,
    limit: int | None = None,
) -> list[ShoppingItem]:
    query = db.query(ShoppingItem).filter(ShoppingItem.HouseholdId == household_id)
    if not include_inactive:
        query = query.filter(ShoppingItem.IsActive == 1)
    query = query.order_by(
        ShoppingItem.SortOrder.asc(),
        ShoppingItem.CreatedAt.asc(),
        ShoppingItem.Id.asc(),
    )
    if limit:
        query = query.limit(limit)
    return query.all()


def RemoveItemsExact(db: Session, household_id: int, item_label: str) -> int:
    normalized = ValidateItemLabel(item_label)
    count = (
        db.query(ShoppingItem)
        .filter(
            ShoppingItem.HouseholdId == household_id,
            func.lower(ShoppingItem.Item) == normalized.lower(),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return count or 0


def ClearItems(db: Session, household_id: int) -> int:
    count = (
        db.query(ShoppingItem)
        .filter(
            ShoppingItem.HouseholdId == household_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return count or 0
