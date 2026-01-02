from app.modules.health.schemas import DailyLogWithEntries, MealEntryWithFood, MealType, Suggestion, SuggestionsInput

MealTypes: list[MealType] = [
    MealType.Breakfast,
    MealType.Snack1,
    MealType.Lunch,
    MealType.Snack2,
    MealType.Dinner,
    MealType.Snack3,
]

PrimaryMeals: list[MealType] = [
    MealType.Breakfast,
    MealType.Lunch,
    MealType.Dinner,
]


def GetEntriesForMealType(Entries: list[MealEntryWithFood], TargetMealType: MealType) -> list[MealEntryWithFood]:
    return [Entry for Entry in Entries if Entry.MealType == TargetMealType]


def SumCalories(Entries: list[MealEntryWithFood]) -> float:
    return sum(Entry.CaloriesPerServing * Entry.Quantity for Entry in Entries)


def SumProtein(Entries: list[MealEntryWithFood]) -> float:
    return sum(Entry.ProteinPerServing * Entry.Quantity for Entry in Entries)


def BuildLowProteinMorningSuggestion(Log: DailyLogWithEntries) -> Suggestion | None:
    BreakfastEntries = GetEntriesForMealType(Log.Entries, MealType.Breakfast)
    if not BreakfastEntries:
        return None

    BreakfastProtein = SumProtein(BreakfastEntries)
    if BreakfastProtein >= 20:
        return None

    return Suggestion(
        SuggestionType="LowProteinMorning",
        Title="Boost breakfast protein",
        Detail="Aim for 20g protein at breakfast to stay fuller and level energy.",
    )


def BuildHighCalorieSnackSuggestion(Log: DailyLogWithEntries) -> Suggestion | None:
    SnackEntries = (
        GetEntriesForMealType(Log.Entries, MealType.Snack1)
        + GetEntriesForMealType(Log.Entries, MealType.Snack2)
        + GetEntriesForMealType(Log.Entries, MealType.Snack3)
    )

    if not SnackEntries:
        return None

    SnackCalories = SumCalories(SnackEntries)
    if SnackCalories < 450:
        return None

    return Suggestion(
        SuggestionType="HighCalorieSnacks",
        Title="Balance snack calories",
        Detail="Try swapping one snack for fruit plus protein to keep calories steady.",
    )


def BuildMissedMealsSuggestion(Log: DailyLogWithEntries) -> Suggestion | None:
    MissedMeals = [
        MealTypeValue
        for MealTypeValue in PrimaryMeals
        if not GetEntriesForMealType(Log.Entries, MealTypeValue)
    ]

    if not MissedMeals:
        return None

    Label = ", ".join(MealTypeValue.value for MealTypeValue in MissedMeals)

    return Suggestion(
        SuggestionType="MissedMeals",
        Title="Keep meals consistent",
        Detail=f"You skipped {Label}. A small planned meal can prevent late cravings.",
    )


def BuildRepeatedSnackSuggestion(RecentLogs: list[DailyLogWithEntries]) -> Suggestion | None:
    SnackCounts: dict[str, int] = {}

    for Log in RecentLogs:
        SnackEntries = [
            Entry
            for Entry in Log.Entries
            if Entry.MealType in [MealType.Snack1, MealType.Snack2, MealType.Snack3]
        ]

        for Entry in SnackEntries:
            Key = Entry.FoodName.strip().lower()
            if not Key:
                continue
            SnackCounts[Key] = SnackCounts.get(Key, 0) + 1

    TopSnack = None
    TopCount = 0

    for Snack, Count in SnackCounts.items():
        if Count > TopCount:
            TopCount = Count
            TopSnack = Snack

    if not TopSnack or TopCount < 3:
        return None

    SnackLabel = " ".join(Word.capitalize() for Word in TopSnack.split(" "))

    return Suggestion(
        SuggestionType="RepeatedPattern",
        Title="Rotate repeat snacks",
        Detail=(
            f"You have picked {SnackLabel} {TopCount} times recently. "
            "Rotate in a lighter option for variety."
        ),
    )


def BuildSuggestions(Input: SuggestionsInput) -> list[Suggestion]:
    Suggestions: list[Suggestion] = []

    RuleSuggestions = [
        BuildLowProteinMorningSuggestion(Input.Log),
        BuildHighCalorieSnackSuggestion(Input.Log),
        BuildMissedMealsSuggestion(Input.Log),
        BuildRepeatedSnackSuggestion(Input.RecentLogs),
    ]

    for SuggestionItem in RuleSuggestions:
        if SuggestionItem:
            Suggestions.append(SuggestionItem)

    return Suggestions


def BuildMealBuckets(Entries: list[MealEntryWithFood]) -> dict[MealType, list[MealEntryWithFood]]:
    Buckets: dict[MealType, list[MealEntryWithFood]] = {
        MealType.Breakfast: [],
        MealType.Snack1: [],
        MealType.Lunch: [],
        MealType.Snack2: [],
        MealType.Dinner: [],
        MealType.Snack3: [],
    }

    for Entry in Entries:
        Buckets[Entry.MealType].append(Entry)

    for MealTypeValue in MealTypes:
        Buckets[MealTypeValue].sort(key=lambda Entry: Entry.SortOrder)

    return Buckets
