from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class MealType(str, Enum):
    Breakfast = "Breakfast"
    Snack1 = "Snack1"
    Lunch = "Lunch"
    Snack2 = "Snack2"
    Dinner = "Dinner"
    Snack3 = "Snack3"


MealTypeValue = MealType


class ImageScanMode(str, Enum):
    Meal = "meal"
    Label = "label"


class FoodReminderSlot(BaseModel):
    Enabled: bool = False
    Time: str = Field(default="08:00", pattern=r"^\d{2}:\d{2}$")


class GoalType(str, Enum):
    Lose = "lose"
    Maintain = "maintain"
    Gain = "gain"


class Food(BaseModel):
    FoodId: str
    OwnerUserId: int | None = None
    CreatedByName: str | None = None
    FoodName: str
    ServingDescription: str
    ServingQuantity: float = 1.0
    ServingUnit: str = "serving"
    CaloriesPerServing: int
    ProteinPerServing: float
    FibrePerServing: float | None = None
    CarbsPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    SugarPerServing: float | None = None
    SodiumPerServing: float | None = None
    DataSource: str = "manual"
    CountryCode: str = "AU"
    IsFavourite: bool = False
    ImageUrl: str | None = None
    CreatedAt: datetime | None = None


class FoodInfo(BaseModel):
    FoodName: str
    ServingDescription: str
    CaloriesPerServing: int | None = None
    ProteinPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    CarbohydratesPerServing: float | None = None
    SugarPerServing: float | None = None
    FiberPerServing: float | None = None
    SodiumPerServing: float | None = None
    Metadata: dict | None = None


class DailyLog(BaseModel):
    DailyLogId: str
    LogDate: date
    DayName: str | None = None
    WeekNumber: int | None = None
    WeekStart: date | None = None
    Steps: int
    StepKcalFactorOverride: float | None = None
    WeightKg: float | None = None
    OfficeMode: str | None = None
    WaterLitres: float | None = None
    WalkingPadMinutes: int | None = None
    ExerciseNotes: str | None = None
    SleepHours: float | None = None
    Period: bool | None = None
    PeriodLabel: str | None = None
    HungerBeforeDinner: int | None = None
    OverallSatisfaction: int | None = None
    Takeaway: bool | None = None
    LoggedComplete: bool | None = None
    AdherentDay: bool | None = None
    AdherentStatus: str | None = None
    Notes: str | None = None
    DailyCalorieTargetSnapshot: int | None = None
    ProteinTargetSnapshot: float | None = None
    StepTargetSnapshot: int | None = None


class Workout(BaseModel):
    WorkoutId: str
    LogDate: date
    WorkoutType: str
    WorkoutName: str
    DurationMinutes: float | None = None
    CaloriesBurned: int = 0
    DistanceKm: float | None = None
    Source: str
    ExternalId: str | None = None
    StartedAt: datetime | None = None
    EndedAt: datetime | None = None
    Notes: str | None = None
    Metadata: dict | None = None
    CreatedAt: datetime | None = None


class MealEntry(BaseModel):
    MealEntryId: str
    DailyLogId: str
    MealType: MealType
    FoodId: str | None = None
    MealTemplateId: str | None = None
    Quantity: float
    DisplayQuantity: float | None = None
    PortionOptionId: str | None = None
    PortionLabel: str | None = None
    PortionBaseUnit: str | None = None
    PortionBaseAmount: float | None = None
    PortionBaseTotal: float | None = None
    EntryNotes: str | None = None
    SortOrder: int
    ScheduleSlotId: str | None = None
    CreatedAt: datetime | None = None


class MealEntryWithFood(BaseModel):
    MealEntryId: str
    DailyLogId: str
    MealType: MealType
    FoodId: str | None = None
    MealTemplateId: str | None = None
    TemplateName: str | None = None
    FoodName: str
    ServingDescription: str
    CaloriesPerServing: int
    ProteinPerServing: float
    FibrePerServing: float | None = None
    CarbsPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    SugarPerServing: float | None = None
    SodiumPerServing: float | None = None
    ImageUrl: str | None = None
    Quantity: float
    DisplayQuantity: float | None = None
    PortionOptionId: str | None = None
    PortionLabel: str | None = None
    PortionBaseUnit: str | None = None
    PortionBaseAmount: float | None = None
    PortionBaseTotal: float | None = None
    EntryNotes: str | None = None
    SortOrder: int
    ScheduleSlotId: str | None = None
    CreatedAt: datetime | None = None


class Targets(BaseModel):
    DailyCalorieTarget: int
    ProteinTargetMin: float
    ProteinTargetMax: float
    StepKcalFactor: float
    StepTarget: int
    FibreTarget: float | None = None
    CarbsTarget: float | None = None
    FatTarget: float | None = None
    SaturatedFatTarget: float | None = None
    SugarTarget: float | None = None
    SodiumTarget: float | None = None
    ShowProteinOnToday: bool = True
    ShowStepsOnToday: bool = True
    ShowFibreOnToday: bool = False
    ShowCarbsOnToday: bool = False
    ShowFatOnToday: bool = False
    ShowSaturatedFatOnToday: bool = False
    ShowSugarOnToday: bool = False
    ShowSodiumOnToday: bool = False
    BarOrder: list[str] = Field(
        default_factory=lambda: [
            "Calories",
            "Protein",
            "Steps",
            "Fibre",
            "Carbs",
            "Fat",
            "SaturatedFat",
            "Sugar",
            "Sodium",
        ]
    )


class UserSettings(BaseModel):
    Targets: Targets
    TodayLayout: list[str]
    AutoTuneTargetsWeekly: bool = False
    LastAutoTuneAt: datetime | None = None
    Goal: "GoalSummary | None" = None
    ShowWeightChartOnToday: bool = True
    ShowStepsChartOnToday: bool = True
    ShowWeightProjectionOnToday: bool = True
    ReminderTimeZone: str = "Australia/Adelaide"
    FoodRemindersEnabled: bool = False
    FoodReminderTimes: dict[str, str] = Field(default_factory=dict)
    FoodReminderSlots: dict[str, FoodReminderSlot] = Field(default_factory=dict)
    WeightRemindersEnabled: bool = False
    WeightReminderTime: str | None = None
    HaeApiKeyConfigured: bool = False
    HaeApiKeyLast4: str | None = None
    HaeApiKeyCreatedAt: datetime | None = None


class UpdateSettingsInput(BaseModel):
    DailyCalorieTarget: int | None = Field(default=None, ge=0)
    ProteinTargetMin: float | None = Field(default=None, ge=0)
    ProteinTargetMax: float | None = Field(default=None, ge=0)
    StepKcalFactor: float | None = Field(default=None, ge=0)
    StepTarget: int | None = Field(default=None, ge=0)
    FibreTarget: float | None = Field(default=None, ge=0)
    CarbsTarget: float | None = Field(default=None, ge=0)
    FatTarget: float | None = Field(default=None, ge=0)
    SaturatedFatTarget: float | None = Field(default=None, ge=0)
    SugarTarget: float | None = Field(default=None, ge=0)
    SodiumTarget: float | None = Field(default=None, ge=0)
    ShowProteinOnToday: bool | None = None
    ShowStepsOnToday: bool | None = None
    ShowFibreOnToday: bool | None = None
    ShowCarbsOnToday: bool | None = None
    ShowFatOnToday: bool | None = None
    ShowSaturatedFatOnToday: bool | None = None
    ShowSugarOnToday: bool | None = None
    ShowSodiumOnToday: bool | None = None
    TodayLayout: list[str] | None = None
    BarOrder: list[str] | None = None
    AutoTuneTargetsWeekly: bool | None = None
    ShowWeightChartOnToday: bool | None = None
    ShowStepsChartOnToday: bool | None = None
    ShowWeightProjectionOnToday: bool | None = None
    ReminderTimeZone: str | None = None
    FoodRemindersEnabled: bool | None = None
    FoodReminderTimes: dict[str, str] | None = None
    FoodReminderSlots: dict[str, FoodReminderSlot] | None = None
    WeightRemindersEnabled: bool | None = None
    WeightReminderTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class GoalSummary(BaseModel):
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
    RemainingDays: int
    DailyCalorieTarget: int
    DailyCalorieDelta: float
    Status: str
    CompletedAt: datetime | None = None


class GoalRecommendationInput(BaseModel):
    GoalType: GoalType
    BmiMin: float = Field(gt=0, le=60)
    BmiMax: float = Field(gt=0, le=60)
    StartDate: date | None = None
    DurationMonths: int = Field(default=6, ge=1, le=36)
    EndDateOverride: date | None = None
    TargetWeightKgOverride: float | None = Field(default=None, gt=0)
    DailyCalorieTargetOverride: int | None = Field(default=None, ge=0)
    ApplyGoal: bool = False


class DailyTotals(BaseModel):
    TotalCalories: int
    TotalProtein: float
    TotalFibre: float
    TotalCarbs: float
    TotalFat: float
    TotalSaturatedFat: float
    TotalSugar: float
    TotalSodium: float
    CaloriesBurnedFromSteps: int
    CaloriesBurnedFromWorkouts: int = 0
    TotalCaloriesBurned: int = 0
    NetCalories: int
    RemainingCalories: int
    RemainingProteinMin: float
    RemainingProteinMax: float
    RemainingFibre: float
    RemainingCarbs: float
    RemainingFat: float
    RemainingSaturatedFat: float
    RemainingSugar: float
    RemainingSodium: float


class DailySummary(BaseModel):
    LogDate: date
    TotalCalories: int
    TotalProtein: float
    TotalFibre: float = 0
    TotalCarbs: float = 0
    TotalFat: float = 0
    TotalSaturatedFat: float = 0
    TotalSugar: float = 0
    TotalSodium: float = 0
    Steps: int
    CaloriesBurnedFromSteps: int = 0
    CaloriesBurnedFromWorkouts: int = 0
    TotalCaloriesBurned: int = 0
    WorkoutCount: int = 0
    NetCalories: int


class WeeklySummary(BaseModel):
    Days: list[DailySummary]
    Totals: dict
    Averages: dict


class WeightHistoryEntry(BaseModel):
    LogDate: date
    WeightKg: float


class WeightHistoryResponse(BaseModel):
    Weights: list[WeightHistoryEntry]


class StepsHistoryEntry(BaseModel):
    LogDate: date
    Steps: int


class StepsHistoryResponse(BaseModel):
    Steps: list[StepsHistoryEntry]


class WorkoutHistoryEntry(BaseModel):
    WorkoutId: str
    LogDate: date
    WorkoutType: str
    WorkoutName: str
    DurationMinutes: float | None = None
    CaloriesBurned: int = 0
    DistanceKm: float | None = None
    Source: str
    ExternalId: str | None = None
    StartedAt: datetime | None = None
    EndedAt: datetime | None = None
    Notes: str | None = None


class WorkoutHistoryResponse(BaseModel):
    Workouts: list[WorkoutHistoryEntry]


class HaeImportResponse(BaseModel):
    ImportId: str
    MetricsCount: int
    WorkoutsCount: int
    StepsUpdated: int
    WeightUpdated: int
    SleepUpdated: int


class HaeApiKeyResponse(BaseModel):
    ApiKey: str
    Last4: str
    CreatedAt: datetime


class UserProfile(BaseModel):
    UserId: int
    Username: str
    FirstName: str | None = None
    LastName: str | None = None
    Email: str | None = None
    BirthDate: date | None = None
    HeightCm: int | None = None
    WeightKg: float | None = None
    ActivityLevel: str | None = None
    IsAdmin: bool = False


class UpdateProfileInput(BaseModel):
    FirstName: str | None = Field(default=None, max_length=100)
    LastName: str | None = Field(default=None, max_length=100)
    Email: str | None = Field(default=None, max_length=254)
    BirthDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    HeightCm: int | None = Field(default=None, ge=50, le=300)
    WeightKg: float | None = Field(default=None, ge=20, le=500)
    ActivityLevel: str | None = None


class Suggestion(BaseModel):
    SuggestionType: str
    Title: str
    Detail: str


class SuggestionsResponse(BaseModel):
    Suggestions: list[Suggestion]
    ModelUsed: str | None = None


class DailyAiSuggestionsRunResponse(BaseModel):
    EligibleUsers: int
    SuggestionsGenerated: int
    NotificationsSent: int
    Errors: int


class DailyTipRunRequest(BaseModel):
    RunDate: date | None = None
    RunTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    Slot: str | None = Field(default=None, pattern=r"^(morning|midday|dinner)$")
    UserId: int | None = Field(default=None, ge=1)


class DailyTipRunResponse(BaseModel):
    Slot: str
    ProcessedUsers: int
    Generated: int
    Skipped: int
    Errors: int


class DailyLogWithEntries(BaseModel):
    DailyLog: DailyLog
    Entries: list[MealEntryWithFood]


class SuggestionsInput(BaseModel):
    Log: DailyLogWithEntries
    RecentLogs: list[DailyLogWithEntries]


class CreateFoodInput(BaseModel):
    FoodName: str = Field(min_length=1)
    ServingDescription: str = Field(min_length=1, default="1 serving")
    ServingQuantity: float = Field(default=1.0, gt=0)
    ServingUnit: str = Field(default="serving", min_length=1)
    CaloriesPerServing: float = Field(ge=0)
    ProteinPerServing: float = Field(ge=0)
    FibrePerServing: float | None = Field(default=None, ge=0)
    CarbsPerServing: float | None = Field(default=None, ge=0)
    FatPerServing: float | None = Field(default=None, ge=0)
    SaturatedFatPerServing: float | None = Field(default=None, ge=0)
    SugarPerServing: float | None = Field(default=None, ge=0)
    SodiumPerServing: float | None = Field(default=None, ge=0)
    DataSource: str = Field(default="manual")
    CountryCode: str = Field(default="AU")
    IsFavourite: bool = False
    ImageBase64: str | None = Field(default=None, min_length=1)


class UpdateFoodInput(BaseModel):
    FoodName: str | None = Field(default=None, min_length=1)
    ServingQuantity: float | None = Field(default=None, gt=0)
    ServingUnit: str | None = Field(default=None, min_length=1)
    CaloriesPerServing: float | None = Field(default=None, ge=0)
    ProteinPerServing: float | None = Field(default=None, ge=0)
    FibrePerServing: float | None = Field(default=None, ge=0)
    CarbsPerServing: float | None = Field(default=None, ge=0)
    FatPerServing: float | None = Field(default=None, ge=0)
    SaturatedFatPerServing: float | None = Field(default=None, ge=0)
    SugarPerServing: float | None = Field(default=None, ge=0)
    SodiumPerServing: float | None = Field(default=None, ge=0)
    IsFavourite: bool | None = None
    ImageBase64: str | None = Field(default=None, min_length=1)


class CreateDailyLogInput(BaseModel):
    LogDate: str = Field(min_length=1)
    Steps: int = Field(default=0, ge=0)
    StepKcalFactorOverride: float | None = Field(default=None, ge=0)
    WeightKg: float | None = Field(default=None, ge=20, le=500)
    OfficeMode: str | None = Field(default=None, min_length=1, max_length=20)
    WaterLitres: float | None = Field(default=None, ge=0, le=20)
    WalkingPadMinutes: int | None = Field(default=None, ge=0, le=1440)
    ExerciseNotes: str | None = Field(default=None, max_length=1000)
    SleepHours: float | None = Field(default=None, ge=0, le=24)
    Period: bool | None = None
    PeriodLabel: str | None = Field(default=None, min_length=1, max_length=40)
    HungerBeforeDinner: int | None = Field(default=None, ge=1, le=10)
    OverallSatisfaction: int | None = Field(default=None, ge=1, le=10)
    Takeaway: bool | None = None
    LoggedComplete: bool | None = None
    AdherentDay: bool | None = None
    AdherentStatus: str | None = Field(default=None, min_length=1, max_length=20)
    Notes: str | None = None
    DailyCalorieTargetSnapshot: int | None = Field(default=None, ge=0)
    ProteinTargetSnapshot: float | None = Field(default=None, ge=0)
    StepTargetSnapshot: int | None = Field(default=None, ge=0)


class StepUpdateInput(BaseModel):
    Steps: int = Field(ge=0)
    StepKcalFactorOverride: float | None = Field(default=None, ge=0)
    WeightKg: float | None = Field(default=None, ge=20, le=500)


class UpdateDailyLogInput(BaseModel):
    Steps: int | None = Field(default=None, ge=0)
    StepKcalFactorOverride: float | None = Field(default=None, ge=0)
    WeightKg: float | None = Field(default=None, ge=20, le=500)
    OfficeMode: str | None = Field(default=None, min_length=1, max_length=20)
    WaterLitres: float | None = Field(default=None, ge=0, le=20)
    WalkingPadMinutes: int | None = Field(default=None, ge=0, le=1440)
    ExerciseNotes: str | None = Field(default=None, max_length=1000)
    SleepHours: float | None = Field(default=None, ge=0, le=24)
    Period: bool | None = None
    PeriodLabel: str | None = Field(default=None, min_length=1, max_length=40)
    HungerBeforeDinner: int | None = Field(default=None, ge=1, le=10)
    OverallSatisfaction: int | None = Field(default=None, ge=1, le=10)
    Takeaway: bool | None = None
    LoggedComplete: bool | None = None
    AdherentDay: bool | None = None
    AdherentStatus: str | None = Field(default=None, min_length=1, max_length=20)
    Notes: str | None = None
    DailyCalorieTargetSnapshot: int | None = Field(default=None, ge=0)
    ProteinTargetSnapshot: float | None = Field(default=None, ge=0)
    StepTargetSnapshot: int | None = Field(default=None, ge=0)


class CreateWorkoutInput(BaseModel):
    LogDate: str = Field(min_length=1)
    WorkoutType: str = Field(min_length=1, max_length=80)
    WorkoutName: str = Field(min_length=1, max_length=200)
    DurationMinutes: float | None = Field(default=None, gt=0, le=1440)
    CaloriesBurned: int = Field(default=0, ge=0, le=20000)
    DistanceKm: float | None = Field(default=None, ge=0, le=1000)
    StartedAt: datetime | None = None
    EndedAt: datetime | None = None
    Notes: str | None = Field(default=None, max_length=1000)


class CreateMealEntryInput(BaseModel):
    DailyLogId: str
    MealType: MealType
    FoodId: str | None = None
    MealTemplateId: str | None = None
    Quantity: float = Field(gt=0)
    PortionOptionId: str | None = None
    PortionLabel: str = Field(min_length=1)
    PortionBaseUnit: str = Field(min_length=1)
    PortionBaseAmount: float = Field(gt=0)
    EntryNotes: str | None = None
    SortOrder: int = 0
    ScheduleSlotId: str | None = None


class ShareMealEntryInput(BaseModel):
    LogDate: str = Field(min_length=1)
    TargetUserId: int = Field(gt=0)
    MealType: MealType
    FoodId: str | None = None
    MealTemplateId: str | None = None
    Quantity: float = Field(gt=0)
    PortionOptionId: str | None = None
    PortionLabel: str = Field(min_length=1)
    PortionBaseUnit: str = Field(min_length=1)
    PortionBaseAmount: float = Field(gt=0)
    EntryNotes: str | None = None
    ScheduleSlotId: str | None = None


class UpdateMealEntryInput(BaseModel):
    MealType: MealTypeValue | None = None
    Quantity: float = Field(gt=0)
    PortionOptionId: str | None = None
    PortionLabel: str = Field(min_length=1)
    PortionBaseUnit: str = Field(min_length=1)
    PortionBaseAmount: float = Field(gt=0)
    EntryNotes: str | None = None


class PortionOption(BaseModel):
    PortionOptionId: str | None = None
    FoodId: str | None = None
    Label: str
    BaseUnit: str
    BaseAmount: float
    Scope: str
    SortOrder: int = 0
    IsDefault: bool = False


class PortionOptionsResponse(BaseModel):
    BaseUnit: str
    Options: list[PortionOption]


class CreatePortionOptionInput(BaseModel):
    FoodId: str | None = None
    Label: str = Field(min_length=1)
    BaseUnit: str = Field(min_length=1)
    BaseAmount: float = Field(gt=0)
    IsDefault: bool = False
    SortOrder: int = 0


class ScheduleSlot(BaseModel):
    ScheduleSlotId: str
    SlotName: str
    SlotTime: str
    MealType: MealType
    SortOrder: int


class ScheduleSlotInput(BaseModel):
    ScheduleSlotId: str | None = None
    SlotName: str = Field(min_length=1)
    SlotTime: str = Field(min_length=1)
    MealType: MealType
    SortOrder: int = 0


class ScheduleSlotsResponse(BaseModel):
    Slots: list[ScheduleSlot]


class ScheduleSlotsUpdateInput(BaseModel):
    Slots: list[ScheduleSlotInput]


class MealTemplate(BaseModel):
    MealTemplateId: str
    TemplateName: str
    Servings: float
    IsFavourite: bool = False
    CreatedAt: datetime


class MealTemplateItem(BaseModel):
    MealTemplateItemId: str
    MealTemplateId: str
    FoodId: str
    MealType: MealType
    Quantity: float
    EntryQuantity: float | None = None
    EntryUnit: str | None = None
    EntryNotes: str | None = None
    SortOrder: int
    FoodName: str
    ServingDescription: str


class MealTemplateWithItems(BaseModel):
    Template: MealTemplate
    Items: list[MealTemplateItem]


class MealTemplateListResponse(BaseModel):
    Templates: list[MealTemplateWithItems]


class MealTextParseInput(BaseModel):
    Text: str = Field(min_length=1)
    KnownFoods: list[str] | None = None


class MealTextParseResponse(BaseModel):
    MealName: str
    ServingQuantity: float = 1.0
    ServingUnit: str = "serving"
    CaloriesPerServing: int
    ProteinPerServing: float
    FibrePerServing: float | None = None
    CarbsPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    SugarPerServing: float | None = None
    SodiumPerServing: float | None = None
    Summary: str


class ImageScanInput(BaseModel):
    ImageBase64: str = Field(min_length=1)
    Mode: ImageScanMode = ImageScanMode.Meal
    Note: str | None = Field(default=None, max_length=500)


class ImageScanResponse(BaseModel):
    FoodName: str
    ServingQuantity: float = 1.0
    ServingUnit: str = "serving"
    CaloriesPerServing: int
    ProteinPerServing: float
    FibrePerServing: float | None = None
    CarbsPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    SugarPerServing: float | None = None
    SodiumPerServing: float | None = None
    Summary: str
    Confidence: str
    Questions: list[str]


class MealTemplateItemInput(BaseModel):
    FoodId: str
    MealType: MealType
    Quantity: float = Field(gt=0)
    EntryQuantity: float | None = Field(default=None, gt=0)
    EntryUnit: str | None = Field(default=None, min_length=1)
    EntryNotes: str | None = None
    SortOrder: int = 0


class CreateMealTemplateInput(BaseModel):
    TemplateName: str = Field(min_length=1)
    Servings: float = Field(default=1.0, gt=0)
    IsFavourite: bool = False
    Items: list[MealTemplateItemInput]


class UpdateMealTemplateInput(BaseModel):
    TemplateName: str | None = Field(default=None, min_length=1)
    Servings: float | None = Field(default=None, gt=0)
    IsFavourite: bool | None = None
    Items: list[MealTemplateItemInput] | None = None


class ApplyMealTemplateInput(BaseModel):
    LogDate: str = Field(min_length=1)


class ApplyMealTemplateResponse(BaseModel):
    CreatedCount: int


class NutritionRecommendationResponse(BaseModel):
    DailyCalorieTarget: int
    ProteinTargetMin: float
    ProteinTargetMax: float
    FibreTarget: float | None = None
    CarbsTarget: float | None = None
    FatTarget: float | None = None
    SaturatedFatTarget: float | None = None
    SugarTarget: float | None = None
    SodiumTarget: float | None = None
    Explanation: str
    ModelUsed: str | None = None
    Goal: GoalSummary | None = None


class RecommendationLog(BaseModel):
    RecommendationLogId: int
    UserId: int
    CreatedAt: datetime
    Age: int
    HeightCm: float
    WeightKg: float
    ActivityLevel: str
    DailyCalorieTarget: int
    ProteinTargetMin: float
    ProteinTargetMax: float
    FibreTarget: float | None = None
    CarbsTarget: float | None = None
    FatTarget: float | None = None
    SaturatedFatTarget: float | None = None
    SugarTarget: float | None = None
    SodiumTarget: float | None = None
    Explanation: str


class RecommendationLogListResponse(BaseModel):
    Logs: list[RecommendationLog]


class RecipeReview(BaseModel):
    RecipeReviewId: str
    RecipeName: str
    LogDate: date
    MealEntryId: str | None = None
    Rating: float | None = None
    WouldMakeAgain: str | None = None
    HallOfFameOverride: str | None = None
    Notes: str | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class CreateRecipeReviewInput(BaseModel):
    RecipeName: str = Field(min_length=1, max_length=200)
    LogDate: str = Field(min_length=1)
    MealEntryId: str | None = None
    Rating: float | None = Field(default=None, ge=0, le=10)
    WouldMakeAgain: str | None = Field(default=None, min_length=1, max_length=20)
    HallOfFameOverride: str | None = Field(default=None, min_length=1, max_length=20)
    Notes: str | None = None


class UpdateRecipeReviewInput(BaseModel):
    RecipeName: str | None = Field(default=None, min_length=1, max_length=200)
    LogDate: str | None = Field(default=None, min_length=1)
    MealEntryId: str | None = None
    Rating: float | None = Field(default=None, ge=0, le=10)
    WouldMakeAgain: str | None = Field(default=None, min_length=1, max_length=20)
    HallOfFameOverride: str | None = Field(default=None, min_length=1, max_length=20)
    Notes: str | None = None


class RecipeReviewListResponse(BaseModel):
    Items: list[RecipeReview]


class RecipeStat(BaseModel):
    RecipeName: str
    TimesEaten: int
    AverageRating: float | None = None
    AverageCalories: float | None = None
    AverageProtein: float | None = None
    HallOfFame: bool = False
    Notes: str | None = None
    LatestLogDate: date | None = None


class RecipeStatsResponse(BaseModel):
    Items: list[RecipeStat]


class ProductReview(BaseModel):
    ProductReviewId: str
    FoodId: str | None = None
    ProductName: str
    Brand: str | None = None
    Category: str | None = None
    BuyAgain: str | None = None
    Rating: float | None = None
    CaloriesPerServing: int | None = None
    ProteinPerServing: float | None = None
    Notes: str | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class UpsertProductReviewInput(BaseModel):
    FoodId: str | None = None
    ProductName: str = Field(min_length=1, max_length=200)
    Brand: str | None = Field(default=None, max_length=120)
    Category: str | None = Field(default=None, max_length=120)
    BuyAgain: str | None = Field(default=None, min_length=1, max_length=20)
    Rating: float | None = Field(default=None, ge=0, le=10)
    CaloriesPerServing: int | None = Field(default=None, ge=0)
    ProteinPerServing: float | None = Field(default=None, ge=0)
    Notes: str | None = None


class ProductReviewListResponse(BaseModel):
    Items: list[ProductReview]


class Experiment(BaseModel):
    ExperimentId: str
    StartDate: date
    EndDate: date | None = None
    VariableChanged: str
    Reason: str | None = None
    ExpectedOutcome: str | None = None
    ActualOutcome: str | None = None
    Decision: str | None = None
    Status: str
    DurationDays: int | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class UpsertExperimentInput(BaseModel):
    ExperimentId: str | None = None
    StartDate: str = Field(min_length=1)
    EndDate: str | None = None
    VariableChanged: str = Field(min_length=1, max_length=200)
    Reason: str | None = None
    ExpectedOutcome: str | None = None
    ActualOutcome: str | None = None
    Decision: str | None = Field(default=None, min_length=1, max_length=40)
    Status: str = Field(default="In progress", min_length=1, max_length=40)


class ExperimentListResponse(BaseModel):
    Items: list[Experiment]


class BodyMeasurement(BaseModel):
    BodyMeasurementId: str
    LogDate: date
    WaistCm: float | None = None
    HipsCm: float | None = None
    RestingHeartRate: int | None = None
    PeriodCycleNotes: str | None = None
    Notes: str | None = None
    WeightKg: float | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class UpsertBodyMeasurementInput(BaseModel):
    LogDate: str = Field(min_length=1)
    WaistCm: float | None = Field(default=None, ge=0, le=500)
    HipsCm: float | None = Field(default=None, ge=0, le=500)
    RestingHeartRate: int | None = Field(default=None, ge=0, le=300)
    PeriodCycleNotes: str | None = None
    Notes: str | None = None


class BodyMeasurementListResponse(BaseModel):
    Items: list[BodyMeasurement]


class WeeklyReviewNote(BaseModel):
    WeeklyReviewNoteId: str
    WeekStart: date
    BiggestNutritionWin: str | None = None
    ImprovementForNextWeek: str | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class UpsertWeeklyReviewNoteInput(BaseModel):
    WeekStart: str = Field(min_length=1)
    BiggestNutritionWin: str | None = None
    ImprovementForNextWeek: str | None = None


class WeeklyReviewSnapshot(BaseModel):
    WeekStart: date
    WeekEnd: date
    AverageCalories: float | None = None
    AverageProtein: float | None = None
    AverageCarbs: float | None = None
    AverageFat: float | None = None
    AverageFibre: float | None = None
    AverageSteps: float | None = None
    AverageSleep: float | None = None
    WeightChange: float | None = None
    AdherenceRatio: float | None = None
    BestMeal: str | None = None
    WorstMeal: str | None = None
    HighestRatedRecipe: str | None = None
    FridayTakeaway: bool | None = None
    Note: WeeklyReviewNote | None = None


class Insight(BaseModel):
    InsightId: str
    InsightType: str
    PeriodType: str
    PeriodStart: date
    PeriodEnd: date | None = None
    Title: str
    Summary: str | None = None
    Confidence: str | None = None
    Status: str
    Source: str
    SchemaVersion: int = 1
    Payload: dict | None = None
    Tags: list[str] = Field(default_factory=list)
    CreatedAt: datetime | None = None
    UpdatedAt: datetime | None = None


class UpsertInsightInput(BaseModel):
    InsightId: str | None = None
    InsightType: str = Field(min_length=1, max_length=80)
    PeriodType: str = Field(min_length=1, max_length=20)
    PeriodStart: date
    PeriodEnd: date | None = None
    Title: str = Field(min_length=1, max_length=200)
    Summary: str | None = None
    Confidence: str | None = Field(default=None, max_length=20)
    Status: str = Field(default="active", min_length=1, max_length=20)
    Source: str = Field(default="manual", min_length=1, max_length=40)
    SchemaVersion: int = Field(default=1, ge=1, le=1000)
    Payload: dict | None = None
    Tags: list[str] = Field(default_factory=list)


class InsightListResponse(BaseModel):
    Items: list[Insight]


class HealthReminderRunRequest(BaseModel):
    RunDate: date | None = None
    RunTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class HealthReminderRunResponse(BaseModel):
    EligibleUsers: int
    ProcessedUsers: int
    NotificationsSent: int
    Skipped: int
    Errors: int
