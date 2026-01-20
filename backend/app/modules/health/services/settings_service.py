import json
import uuid
from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.health.models import Settings as SettingsModel
from app.modules.health.schemas import Targets, UpdateProfileInput, UpdateSettingsInput, UserProfile, UserSettings
from app.modules.health.services.daily_logs_service import UpdateUserWeightFromLatestLog
from app.modules.health.services.nutrition_recommendations_service import (
    CalculateAge,
    GetAiNutritionRecommendations,
)
from app.modules.health.services.recommendation_logs_service import SaveRecommendationLog
from app.modules.health.utils.defaults import DefaultTargets, DefaultTodayLayout

Logger = logging.getLogger(__name__)

AutoTuneInterval = timedelta(days=7)


def _ParseLayout(value: str | None) -> list[str]:
    if not value:
        return DefaultTodayLayout
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except json.JSONDecodeError:
        pass
    return DefaultTodayLayout


def _ParseBarOrder(value: str | None) -> list[str]:
    if not value:
        return DefaultTargets.BarOrder
    parts = [item.strip() for item in value.split(",") if item.strip()]
    return parts or DefaultTargets.BarOrder


def _SerializeBarOrder(value: list[str]) -> str:
    return ",".join(value)


def _ShouldAutoTuneTargets(record: SettingsModel) -> bool:
    if not record.AutoTuneTargetsWeekly:
        return False
    if record.LastAutoTuneAt is None:
        return True
    return datetime.now(timezone.utc) - record.LastAutoTuneAt >= AutoTuneInterval


def _ProfileReady(profile: UserProfile) -> bool:
    return bool(
        profile.BirthDate and profile.HeightCm and profile.WeightKg and profile.ActivityLevel
    )


def _TryAutoTuneTargets(db: Session, UserId: int, record: SettingsModel) -> SettingsModel:
    if not _ShouldAutoTuneTargets(record):
        return record
    try:
        profile = GetUserProfile(db, UserId, IsAdmin=False)
    except ValueError:
        return record

    if not _ProfileReady(profile):
        return record

    try:
        age = CalculateAge(profile.BirthDate.strftime("%Y-%m-%d"))
        recommendation, _model_used = GetAiNutritionRecommendations(
            Age=age,
            HeightCm=profile.HeightCm,
            WeightKg=profile.WeightKg,
            ActivityLevel=profile.ActivityLevel,
        )
        SaveRecommendationLog(
            db,
            UserId=UserId,
            Age=age,
            HeightCm=profile.HeightCm,
            WeightKg=profile.WeightKg,
            ActivityLevel=profile.ActivityLevel,
            Recommendation=recommendation,
        )
        record.DailyCalorieTarget = recommendation.DailyCalorieTarget
        record.ProteinTargetMin = recommendation.ProteinTargetMin
        record.ProteinTargetMax = recommendation.ProteinTargetMax
        record.FibreTarget = recommendation.FibreTarget
        record.CarbsTarget = recommendation.CarbsTarget
        record.FatTarget = recommendation.FatTarget
        record.SaturatedFatTarget = recommendation.SaturatedFatTarget
        record.SugarTarget = recommendation.SugarTarget
        record.SodiumTarget = recommendation.SodiumTarget
        record.LastAutoTuneAt = datetime.now(timezone.utc)
        db.add(record)
        db.commit()
        db.refresh(record)
    except ValueError as exc:
        Logger.warning("Auto-tune targets failed for user %s: %s", UserId, exc)
    return record


def EnsureSettingsForUser(db: Session, UserId: int) -> SettingsModel:
    record = db.query(SettingsModel).filter(SettingsModel.UserId == UserId).first()
    if record:
        return record

    record = SettingsModel(
        SettingsId=str(uuid.uuid4()),
        UserId=UserId,
        DailyCalorieTarget=DefaultTargets.DailyCalorieTarget,
        ProteinTargetMin=DefaultTargets.ProteinTargetMin,
        ProteinTargetMax=DefaultTargets.ProteinTargetMax,
        StepKcalFactor=DefaultTargets.StepKcalFactor,
        StepTarget=DefaultTargets.StepTarget,
        FibreTarget=DefaultTargets.FibreTarget,
        CarbsTarget=DefaultTargets.CarbsTarget,
        FatTarget=DefaultTargets.FatTarget,
        SaturatedFatTarget=DefaultTargets.SaturatedFatTarget,
        SugarTarget=DefaultTargets.SugarTarget,
        SodiumTarget=DefaultTargets.SodiumTarget,
        ShowProteinOnToday=DefaultTargets.ShowProteinOnToday,
        ShowStepsOnToday=DefaultTargets.ShowStepsOnToday,
        ShowFibreOnToday=DefaultTargets.ShowFibreOnToday,
        ShowCarbsOnToday=DefaultTargets.ShowCarbsOnToday,
        ShowFatOnToday=DefaultTargets.ShowFatOnToday,
        ShowSaturatedFatOnToday=DefaultTargets.ShowSaturatedFatOnToday,
        ShowSugarOnToday=DefaultTargets.ShowSugarOnToday,
        ShowSodiumOnToday=DefaultTargets.ShowSodiumOnToday,
        TodayLayout=json.dumps(DefaultTodayLayout),
        BarOrder=_SerializeBarOrder(DefaultTargets.BarOrder),
        AutoTuneTargetsWeekly=False,
        LastAutoTuneAt=None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def GetSettings(db: Session, UserId: int) -> Targets:
    record = EnsureSettingsForUser(db, UserId)
    return Targets(
        DailyCalorieTarget=record.DailyCalorieTarget,
        ProteinTargetMin=float(record.ProteinTargetMin),
        ProteinTargetMax=float(record.ProteinTargetMax),
        StepKcalFactor=float(record.StepKcalFactor),
        StepTarget=record.StepTarget,
        FibreTarget=float(record.FibreTarget) if record.FibreTarget is not None else None,
        CarbsTarget=float(record.CarbsTarget) if record.CarbsTarget is not None else None,
        FatTarget=float(record.FatTarget) if record.FatTarget is not None else None,
        SaturatedFatTarget=float(record.SaturatedFatTarget)
        if record.SaturatedFatTarget is not None
        else None,
        SugarTarget=float(record.SugarTarget) if record.SugarTarget is not None else None,
        SodiumTarget=float(record.SodiumTarget) if record.SodiumTarget is not None else None,
        ShowProteinOnToday=bool(record.ShowProteinOnToday),
        ShowStepsOnToday=bool(record.ShowStepsOnToday),
        ShowFibreOnToday=bool(record.ShowFibreOnToday),
        ShowCarbsOnToday=bool(record.ShowCarbsOnToday),
        ShowFatOnToday=bool(record.ShowFatOnToday),
        ShowSaturatedFatOnToday=bool(record.ShowSaturatedFatOnToday),
        ShowSugarOnToday=bool(record.ShowSugarOnToday),
        ShowSodiumOnToday=bool(record.ShowSodiumOnToday),
        BarOrder=_ParseBarOrder(record.BarOrder),
    )


def GetUserSettings(db: Session, UserId: int) -> UserSettings:
    record = EnsureSettingsForUser(db, UserId)
    record = _TryAutoTuneTargets(db, UserId, record)
    targets = GetSettings(db, UserId)
    return UserSettings(
        Targets=targets,
        TodayLayout=_ParseLayout(record.TodayLayout),
        AutoTuneTargetsWeekly=bool(record.AutoTuneTargetsWeekly),
        LastAutoTuneAt=record.LastAutoTuneAt,
    )


def UpdateSettings(db: Session, UserId: int, Input: UpdateSettingsInput) -> UserSettings:
    record = EnsureSettingsForUser(db, UserId)

    for field, value in Input.dict(exclude_unset=True).items():
        if field == "TodayLayout" and value is not None:
            record.TodayLayout = json.dumps(value)
        elif field == "BarOrder" and value is not None:
            record.BarOrder = _SerializeBarOrder(value)
        elif value is not None:
            setattr(record, field, value)

    db.add(record)
    db.commit()
    db.refresh(record)
    return GetUserSettings(db, UserId)


def GetUserProfile(db: Session, UserId: int, IsAdmin: bool) -> UserProfile:
    UpdateUserWeightFromLatestLog(db, UserId)
    user = db.query(User).filter(User.Id == UserId).first()
    if not user:
        raise ValueError("User not found")
    return UserProfile(
        UserId=user.Id,
        Username=user.Username,
        FirstName=user.FirstName,
        LastName=user.LastName,
        Email=user.Email,
        BirthDate=user.BirthDate,
        HeightCm=user.HeightCm,
        WeightKg=float(user.WeightKg) if user.WeightKg is not None else None,
        ActivityLevel=user.ActivityLevel,
        IsAdmin=IsAdmin,
    )


def UpdateUserProfile(db: Session, UserId: int, Input: UpdateProfileInput, IsAdmin: bool) -> UserProfile:
    user = db.query(User).filter(User.Id == UserId).first()
    if not user:
        raise ValueError("User not found")

    if Input.FirstName is not None:
        user.FirstName = Input.FirstName.strip() if Input.FirstName else None
    if Input.LastName is not None:
        user.LastName = Input.LastName.strip() if Input.LastName else None
    if Input.Email is not None:
        user.Email = Input.Email.strip().lower() if Input.Email else None
    if Input.BirthDate is not None:
        try:
            user.BirthDate = datetime.strptime(Input.BirthDate, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError("Invalid birth date format") from exc
    if Input.HeightCm is not None:
        user.HeightCm = Input.HeightCm
    if Input.WeightKg is not None:
        user.WeightKg = Input.WeightKg
    if Input.ActivityLevel is not None:
        user.ActivityLevel = Input.ActivityLevel

    db.add(user)
    db.commit()
    db.refresh(user)

    return UserProfile(
        UserId=user.Id,
        Username=user.Username,
        FirstName=user.FirstName,
        LastName=user.LastName,
        Email=user.Email,
        BirthDate=user.BirthDate,
        HeightCm=user.HeightCm,
        WeightKg=float(user.WeightKg) if user.WeightKg is not None else None,
        ActivityLevel=user.ActivityLevel,
        IsAdmin=IsAdmin,
    )
