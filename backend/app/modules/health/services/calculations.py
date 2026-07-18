from app.modules.health.schemas import DailySummary, DailyTotals, MealEntryWithFood, Targets, WeeklySummary


def RoundCalories(Value: float) -> int:
    return round(Value)


def RoundNutrient(Value: float) -> float:
    return round(Value * 10) / 10


def CalculateDailyTotals(
    Entries: list[MealEntryWithFood],
    Steps: int,
    StepKcalFactor: float,
    Targets: Targets,
    WorkoutCaloriesBurned: int = 0,
) -> DailyTotals:
    TotalCaloriesRaw = sum(Entry.CaloriesPerServing * Entry.Quantity for Entry in Entries)
    TotalProteinRaw = sum(Entry.ProteinPerServing * Entry.Quantity for Entry in Entries)
    TotalFibreRaw = sum((Entry.FibrePerServing or 0) * Entry.Quantity for Entry in Entries)
    TotalCarbsRaw = sum((Entry.CarbsPerServing or 0) * Entry.Quantity for Entry in Entries)
    TotalFatRaw = sum((Entry.FatPerServing or 0) * Entry.Quantity for Entry in Entries)
    TotalSaturatedFatRaw = sum((Entry.SaturatedFatPerServing or 0) * Entry.Quantity for Entry in Entries)
    TotalSugarRaw = sum((Entry.SugarPerServing or 0) * Entry.Quantity for Entry in Entries)
    TotalSodiumRaw = sum((Entry.SodiumPerServing or 0) * Entry.Quantity for Entry in Entries)

    SafeSteps = max(0, round(Steps))
    CaloriesBurnedRaw = SafeSteps * StepKcalFactor
    SafeWorkoutCaloriesBurned = max(0, round(WorkoutCaloriesBurned))
    TotalCaloriesBurnedRaw = CaloriesBurnedRaw + SafeWorkoutCaloriesBurned
    NetCaloriesRaw = TotalCaloriesRaw - TotalCaloriesBurnedRaw

    TotalCalories = RoundCalories(TotalCaloriesRaw)
    TotalProtein = RoundNutrient(TotalProteinRaw)
    TotalFibre = RoundNutrient(TotalFibreRaw)
    TotalCarbs = RoundNutrient(TotalCarbsRaw)
    TotalFat = RoundNutrient(TotalFatRaw)
    TotalSaturatedFat = RoundNutrient(TotalSaturatedFatRaw)
    TotalSugar = RoundNutrient(TotalSugarRaw)
    TotalSodium = RoundNutrient(TotalSodiumRaw)
    CaloriesBurnedFromSteps = RoundCalories(CaloriesBurnedRaw)
    CaloriesBurnedFromWorkouts = RoundCalories(SafeWorkoutCaloriesBurned)
    TotalCaloriesBurned = RoundCalories(TotalCaloriesBurnedRaw)
    NetCalories = RoundCalories(NetCaloriesRaw)
    RemainingCalories = RoundCalories(Targets.DailyCalorieTarget - NetCaloriesRaw)
    RemainingProteinMin = RoundNutrient(Targets.ProteinTargetMin - TotalProteinRaw)
    RemainingProteinMax = RoundNutrient(Targets.ProteinTargetMax - TotalProteinRaw)
    RemainingFibre = RoundNutrient((Targets.FibreTarget or 0) - TotalFibreRaw)
    RemainingCarbs = RoundNutrient((Targets.CarbsTarget or 0) - TotalCarbsRaw)
    RemainingFat = RoundNutrient((Targets.FatTarget or 0) - TotalFatRaw)
    RemainingSaturatedFat = RoundNutrient((Targets.SaturatedFatTarget or 0) - TotalSaturatedFatRaw)
    RemainingSugar = RoundNutrient((Targets.SugarTarget or 0) - TotalSugarRaw)
    RemainingSodium = RoundNutrient((Targets.SodiumTarget or 0) - TotalSodiumRaw)

    return DailyTotals(
        TotalCalories=TotalCalories,
        TotalProtein=TotalProtein,
        TotalFibre=TotalFibre,
        TotalCarbs=TotalCarbs,
        TotalFat=TotalFat,
        TotalSaturatedFat=TotalSaturatedFat,
        TotalSugar=TotalSugar,
        TotalSodium=TotalSodium,
        CaloriesBurnedFromSteps=CaloriesBurnedFromSteps,
        CaloriesBurnedFromWorkouts=CaloriesBurnedFromWorkouts,
        TotalCaloriesBurned=TotalCaloriesBurned,
        NetCalories=NetCalories,
        RemainingCalories=RemainingCalories,
        RemainingProteinMin=RemainingProteinMin,
        RemainingProteinMax=RemainingProteinMax,
        RemainingFibre=RemainingFibre,
        RemainingCarbs=RemainingCarbs,
        RemainingFat=RemainingFat,
        RemainingSaturatedFat=RemainingSaturatedFat,
        RemainingSugar=RemainingSugar,
        RemainingSodium=RemainingSodium,
    )


def BuildDailySummary(LogDate, Steps: int, Totals: DailyTotals, WorkoutCount: int = 0) -> DailySummary:
    return DailySummary(
        LogDate=LogDate,
        TotalCalories=Totals.TotalCalories,
        TotalProtein=Totals.TotalProtein,
        TotalFibre=Totals.TotalFibre,
        TotalCarbs=Totals.TotalCarbs,
        TotalFat=Totals.TotalFat,
        TotalSaturatedFat=Totals.TotalSaturatedFat,
        TotalSugar=Totals.TotalSugar,
        TotalSodium=Totals.TotalSodium,
        Steps=max(0, round(Steps)),
        CaloriesBurnedFromSteps=Totals.CaloriesBurnedFromSteps,
        CaloriesBurnedFromWorkouts=Totals.CaloriesBurnedFromWorkouts,
        TotalCaloriesBurned=Totals.TotalCaloriesBurned,
        WorkoutCount=max(0, int(WorkoutCount or 0)),
        NetCalories=Totals.NetCalories,
    )


def CalculateWeeklySummary(Days: list[DailySummary]) -> WeeklySummary:
    Count = max(len(Days), 1)
    Totals = {
        "TotalCalories": sum(Day.TotalCalories for Day in Days),
        "TotalProtein": sum(Day.TotalProtein for Day in Days),
        "TotalFibre": sum(Day.TotalFibre for Day in Days),
        "TotalCarbs": sum(Day.TotalCarbs for Day in Days),
        "TotalFat": sum(Day.TotalFat for Day in Days),
        "TotalSaturatedFat": sum(Day.TotalSaturatedFat for Day in Days),
        "TotalSugar": sum(Day.TotalSugar for Day in Days),
        "TotalSodium": sum(Day.TotalSodium for Day in Days),
        "TotalSteps": sum(Day.Steps for Day in Days),
        "TotalCaloriesBurnedFromSteps": sum(Day.CaloriesBurnedFromSteps for Day in Days),
        "TotalCaloriesBurnedFromWorkouts": sum(Day.CaloriesBurnedFromWorkouts for Day in Days),
        "TotalCaloriesBurned": sum(Day.TotalCaloriesBurned for Day in Days),
        "TotalWorkoutCount": sum(Day.WorkoutCount for Day in Days),
        "TotalNetCalories": sum(Day.NetCalories for Day in Days),
    }

    Averages = {
        "AverageCalories": RoundCalories(Totals["TotalCalories"] / Count),
        "AverageProtein": RoundNutrient(Totals["TotalProtein"] / Count),
        "AverageFibre": RoundNutrient(Totals["TotalFibre"] / Count),
        "AverageCarbs": RoundNutrient(Totals["TotalCarbs"] / Count),
        "AverageFat": RoundNutrient(Totals["TotalFat"] / Count),
        "AverageSaturatedFat": RoundNutrient(Totals["TotalSaturatedFat"] / Count),
        "AverageSugar": RoundNutrient(Totals["TotalSugar"] / Count),
        "AverageSodium": RoundNutrient(Totals["TotalSodium"] / Count),
        "AverageSteps": RoundCalories(Totals["TotalSteps"] / Count),
        "AverageCaloriesBurnedFromSteps": RoundCalories(Totals["TotalCaloriesBurnedFromSteps"] / Count),
        "AverageCaloriesBurnedFromWorkouts": RoundCalories(Totals["TotalCaloriesBurnedFromWorkouts"] / Count),
        "AverageCaloriesBurned": RoundCalories(Totals["TotalCaloriesBurned"] / Count),
        "AverageWorkoutCount": RoundNutrient(Totals["TotalWorkoutCount"] / Count),
        "AverageNetCalories": RoundCalories(Totals["TotalNetCalories"] / Count),
    }

    return WeeklySummary(Days=Days, Totals=Totals, Averages=Averages)
