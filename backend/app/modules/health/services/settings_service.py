import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy.orm import Session

from app.modules.auth.service import HashApiKey, VerifyApiKey
from app.modules.auth.models import User
from app.modules.health.models import Settings as SettingsModel
from app.modules.health.schemas import (
    HaeApiKeyResponse,
    GoalRecommendationInput,
    GoalSummary,
    GoalType,
    MealType,
    Targets,
    UpdateProfileInput,
    UpdateSettingsInput,
    UserProfile,
    UserSettings,
)
from app.modules.health.services.goal_service import (
    AddMonths,
    CalculateBmi,
    BuildGoalPlan,
    BuildGoalSummary,
    IsGoalMet,
)
from app.modules.health.services.daily_logs_service import UpdateUserWeightFromLatestLog
from app.modules.health.services.nutrition_recommendations_service import (
    CalculateAge,
    GetAiNutritionRecommendations,
)
from app.modules.health.services.recommendation_logs_service import SaveRecommendationLog
from app.modules.health.utils.defaults import (
    DefaultFoodReminderTimes,
    DefaultReminderTimeZone,
    DefaultTargets,
    DefaultTodayLayout,
    DefaultWeightReminderTime,
)
from app.modules.notifications.services import CreateNotification

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


AllowedMealTypes = {member.value for member in MealType}


def _IsValidTime(value: str | None) -> bool:
    if not value:
        return False
    try:
        datetime.strptime(value, "%H:%M")
        return True
    except ValueError:
        return False


def _NormalizeFoodReminderTimes(value: dict[str, str] | None) -> dict[str, str]:
    normalized = dict(DefaultFoodReminderTimes)
    if not value:
        return normalized
    for meal_type, time_value in value.items():
        if meal_type not in AllowedMealTypes:
            continue
        if _IsValidTime(time_value):
            normalized[meal_type] = time_value
    return normalized


def _ParseFoodReminderTimes(value: str | None) -> dict[str, str]:
    if not value:
        return dict(DefaultFoodReminderTimes)
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return _NormalizeFoodReminderTimes({str(k): str(v) for k, v in parsed.items()})
    except json.JSONDecodeError:
        pass
    return dict(DefaultFoodReminderTimes)


def _SerializeFoodReminderTimes(value: dict[str, str] | None) -> str:
    normalized = _NormalizeFoodReminderTimes(value)
    return json.dumps(normalized, separators=(",", ":"))


def _ResolveReminderTimeZone(value: str | None) -> str:
    if value and value.strip():
        return value.strip()
    return DefaultReminderTimeZone


def _ResolveWeightReminderTime(value: str | None) -> str:
    return value if _IsValidTime(value) else DefaultWeightReminderTime


def _ShouldAutoTuneTargets(record: SettingsModel) -> bool:
    if not record.AutoTuneTargetsWeekly:
        return False
    Today = datetime.now(timezone.utc).date()
    if record.GoalCompletedAt is not None:
        return False
    if record.GoalEndDate and Today > record.GoalEndDate:
        return False
    if record.LastAutoTuneAt is None:
        return True
    return datetime.now(timezone.utc) - record.LastAutoTuneAt >= AutoTuneInterval


def _ProfileReady(profile: UserProfile) -> bool:
    return bool(
        profile.BirthDate and profile.HeightCm and profile.WeightKg and profile.ActivityLevel
    )


def _GoalConfigReady(record: SettingsModel) -> bool:
    return bool(
        record.GoalType
        and record.GoalBmiMin is not None
        and record.GoalBmiMax is not None
        and record.GoalStartDate
        and record.GoalEndDate
    )


def _ParseGoalType(value: str | None) -> GoalType | None:
    if not value:
        return None
    try:
        return GoalType(value)
    except ValueError:
        return None


def _BuildGoalPlanFromRecord(profile: UserProfile, record: SettingsModel):
    GoalTypeValue = _ParseGoalType(record.GoalType)
    if GoalTypeValue is None:
        return None
    if not record.GoalStartDate or not record.GoalEndDate:
        return None
    if not _ProfileReady(profile):
        return None
    Age = CalculateAge(profile.BirthDate.strftime("%Y-%m-%d"))
    return BuildGoalPlan(
        GoalTypeValue=GoalTypeValue,
        BmiMin=float(record.GoalBmiMin),
        BmiMax=float(record.GoalBmiMax),
        StartDate=record.GoalStartDate,
        EndDate=record.GoalEndDate,
        CurrentWeightKg=float(profile.WeightKg),
        HeightCm=profile.HeightCm,
        Age=Age,
        ActivityLevel=profile.ActivityLevel,
        TargetBmiOverride=float(record.GoalTargetBmi) if record.GoalTargetBmi is not None else None,
    )


def _BuildGoalPlanFromInput(profile: UserProfile, Input: GoalRecommendationInput, Today: datetime):
    if not _ProfileReady(profile):
        raise ValueError("Complete birth date, height, weight, and activity level first.")
    StartDate = Input.StartDate or Today.date()
    EndDate = Input.EndDateOverride or AddMonths(StartDate, Input.DurationMonths)
    Age = CalculateAge(profile.BirthDate.strftime("%Y-%m-%d"))
    TargetBmiOverride = (
        CalculateBmi(Input.TargetWeightKgOverride, profile.HeightCm)
        if Input.TargetWeightKgOverride is not None
        else None
    )
    return BuildGoalPlan(
        GoalTypeValue=Input.GoalType,
        BmiMin=float(Input.BmiMin),
        BmiMax=float(Input.BmiMax),
        StartDate=StartDate,
        EndDate=EndDate,
        CurrentWeightKg=float(profile.WeightKg),
        HeightCm=profile.HeightCm,
        Age=Age,
        ActivityLevel=profile.ActivityLevel,
        TargetBmiOverride=TargetBmiOverride,
    )


def _BuildGoalContext(Plan) -> str:
    Direction = Plan.GoalType.value
    return (
        f"Goal type: {Direction}\n"
        f"Target BMI range: {Plan.BmiMin:.1f}-{Plan.BmiMax:.1f}\n"
        f"Current BMI: {Plan.CurrentBmi:.1f}\n"
        f"Target BMI: {Plan.TargetBmi:.1f}\n"
        f"Target weight: {Plan.TargetWeightKg:.1f} kg by {Plan.EndDate.isoformat()}\n"
        f"Planned daily calorie delta: {Plan.DailyCalorieDelta:.0f} kcal"
    )


def _TryUpdateGoalStatus(
    db: Session,
    UserId: int,
    record: SettingsModel,
    profile: UserProfile,
) -> GoalSummary | None:
    if not _GoalConfigReady(record):
        return None
    Plan = _BuildGoalPlanFromRecord(profile, record)
    if not Plan:
        return None
    Now = datetime.now(timezone.utc)
    Summary = BuildGoalSummary(Plan, CompletedAt=record.GoalCompletedAt, Today=Now.date())
    if record.GoalCompletedAt is None and IsGoalMet(Plan, Now.date()):
        record.GoalCompletedAt = Now
        if record.GoalCompletionNotifiedAt is None:
            record.GoalCompletionNotifiedAt = Now
        db.add(record)
        db.commit()
        db.refresh(record)
        CreateNotification(
            db,
            user_id=UserId,
            created_by_user_id=UserId,
            title="Goal reached",
            body="Your BMI target has been met. Update your goal to keep targets current.",
            notification_type="Health",
            link_url="/settings/health",
            action_label="Update goal",
            source_module="health",
            source_id=str(record.SettingsId),
        )
        Summary = BuildGoalSummary(Plan, CompletedAt=record.GoalCompletedAt, Today=Now.date())
    return Summary


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
        GoalPlan = _BuildGoalPlanFromRecord(profile, record)
        GoalContext = _BuildGoalContext(GoalPlan) if GoalPlan else None
        DailyCalorieTarget = GoalPlan.DailyCalorieTarget if GoalPlan else None
        recommendation, _model_used = GetAiNutritionRecommendations(
            Age=age,
            HeightCm=profile.HeightCm,
            WeightKg=profile.WeightKg,
            ActivityLevel=profile.ActivityLevel,
            DailyCalorieTarget=DailyCalorieTarget,
            GoalContext=GoalContext,
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
        ShowWeightChartOnToday=True,
        ShowStepsChartOnToday=True,
        ShowWeightProjectionOnToday=True,
        GoalType=None,
        GoalBmiMin=None,
        GoalBmiMax=None,
        GoalTargetBmi=None,
        GoalStartDate=None,
        GoalEndDate=None,
        GoalSetAt=None,
        GoalUpdatedAt=None,
        GoalCompletedAt=None,
        GoalCompletionNotifiedAt=None,
        FoodRemindersEnabled=False,
        FoodReminderTimes=_SerializeFoodReminderTimes(DefaultFoodReminderTimes),
        WeightRemindersEnabled=False,
        WeightReminderTime=DefaultWeightReminderTime,
        ReminderTimeZone=DefaultReminderTimeZone,
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


def GetGoalRecommendation(
    db: Session,
    UserId: int,
    Input: GoalRecommendationInput | None,
) -> tuple:
    record = EnsureSettingsForUser(db, UserId)
    profile = GetUserProfile(db, UserId, IsAdmin=False)
    if not _ProfileReady(profile):
        raise ValueError("Complete birth date, height, weight, and activity level first.")

    Now = datetime.now(timezone.utc)
    GoalPlan = None
    GoalSummaryValue = None
    if Input is not None:
        GoalPlan = _BuildGoalPlanFromInput(profile, Input, Now)
        GoalSummaryValue = BuildGoalSummary(GoalPlan, CompletedAt=None, Today=Now.date())
    elif _GoalConfigReady(record):
        GoalPlan = _BuildGoalPlanFromRecord(profile, record)
        if GoalPlan:
            GoalSummaryValue = BuildGoalSummary(
                GoalPlan, CompletedAt=record.GoalCompletedAt, Today=Now.date()
            )

    GoalContext = _BuildGoalContext(GoalPlan) if GoalPlan else None
    DailyCalorieTarget = GoalPlan.DailyCalorieTarget if GoalPlan else None
    age = CalculateAge(profile.BirthDate.strftime("%Y-%m-%d"))
    recommendation, model_used = GetAiNutritionRecommendations(
        Age=age,
        HeightCm=profile.HeightCm,
        WeightKg=profile.WeightKg,
        ActivityLevel=profile.ActivityLevel,
        DailyCalorieTarget=DailyCalorieTarget,
        GoalContext=GoalContext,
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

    if Input is not None and Input.ApplyGoal and GoalPlan:
        record.GoalType = GoalPlan.GoalType.value
        record.GoalBmiMin = GoalPlan.BmiMin
        record.GoalBmiMax = GoalPlan.BmiMax
        record.GoalTargetBmi = (
            GoalPlan.TargetBmi if Input.TargetWeightKgOverride is not None else None
        )
        record.GoalStartDate = GoalPlan.StartDate
        record.GoalEndDate = GoalPlan.EndDate
        record.GoalCompletedAt = None
        record.GoalCompletionNotifiedAt = None
        if record.GoalSetAt is None:
            record.GoalSetAt = Now
        record.GoalUpdatedAt = Now
        if Input.DailyCalorieTargetOverride is not None:
            recommendation.DailyCalorieTarget = Input.DailyCalorieTargetOverride
        record.DailyCalorieTarget = recommendation.DailyCalorieTarget
        record.ProteinTargetMin = recommendation.ProteinTargetMin
        record.ProteinTargetMax = recommendation.ProteinTargetMax
        record.FibreTarget = recommendation.FibreTarget
        record.CarbsTarget = recommendation.CarbsTarget
        record.FatTarget = recommendation.FatTarget
        record.SaturatedFatTarget = recommendation.SaturatedFatTarget
        record.SugarTarget = recommendation.SugarTarget
        record.SodiumTarget = recommendation.SodiumTarget
        db.add(record)
        db.commit()
        db.refresh(record)
        GoalSummaryValue = BuildGoalSummary(GoalPlan, CompletedAt=None, Today=Now.date())

    return recommendation, model_used, GoalSummaryValue


def GetUserSettings(db: Session, UserId: int) -> UserSettings:
    record = EnsureSettingsForUser(db, UserId)
    record = _TryAutoTuneTargets(db, UserId, record)
    GoalSummaryValue = None
    if _GoalConfigReady(record):
        try:
            profile = GetUserProfile(db, UserId, IsAdmin=False)
        except ValueError:
            profile = None
        if profile and _ProfileReady(profile):
            GoalSummaryValue = _TryUpdateGoalStatus(db, UserId, record, profile)
    targets = GetSettings(db, UserId)
    return UserSettings(
        Targets=targets,
        TodayLayout=_ParseLayout(record.TodayLayout),
        AutoTuneTargetsWeekly=bool(record.AutoTuneTargetsWeekly),
        LastAutoTuneAt=record.LastAutoTuneAt,
        Goal=GoalSummaryValue,
        ShowWeightChartOnToday=bool(record.ShowWeightChartOnToday)
        if record.ShowWeightChartOnToday is not None
        else True,
        ShowStepsChartOnToday=bool(record.ShowStepsChartOnToday)
        if record.ShowStepsChartOnToday is not None
        else True,
        ShowWeightProjectionOnToday=bool(record.ShowWeightProjectionOnToday)
        if record.ShowWeightProjectionOnToday is not None
        else True,
        ReminderTimeZone=_ResolveReminderTimeZone(record.ReminderTimeZone),
        FoodRemindersEnabled=bool(record.FoodRemindersEnabled)
        if record.FoodRemindersEnabled is not None
        else False,
        FoodReminderTimes=_ParseFoodReminderTimes(record.FoodReminderTimes),
        WeightRemindersEnabled=bool(record.WeightRemindersEnabled)
        if record.WeightRemindersEnabled is not None
        else False,
        WeightReminderTime=_ResolveWeightReminderTime(record.WeightReminderTime),
        HaeApiKeyConfigured=bool(record.HaeApiKeyHash),
        HaeApiKeyLast4=record.HaeApiKeyLast4,
        HaeApiKeyCreatedAt=record.HaeApiKeyCreatedAt,
    )


def RotateHaeApiKey(db: Session, UserId: int) -> HaeApiKeyResponse:
    record = EnsureSettingsForUser(db, UserId)
    api_key = secrets.token_urlsafe(32)
    record.HaeApiKeyHash = HashApiKey(api_key)
    record.HaeApiKeyLast4 = api_key[-4:]
    record.HaeApiKeyCreatedAt = datetime.now(timezone.utc)
    db.add(record)
    db.commit()
    db.refresh(record)
    return HaeApiKeyResponse(
        ApiKey=api_key,
        Last4=record.HaeApiKeyLast4,
        CreatedAt=record.HaeApiKeyCreatedAt,
    )


def ResolveUserIdByHaeApiKey(db: Session, api_key: str) -> int | None:
    if not api_key:
        return None
    last4 = api_key[-4:]
    candidates = (
        db.query(SettingsModel)
        .filter(SettingsModel.HaeApiKeyLast4 == last4, SettingsModel.HaeApiKeyHash.isnot(None))
        .all()
    )
    for record in candidates:
        if record.HaeApiKeyHash and VerifyApiKey(api_key, record.HaeApiKeyHash):
            return record.UserId
    return None


def UpdateSettings(db: Session, UserId: int, Input: UpdateSettingsInput) -> UserSettings:
    record = EnsureSettingsForUser(db, UserId)

    for field, value in Input.dict(exclude_unset=True).items():
        if field == "TodayLayout" and value is not None:
            record.TodayLayout = json.dumps(value)
        elif field == "BarOrder" and value is not None:
            record.BarOrder = _SerializeBarOrder(value)
        elif field == "FoodReminderTimes":
            record.FoodReminderTimes = _SerializeFoodReminderTimes(value)
        elif field == "WeightReminderTime":
            if value is not None and not _IsValidTime(value):
                raise ValueError("Reminder time must be in HH:MM format.")
            record.WeightReminderTime = value or DefaultWeightReminderTime
        elif field == "ReminderTimeZone":
            record.ReminderTimeZone = _ResolveReminderTimeZone(value)
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
