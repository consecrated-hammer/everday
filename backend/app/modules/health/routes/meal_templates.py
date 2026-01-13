from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import (
    ApplyMealTemplateInput,
    ApplyMealTemplateResponse,
    CreateMealTemplateInput,
    MealTemplateListResponse,
    MealTemplateWithItems,
    MealTextParseInput,
    MealTextParseResponse,
    UpdateMealTemplateInput,
)
from app.modules.health.services.meal_templates_service import (
    ApplyMealTemplate,
    CreateMealTemplate,
    DeleteMealTemplate,
    GetMealTemplate,
    GetMealTemplates,
    UpdateMealTemplate,
)
from app.modules.health.services.meal_text_parse_service import ParseMealText
from app.modules.health.services.foods_service import GetFoods
from app.modules.health.utils.rbac import IsParent

router = APIRouter()


@router.get("", response_model=MealTemplateListResponse)
def ListMealTemplates(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> MealTemplateListResponse:
    templates = GetMealTemplates(db, user.Id)
    return MealTemplateListResponse(Templates=templates)


@router.post("", response_model=MealTemplateWithItems, status_code=status.HTTP_201_CREATED)
def CreateMealTemplateRoute(
    payload: CreateMealTemplateInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealTemplateWithItems:
    try:
        return CreateMealTemplate(db, user.Id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{meal_template_id}", response_model=MealTemplateWithItems)
def UpdateMealTemplateRoute(
    meal_template_id: str,
    payload: UpdateMealTemplateInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealTemplateWithItems:
    try:
        return UpdateMealTemplate(db, user.Id, meal_template_id, payload, IsAdmin=IsParent(user))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{meal_template_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteMealTemplateRoute(
    meal_template_id: str,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> Response:
    try:
        DeleteMealTemplate(db, user.Id, meal_template_id, IsAdmin=IsParent(user))
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{meal_template_id}/apply", response_model=ApplyMealTemplateResponse)
def ApplyMealTemplateRoute(
    meal_template_id: str,
    payload: ApplyMealTemplateInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> ApplyMealTemplateResponse:
    try:
        return ApplyMealTemplate(db, user.Id, meal_template_id, payload.LogDate)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/ai-parse", response_model=MealTextParseResponse)
def ParseMealTemplateText(
    payload: MealTextParseInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> MealTextParseResponse:
    try:
        known_foods = [food.FoodName for food in GetFoods(db, user.Id)]
        result = ParseMealText(payload.Text, known_foods)
        return MealTextParseResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
