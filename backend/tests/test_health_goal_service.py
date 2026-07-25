from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock

from app.modules.health.schemas import GoalRecommendationInput, GoalType
from app.modules.health.services.goal_service import AddMonths, BuildGoalPlan, BuildGoalSummary, IsGoalMet
from app.modules.health.services.settings_service import _PersistGoalPlan


def test_add_months_handles_end_of_month():
    start = date(2024, 1, 31)
    result = AddMonths(start, 1)
    assert result == date(2024, 2, 29)


def test_build_goal_plan_lose_weight_targets_upper_bmi():
    plan = BuildGoalPlan(
        GoalTypeValue=GoalType.Lose,
        BmiMin=18.5,
        BmiMax=24.9,
        StartDate=date(2024, 1, 1),
        EndDate=date(2024, 7, 1),
        CurrentWeightKg=90,
        HeightCm=180,
        Age=30,
        ActivityLevel="moderately_active",
    )
    assert round(plan.TargetBmi, 1) == 24.9
    assert plan.TargetWeightKg < plan.CurrentWeightKg
    assert plan.DailyCalorieDelta < 0
    summary = BuildGoalSummary(plan, CompletedAt=None, Today=date(2024, 1, 1))
    assert "DailyCalorieTarget" not in summary.model_dump()


def test_build_goal_plan_maintain_keeps_current_bmi():
    height_cm = 170
    current_bmi = 22
    weight_kg = current_bmi * ((height_cm / 100) ** 2)
    plan = BuildGoalPlan(
        GoalTypeValue=GoalType.Maintain,
        BmiMin=18.5,
        BmiMax=24.9,
        StartDate=date(2024, 3, 1),
        EndDate=date(2024, 9, 1),
        CurrentWeightKg=weight_kg,
        HeightCm=height_cm,
        Age=35,
        ActivityLevel="lightly_active",
    )
    assert round(plan.TargetBmi, 1) == round(plan.CurrentBmi, 1)
    assert abs(plan.WeightDeltaKg) < 0.1


def test_build_goal_plan_allows_target_bmi_override():
    plan = BuildGoalPlan(
        GoalTypeValue=GoalType.Lose,
        BmiMin=18.5,
        BmiMax=24.9,
        StartDate=date(2024, 1, 1),
        EndDate=date(2024, 7, 1),
        CurrentWeightKg=90,
        HeightCm=180,
        Age=30,
        ActivityLevel="moderately_active",
        TargetBmiOverride=22.5,
    )
    assert round(plan.TargetBmi, 1) == 22.5
    assert plan.TargetWeightKg < plan.CurrentWeightKg


def test_goal_met_for_maintain_requires_end_date():
    plan = BuildGoalPlan(
        GoalTypeValue=GoalType.Maintain,
        BmiMin=18.5,
        BmiMax=24.9,
        StartDate=date(2024, 1, 1),
        EndDate=date(2024, 2, 1),
        CurrentWeightKg=65,
        HeightCm=170,
        Age=30,
        ActivityLevel="sedentary",
    )
    assert IsGoalMet(plan, date(2024, 1, 15)) is False
    assert IsGoalMet(plan, date(2024, 2, 1)) is True


def test_persisting_goal_does_not_replace_active_targets():
    plan = BuildGoalPlan(
        GoalTypeValue=GoalType.Lose,
        BmiMin=18.5,
        BmiMax=24.9,
        StartDate=date(2026, 7, 25),
        EndDate=date(2026, 12, 31),
        CurrentWeightKg=91,
        HeightCm=170,
        Age=30,
        ActivityLevel="sedentary",
    )
    record = SimpleNamespace(
        GoalSetAt=None,
        DailyCalorieTarget=1600,
        ProteinTargetMin=100,
        ProteinTargetMax=120,
        StepTarget=7000,
    )
    db = Mock()
    input_value = GoalRecommendationInput(GoalType="lose", BmiMin=18.5, BmiMax=24.9)

    _PersistGoalPlan(db, record, plan, input_value, datetime(2026, 7, 25, tzinfo=timezone.utc))

    assert record.GoalType == "lose"
    assert record.GoalEndDate == date(2026, 12, 31)
    assert record.DailyCalorieTarget == 1600
    assert record.ProteinTargetMin == 100
    assert record.ProteinTargetMax == 120
    assert record.StepTarget == 7000
