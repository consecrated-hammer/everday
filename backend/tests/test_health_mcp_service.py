from datetime import date

from app.modules.health.schemas import DailySummary, DailyTotals, MealEntry, Targets, Workout
from app.modules.integrations.health_mcp import service


def _snapshot():
    targets = Targets(
        DailyCalorieTarget=2000,
        ProteinTargetMin=100,
        ProteinTargetMax=150,
        StepKcalFactor=0.04,
        StepTarget=8000,
    )
    totals = DailyTotals(
        TotalCalories=500,
        TotalProtein=25,
        TotalFibre=0,
        TotalCarbs=0,
        TotalFat=0,
        TotalSaturatedFat=0,
        TotalSugar=0,
        TotalSodium=0,
        CaloriesBurnedFromSteps=40,
        CaloriesBurnedFromWorkouts=120,
        TotalCaloriesBurned=160,
        NetCalories=340,
        RemainingCalories=1660,
        RemainingProteinMin=75,
        RemainingProteinMax=125,
        RemainingFibre=0,
        RemainingCarbs=0,
        RemainingFat=0,
        RemainingSaturatedFat=0,
        RemainingSugar=0,
        RemainingSodium=0,
    )
    summary = DailySummary(
        LogDate=date(2026, 7, 16),
        TotalCalories=500,
        TotalProtein=25,
        Steps=1000,
        CaloriesBurnedFromSteps=40,
        CaloriesBurnedFromWorkouts=120,
        TotalCaloriesBurned=160,
        WorkoutCount=1,
        NetCalories=340,
    )
    workouts = [
        Workout(
            WorkoutId="workout-1",
            LogDate=date(2026, 7, 16),
            WorkoutType="run",
            WorkoutName="Morning Run",
            CaloriesBurned=120,
            Source="automation",
        )
    ]
    return None, workouts, [], totals, summary, targets


def test_log_meal_from_image_low_confidence_skips_write(monkeypatch):
    monkeypatch.setattr(
        service,
        "ParseImageScan",
        lambda image_base64, mode, note=None: {
            "FoodName": "Unclear meal",
            "ServingQuantity": 1.0,
            "ServingUnit": "serving",
            "CaloriesPerServing": 0,
            "ProteinPerServing": 0,
            "Summary": "Need more detail.",
            "Confidence": "Low",
            "Questions": ["Please confirm the portion size."],
        },
    )
    monkeypatch.setattr(service, "_BuildDaySnapshot", lambda db, user_id, log_date: _snapshot())

    result = service.LogMealFromImage(
        db=None,
        user_id=1,
        image_base64="abc",
        log_date="2026-07-16",
    )

    assert result["Created"] is False
    assert result["Reason"] == "clarification_required"
    assert result["ParsedMeal"]["Confidence"] == "Low"
    assert result["MealEntryId"] is None
    assert result["Workouts"][0].WorkoutName == "Morning Run"


def test_log_meal_from_text_creates_entry(monkeypatch):
    monkeypatch.setattr(
        service,
        "ParseMealText",
        lambda text: {
            "MealName": "Apple",
            "ServingQuantity": 1.0,
            "ServingUnit": "each",
            "CaloriesPerServing": 95,
            "ProteinPerServing": 0.5,
            "Summary": "AI estimate.",
        },
    )

    class DummyLog:
        DailyLogId = "log-1"

    class DummyFood:
        FoodId = "food-1"
        ServingUnit = "each"
        ServingQuantity = 1.0

    monkeypatch.setattr(service, "EnsureDailyLogForDate", lambda db, user_id, log_date: DummyLog())
    monkeypatch.setattr(service, "_CreateAiFood", lambda db, user_id, parsed_meal: DummyFood())
    monkeypatch.setattr(
        service,
        "_CreateMealEntryFromFood",
        lambda db, user_id, daily_log_id, meal_type, food, note=None: MealEntry(
            MealEntryId="meal-1",
            DailyLogId=daily_log_id,
            MealType=meal_type,
            FoodId=food.FoodId,
            Quantity=1.0,
            PortionLabel="each",
            PortionBaseUnit="each",
            PortionBaseAmount=1.0,
            SortOrder=0,
        ),
    )
    monkeypatch.setattr(service, "_BuildDaySnapshot", lambda db, user_id, log_date: _snapshot())

    result = service.LogMealFromText(
        db=None,
        user_id=1,
        text="I ate an apple",
        log_date="2026-07-16",
        meal_type="Breakfast",
    )

    assert result["Created"] is True
    assert result["MealEntryId"] == "meal-1"
    assert result["ParsedMeal"]["FoodName"] == "Apple"
    assert result["Workouts"][0].CaloriesBurned == 120
