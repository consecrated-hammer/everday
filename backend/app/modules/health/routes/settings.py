from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import (
    GoalRecommendationInput,
    NutritionRecommendationResponse,
    RecommendationLogListResponse,
    UpdateProfileInput,
    UpdateSettingsInput,
    UserProfile,
    UserSettings,
)
from app.modules.health.services.recommendation_logs_service import (
    GetRecommendationLogsByUser,
)
from app.modules.health.services.settings_service import (
    GetGoalRecommendation,
    GetUserProfile,
    GetUserSettings,
    UpdateSettings,
    UpdateUserProfile,
)
from app.modules.health.utils.rbac import IsParent

router = APIRouter()


@router.get("", response_model=UserSettings)
def GetSettingsRoute(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> UserSettings:
    return GetUserSettings(db, user.Id)


@router.put("", response_model=UserSettings)
def UpdateSettingsRoute(
    payload: UpdateSettingsInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> UserSettings:
    try:
        return UpdateSettings(db, user.Id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/profile", response_model=UserProfile)
def GetProfileRoute(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> UserProfile:
    try:
        return GetUserProfile(db, user.Id, IsAdmin=IsParent(user))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/profile", response_model=UserProfile)
def UpdateProfileRoute(
    payload: UpdateProfileInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> UserProfile:
    try:
        return UpdateUserProfile(db, user.Id, payload, IsAdmin=IsParent(user))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/ai-recommendations", response_model=NutritionRecommendationResponse)
def GetAiRecommendations(
    payload: GoalRecommendationInput | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> NutritionRecommendationResponse:
    try:
        recommendation, model_used, goal_summary = GetGoalRecommendation(db, user.Id, payload)
        response_data = recommendation.ToDict()
        response_data["ModelUsed"] = model_used
        response_data["Goal"] = goal_summary
        return NutritionRecommendationResponse(**response_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to generate recommendations.") from exc


@router.get("/ai-recommendations/history", response_model=RecommendationLogListResponse)
def GetRecommendationHistory(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
    limit: int = 10,
) -> RecommendationLogListResponse:
    logs = GetRecommendationLogsByUser(db, user.Id, Limit=limit)
    return RecommendationLogListResponse(Logs=logs)
