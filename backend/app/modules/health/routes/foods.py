import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import CreateFoodInput, Food, UpdateFoodInput
from app.modules.health.services.foods_service import DeleteFood, GetFoods, UpdateFood, UpsertFood
from app.modules.health.utils.rbac import IsParent

router = APIRouter()
logger = logging.getLogger("health.foods")


@router.get("", response_model=list[Food])
def ListFoods(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> list[Food]:
    return GetFoods(db, user.Id)


@router.post("", response_model=Food, status_code=status.HTTP_201_CREATED)
def CreateFood(
    payload: CreateFoodInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> Food:
    try:
        return UpsertFood(db, user.Id, payload, IsAdmin=IsParent(user))
    except ValueError as exc:
        logger.warning("create food failed", exc_info=exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{food_id}", response_model=Food)
def UpdateFoodRoute(
    food_id: str,
    payload: UpdateFoodInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> Food:
    try:
        return UpdateFood(db, user.Id, food_id, payload, IsAdmin=IsParent(user))
    except ValueError as exc:
        detail = str(exc)
        status_code = status.HTTP_403_FORBIDDEN if "Unauthorized" in detail else status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.delete("/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteFoodRoute(
    food_id: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> None:
    try:
        DeleteFood(db, user.Id, food_id, IsAdmin=IsParent(user))
    except ValueError as exc:
        detail = str(exc)
        status_code = status.HTTP_403_FORBIDDEN if "Unauthorized" in detail else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
