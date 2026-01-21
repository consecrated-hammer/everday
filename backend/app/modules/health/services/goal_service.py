from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import calendar

from app.modules.health.schemas import GoalSummary, GoalType


CaloriesPerKg = 7700
NeutralBmrOffset = -78
ActivityMultipliers = {
    "sedentary": 1.2,
    "lightly_active": 1.375,
    "moderately_active": 1.55,
    "very_active": 1.725,
    "extra_active": 1.9,
}


@dataclass(frozen=True)
class GoalPlan:
    GoalType: GoalType
    BmiMin: float
    BmiMax: float
    StartDate: date
    EndDate: date
    CurrentWeightKg: float
    CurrentBmi: float
    TargetWeightKg: float
    TargetBmi: float
    WeightDeltaKg: float
    DurationDays: int
    DailyCalorieTarget: int
    DailyCalorieDelta: float


def AddMonths(StartDate: date, Months: int) -> date:
    if Months <= 0:
        return StartDate
    Year = StartDate.year + (StartDate.month - 1 + Months) // 12
    Month = (StartDate.month - 1 + Months) % 12 + 1
    Day = min(StartDate.day, calendar.monthrange(Year, Month)[1])
    return date(Year, Month, Day)


def CalculateBmi(WeightKg: float, HeightCm: int) -> float:
    HeightMeters = HeightCm / 100
    if HeightMeters <= 0:
        raise ValueError("Height must be positive.")
    return WeightKg / (HeightMeters ** 2)


def ResolveTargetBmi(GoalTypeValue: GoalType, BmiMin: float, BmiMax: float, CurrentBmi: float) -> float:
    if GoalTypeValue == GoalType.Lose:
        return BmiMax
    if GoalTypeValue == GoalType.Gain:
        return BmiMin
    if BmiMin <= CurrentBmi <= BmiMax:
        return CurrentBmi
    return BmiMin if CurrentBmi < BmiMin else BmiMax


def CalculateBmr(Age: int, HeightCm: int, WeightKg: float) -> float:
    return (10 * WeightKg) + (6.25 * HeightCm) - (5 * Age) + NeutralBmrOffset


def GetActivityMultiplier(ActivityLevel: str | None) -> float:
    if not ActivityLevel:
        return ActivityMultipliers["sedentary"]
    return ActivityMultipliers.get(ActivityLevel, ActivityMultipliers["sedentary"])


def BuildGoalPlan(
    *,
    GoalTypeValue: GoalType,
    BmiMin: float,
    BmiMax: float,
    StartDate: date,
    EndDate: date,
    CurrentWeightKg: float,
    HeightCm: int,
    Age: int,
    ActivityLevel: str,
    TargetBmiOverride: float | None = None,
) -> GoalPlan:
    if BmiMin >= BmiMax:
        raise ValueError("BMI range must have a minimum below the maximum.")
    if EndDate <= StartDate:
        raise ValueError("Goal end date must be after the start date.")
    DurationDays = (EndDate - StartDate).days
    if DurationDays <= 0:
        raise ValueError("Goal duration must be at least one day.")

    CurrentBmi = CalculateBmi(CurrentWeightKg, HeightCm)
    if TargetBmiOverride is not None:
        TargetBmi = float(TargetBmiOverride)
    else:
        TargetBmi = ResolveTargetBmi(GoalTypeValue, BmiMin, BmiMax, CurrentBmi)
    TargetWeightKg = TargetBmi * ((HeightCm / 100) ** 2)
    WeightDeltaKg = TargetWeightKg - CurrentWeightKg

    Bmr = CalculateBmr(Age, HeightCm, CurrentWeightKg)
    Tdee = Bmr * GetActivityMultiplier(ActivityLevel)
    DailyCalorieDelta = (WeightDeltaKg * CaloriesPerKg) / DurationDays
    DailyCalorieTarget = int(round(Tdee + DailyCalorieDelta))

    return GoalPlan(
        GoalType=GoalTypeValue,
        BmiMin=float(BmiMin),
        BmiMax=float(BmiMax),
        StartDate=StartDate,
        EndDate=EndDate,
        CurrentWeightKg=float(CurrentWeightKg),
        CurrentBmi=float(CurrentBmi),
        TargetWeightKg=float(TargetWeightKg),
        TargetBmi=float(TargetBmi),
        WeightDeltaKg=float(WeightDeltaKg),
        DurationDays=int(DurationDays),
        DailyCalorieTarget=DailyCalorieTarget,
        DailyCalorieDelta=float(DailyCalorieDelta),
    )


def IsGoalMet(Plan: GoalPlan, Today: date) -> bool:
    if Plan.GoalType == GoalType.Lose:
        return Plan.CurrentWeightKg <= Plan.TargetWeightKg
    if Plan.GoalType == GoalType.Gain:
        return Plan.CurrentWeightKg >= Plan.TargetWeightKg
    if Today < Plan.EndDate:
        return False
    return Plan.BmiMin <= Plan.CurrentBmi <= Plan.BmiMax


def BuildGoalSummary(
    Plan: GoalPlan,
    *,
    CompletedAt: datetime | None,
    Today: date,
) -> GoalSummary:
    if CompletedAt:
        Status = "completed"
    elif Today > Plan.EndDate:
        Status = "expired"
    else:
        Status = "active"

    RemainingDays = (Plan.EndDate - Today).days
    if RemainingDays < 0:
        RemainingDays = 0

    return GoalSummary(
        GoalType=Plan.GoalType,
        BmiMin=Plan.BmiMin,
        BmiMax=Plan.BmiMax,
        StartDate=Plan.StartDate,
        EndDate=Plan.EndDate,
        CurrentWeightKg=Plan.CurrentWeightKg,
        CurrentBmi=Plan.CurrentBmi,
        TargetWeightKg=Plan.TargetWeightKg,
        TargetBmi=Plan.TargetBmi,
        WeightDeltaKg=Plan.WeightDeltaKg,
        DurationDays=Plan.DurationDays,
        RemainingDays=RemainingDays,
        DailyCalorieTarget=Plan.DailyCalorieTarget,
        DailyCalorieDelta=Plan.DailyCalorieDelta,
        Status=Status,
        CompletedAt=CompletedAt,
    )
