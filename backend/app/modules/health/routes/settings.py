from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import (
    NutritionRecommendationResponse,
    RecommendationLogListResponse,
    UpdateProfileInput,
    UpdateSettingsInput,
    UserProfile,
    UserSettings,
)
from app.modules.health.services.nutrition_recommendations_service import (
    CalculateAge,
    GetAiNutritionRecommendations,
)
from app.modules.health.services.recommendation_logs_service import (
    GetRecommendationLogsByUser,
    SaveRecommendationLog,
)
from app.modules.health.services.settings_service import (
    GetUserProfile,
    GetUserSettings,
    UpdateSettings,
    UpdateUserProfile,
)
from app.modules.health.utils.rbac import IsAdmin

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
        return GetUserProfile(db, user.Id, IsAdmin(user))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/profile", response_model=UserProfile)
def UpdateProfileRoute(
    payload: UpdateProfileInput,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> UserProfile:
    try:
        return UpdateUserProfile(db, user.Id, payload, IsAdmin(user))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/ai-recommendations", response_model=NutritionRecommendationResponse)
def GetAiRecommendations(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("health", write=True)),
) -> NutritionRecommendationResponse:
    profile = GetUserProfile(db, user.Id, IsAdmin(user))
    if not profile.BirthDate:
        raise HTTPException(status_code=400, detail="Birthdate is required for recommendations.")
    if not profile.HeightCm:
        raise HTTPException(status_code=400, detail="Height is required for recommendations.")
    if not profile.WeightKg:
        raise HTTPException(status_code=400, detail="Weight is required for recommendations.")
    if not profile.ActivityLevel:
        raise HTTPException(status_code=400, detail="Activity level is required for recommendations.")

    try:
        age = CalculateAge(profile.BirthDate.strftime("%Y-%m-%d"))
        recommendation, model_used = GetAiNutritionRecommendations(
            Age=age,
            HeightCm=profile.HeightCm,
            WeightKg=profile.WeightKg,
            ActivityLevel=profile.ActivityLevel,
        )

        SaveRecommendationLog(
            db,
            UserId=user.Id,
            Age=age,
            HeightCm=profile.HeightCm,
            WeightKg=profile.WeightKg,
            ActivityLevel=profile.ActivityLevel,
            Recommendation=recommendation,
        )

        response_data = recommendation.ToDict()
        response_data["ModelUsed"] = model_used
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
