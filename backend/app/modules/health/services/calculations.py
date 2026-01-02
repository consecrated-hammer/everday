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
    NetCaloriesRaw = TotalCaloriesRaw - CaloriesBurnedRaw

    TotalCalories = RoundCalories(TotalCaloriesRaw)
    TotalProtein = RoundNutrient(TotalProteinRaw)
    TotalFibre = RoundNutrient(TotalFibreRaw)
    TotalCarbs = RoundNutrient(TotalCarbsRaw)
    TotalFat = RoundNutrient(TotalFatRaw)
    TotalSaturatedFat = RoundNutrient(TotalSaturatedFatRaw)
    TotalSugar = RoundNutrient(TotalSugarRaw)
    TotalSodium = RoundNutrient(TotalSodiumRaw)
    CaloriesBurnedFromSteps = RoundCalories(CaloriesBurnedRaw)
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


def BuildDailySummary(LogDate, Steps: int, Totals: DailyTotals) -> DailySummary:
    return DailySummary(
        LogDate=LogDate,
        TotalCalories=Totals.TotalCalories,
        TotalProtein=Totals.TotalProtein,
        Steps=max(0, round(Steps)),
        NetCalories=Totals.NetCalories,
    )


def CalculateWeeklySummary(Days: list[DailySummary]) -> WeeklySummary:
    Count = max(len(Days), 1)
    Totals = {
        "TotalCalories": sum(Day.TotalCalories for Day in Days),
        "TotalProtein": sum(Day.TotalProtein for Day in Days),
        "TotalSteps": sum(Day.Steps for Day in Days),
        "TotalNetCalories": sum(Day.NetCalories for Day in Days),
    }

    Averages = {
        "AverageCalories": RoundCalories(Totals["TotalCalories"] / Count),
        "AverageProtein": RoundNutrient(Totals["TotalProtein"] / Count),
        "AverageSteps": RoundCalories(Totals["TotalSteps"] / Count),
        "AverageNetCalories": RoundCalories(Totals["TotalNetCalories"] / Count),
    }

    return WeeklySummary(Days=Days, Totals=Totals, Averages=Averages)
