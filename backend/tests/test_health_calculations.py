from datetime import date

from app.modules.health.schemas import MealEntryWithFood, Targets, DailySummary
from app.modules.health.services.calculations import (
    BuildDailySummary,
    CalculateDailyTotals,
    CalculateWeeklySummary,
)


def test_calculate_daily_totals_steps_and_remaining():
    targets = Targets(
        DailyCalorieTarget=2000,
        ProteinTargetMin=100,
        ProteinTargetMax=150,
        StepKcalFactor=0.04,
        StepTarget=8000,
    )

    entries = [
        MealEntryWithFood(
            MealEntryId="1",
            DailyLogId="log",
            MealType="Breakfast",
            FoodId="food-1",
            FoodName="Food A",
            ServingDescription="1 serving",
            CaloriesPerServing=500,
            ProteinPerServing=30,
            Quantity=1,
            SortOrder=0,
        ),
        MealEntryWithFood(
            MealEntryId="2",
            DailyLogId="log",
            MealType="Lunch",
            FoodId="food-2",
            FoodName="Food B",
            ServingDescription="1 serving",
            CaloriesPerServing=200,
            ProteinPerServing=10,
            Quantity=1,
            SortOrder=1,
        ),
    ]

    totals = CalculateDailyTotals(entries, Steps=1000, StepKcalFactor=targets.StepKcalFactor, Targets=targets)

    assert totals.TotalCalories == 700
    assert totals.TotalProtein == 40
    assert totals.CaloriesBurnedFromSteps == 40
    assert totals.NetCalories == 660
    assert totals.RemainingCalories == 1340
    assert totals.RemainingProteinMin == 60
    assert totals.RemainingProteinMax == 110


def test_calculate_weekly_summary():
    summaries = [
        DailySummary(LogDate=date(2024, 1, 1), TotalCalories=1800, TotalProtein=120, Steps=8000, NetCalories=1600),
        DailySummary(LogDate=date(2024, 1, 2), TotalCalories=2000, TotalProtein=140, Steps=9000, NetCalories=1900),
    ]

    weekly = CalculateWeeklySummary(summaries)

    assert weekly.Totals["TotalCalories"] == 3800
    assert weekly.Totals["TotalProtein"] == 260
    assert weekly.Totals["TotalSteps"] == 17000
    assert weekly.Averages["AverageCalories"] == 1900
    assert weekly.Averages["AverageProtein"] == 130


def test_build_daily_summary():
    totals = CalculateDailyTotals([], Steps=0, StepKcalFactor=0.04, Targets=Targets(
        DailyCalorieTarget=1800,
        ProteinTargetMin=80,
        ProteinTargetMax=120,
        StepKcalFactor=0.04,
        StepTarget=7000,
    ))
    summary = BuildDailySummary(date(2024, 1, 3), Steps=0, Totals=totals)
    assert summary.TotalCalories == 0
    assert summary.Steps == 0
