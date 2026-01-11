import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.auth.models import User
from app.modules.shopping.schemas import ShoppingItemCreate, ShoppingItemOut, ShoppingItemUpdate
from app.modules.shopping.services import AddItem, DeleteItem, ListItems, UpdateItem

router = APIRouter()
logger = logging.getLogger("shopping.items")


def _handle_db_error(exc: Exception) -> None:
    logger.exception("shopping items database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Shopping storage not initialized. Run alembic upgrade head.",
    ) from exc


def _DisplayName(user: User) -> str:
    parts = [user.FirstName, user.LastName]
    name = " ".join([part for part in parts if part])
    return name or user.Username


def _LoadUserNames(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    users = db.query(User).filter(User.Id.in_(user_ids)).all()
    return {user.Id: _DisplayName(user) for user in users}


def _BuildShoppingOut(entry, added_by_name: str | None) -> ShoppingItemOut:
    return ShoppingItemOut(
        Id=entry.Id,
        HouseholdId=entry.HouseholdId,
        OwnerUserId=entry.OwnerUserId,
        AddedByType=entry.AddedByType,
        AddedByName=added_by_name,
        Item=entry.Item,
        IsActive=entry.IsActive,
        SortOrder=entry.SortOrder,
        CreatedAt=entry.CreatedAt,
        UpdatedAt=entry.UpdatedAt,
    )


@router.get("", response_model=list[ShoppingItemOut])
def ListShoppingItems(
    household_id: int,
    include_inactive: bool = False,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("shopping", write=False)),
) -> list[ShoppingItemOut]:
    try:
        entries = ListItems(db, household_id=household_id, include_inactive=include_inactive)
        user_ids = {
            entry.OwnerUserId
            for entry in entries
            if (entry.AddedByType or "").lower() != "alexa"
        }
        user_map = _LoadUserNames(db, user_ids)
        results = []
        for entry in entries:
            added_by_type = (entry.AddedByType or "").lower()
            added_by_name = "Alexa" if added_by_type == "alexa" else user_map.get(entry.OwnerUserId)
            results.append(_BuildShoppingOut(entry, added_by_name))
        return results
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=ShoppingItemOut, status_code=status.HTTP_201_CREATED)
def CreateShoppingItem(
    payload: ShoppingItemCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("shopping", write=True)),
) -> ShoppingItemOut:
    try:
        entry = AddItem(
            db,
            household_id=payload.HouseholdId,
            owner_user_id=user.Id,
            item_label=payload.Item,
            added_by_type="User",
        )
        creator = db.query(User).filter(User.Id == entry.OwnerUserId).first()
        added_by_name = _DisplayName(creator) if creator else user.Username
        return _BuildShoppingOut(entry, added_by_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/{item_id}", response_model=ShoppingItemOut)
def UpdateShoppingItem(
    item_id: int,
    payload: ShoppingItemUpdate,
    household_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("shopping", write=True)),
) -> ShoppingItemOut:
    try:
        entry = UpdateItem(
            db,
            item_id=item_id,
            household_id=household_id,
            item_label=payload.Item,
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping item not found")
        if (entry.AddedByType or "").lower() == "alexa":
            added_by_name = "Alexa"
        else:
            added_by_name = _LoadUserNames(db, {entry.OwnerUserId}).get(entry.OwnerUserId, user.Username)
        return _BuildShoppingOut(entry, added_by_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteShoppingItem(
    item_id: int,
    household_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("shopping", write=True)),
) -> None:
    try:
        deleted = DeleteItem(db, item_id=item_id, household_id=household_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping item not found")
    except ProgrammingError as exc:
        _handle_db_error(exc)
