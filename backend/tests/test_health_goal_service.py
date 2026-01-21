from datetime import date

from app.modules.health.schemas import GoalType
from app.modules.health.services.goal_service import AddMonths, BuildGoalPlan, IsGoalMet


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
