from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import CreatePortionOptionInput, PortionOptionsResponse
from app.modules.health.services.portion_options_service import (
    CreatePortionOption,
    GetPortionOptions,
)

router = APIRouter()


@router.get("", response_model=PortionOptionsResponse)
def GetPortionOptionsRoute(
    food_id: str | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> PortionOptionsResponse:
    base_unit, options = GetPortionOptions(db, user.Id, food_id)
    return PortionOptionsResponse(BaseUnit=base_unit, Options=options)


@router.post("", response_model=PortionOptionsResponse, status_code=status.HTTP_201_CREATED)
def CreatePortionOptionRoute(
    payload: CreatePortionOptionInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> PortionOptionsResponse:
    try:
        CreatePortionOption(
            db,
            user.Id,
            payload.FoodId,
            payload.Label.strip(),
            payload.BaseUnit,
            float(payload.BaseAmount),
            payload.IsDefault,
            payload.SortOrder,
        )
        base_unit, options = GetPortionOptions(db, user.Id, payload.FoodId)
        return PortionOptionsResponse(BaseUnit=base_unit, Options=options)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
