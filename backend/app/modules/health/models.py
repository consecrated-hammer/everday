from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)

from app.db import Base


class Food(Base):
    __tablename__ = "foods"
    __table_args__ = (
        UniqueConstraint("OwnerUserId", "FoodName", name="uq_health_foods_owner_name"),
        {"schema": "health"},
    )

    FoodId = Column(String(36), primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    FoodName = Column(String(200), nullable=False)
    ServingDescription = Column(String(200), nullable=False)
    ServingQuantity = Column(Numeric(10, 2), nullable=False, default=1)
    ServingUnit = Column(String(40), nullable=False, default="serving")
    CaloriesPerServing = Column(Integer, nullable=False)
    ProteinPerServing = Column(Numeric(10, 2), nullable=False)
    FibrePerServing = Column(Numeric(10, 2))
    CarbsPerServing = Column(Numeric(10, 2))
    FatPerServing = Column(Numeric(10, 2))
    SaturatedFatPerServing = Column(Numeric(10, 2))
    SugarPerServing = Column(Numeric(10, 2))
    SodiumPerServing = Column(Numeric(10, 2))
    DataSource = Column(String(40), nullable=False, default="manual")
    CountryCode = Column(String(8), nullable=False, default="AU")
    IsFavourite = Column(Boolean, nullable=False, default=False)
    ImageUrl = Column(String(500))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Settings(Base):
    __tablename__ = "settings"
    __table_args__ = (
        UniqueConstraint("UserId", name="uq_health_settings_user"),
        {"schema": "health"},
    )

    SettingsId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    DailyCalorieTarget = Column(Integer, nullable=False)
    ProteinTargetMin = Column(Numeric(10, 2), nullable=False)
    ProteinTargetMax = Column(Numeric(10, 2), nullable=False)
    StepKcalFactor = Column(Numeric(10, 4), nullable=False)
    StepTarget = Column(Integer, nullable=False)
    FibreTarget = Column(Numeric(10, 2))
    CarbsTarget = Column(Numeric(10, 2))
    FatTarget = Column(Numeric(10, 2))
    SaturatedFatTarget = Column(Numeric(10, 2))
    SugarTarget = Column(Numeric(10, 2))
    SodiumTarget = Column(Numeric(10, 2))
    ShowProteinOnToday = Column(Boolean, nullable=False, default=True)
    ShowStepsOnToday = Column(Boolean, nullable=False, default=True)
    ShowFibreOnToday = Column(Boolean, nullable=False, default=False)
    ShowCarbsOnToday = Column(Boolean, nullable=False, default=False)
    ShowFatOnToday = Column(Boolean, nullable=False, default=False)
    ShowSaturatedFatOnToday = Column(Boolean, nullable=False, default=False)
    ShowSugarOnToday = Column(Boolean, nullable=False, default=False)
    ShowSodiumOnToday = Column(Boolean, nullable=False, default=False)
    TodayLayout = Column(Text, nullable=False)
    BarOrder = Column(Text, nullable=False)
    AutoTuneTargetsWeekly = Column(Boolean, nullable=False, default=False)
    LastAutoTuneAt = Column(DateTime(timezone=True))
    ShowWeightChartOnToday = Column(Boolean, nullable=False, default=True)
    ShowStepsChartOnToday = Column(Boolean, nullable=False, default=True)
    ShowWeightProjectionOnToday = Column(Boolean, nullable=False, default=True)
    GoalType = Column(String(20))
    GoalBmiMin = Column(Numeric(5, 2))
    GoalBmiMax = Column(Numeric(5, 2))
    GoalTargetBmi = Column(Numeric(5, 2))
    GoalStartDate = Column(Date)
    GoalEndDate = Column(Date)
    GoalSetAt = Column(DateTime(timezone=True))
    GoalUpdatedAt = Column(DateTime(timezone=True))
    GoalCompletedAt = Column(DateTime(timezone=True))
    GoalCompletionNotifiedAt = Column(DateTime(timezone=True))
    HaeApiKeyHash = Column(Text)
    HaeApiKeyLast4 = Column(String(8))
    HaeApiKeyCreatedAt = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class DailyLog(Base):
    __tablename__ = "daily_logs"
    __table_args__ = (
        UniqueConstraint("UserId", "LogDate", name="uq_health_daily_logs_user_date"),
        {"schema": "health"},
    )

    DailyLogId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    LogDate = Column(Date, nullable=False, index=True)
    Steps = Column(Integer, nullable=False, default=0)
    StepKcalFactorOverride = Column(Numeric(10, 4))
    WeightKg = Column(Numeric(6, 2))
    StepsUpdatedAt = Column(DateTime(timezone=True))
    WeightUpdatedAt = Column(DateTime(timezone=True))
    StepsSource = Column(String(20))
    WeightSource = Column(String(20))
    Notes = Column(Text)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class MealEntry(Base):
    __tablename__ = "meal_entries"
    __table_args__ = {"schema": "health"}

    MealEntryId = Column(String(36), primary_key=True, index=True)
    DailyLogId = Column(String(36), nullable=False, index=True)
    MealType = Column(String(30), nullable=False, index=True)
    FoodId = Column(String(36), index=True)
    MealTemplateId = Column(String(36), index=True)
    Quantity = Column(Numeric(10, 4), nullable=False)
    DisplayQuantity = Column(Numeric(10, 4))
    PortionOptionId = Column(String(36))
    PortionLabel = Column(String(80))
    PortionBaseUnit = Column(String(10))
    PortionBaseAmount = Column(Numeric(10, 4))
    PortionBaseTotal = Column(Numeric(10, 4))
    EntryNotes = Column(Text)
    SortOrder = Column(Integer, nullable=False, default=0)
    ScheduleSlotId = Column(String(36))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class PortionOption(Base):
    __tablename__ = "portion_options"
    __table_args__ = {"schema": "health"}

    PortionOptionId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    FoodId = Column(String(36), index=True)
    Label = Column(String(80), nullable=False)
    BaseUnit = Column(String(10), nullable=False)
    BaseAmount = Column(Numeric(10, 4), nullable=False)
    Scope = Column(String(20), nullable=False)
    SortOrder = Column(Integer, nullable=False, default=0)
    IsDefault = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class MealTemplate(Base):
    __tablename__ = "meal_templates"
    __table_args__ = (
        UniqueConstraint("UserId", "TemplateName", name="uq_health_templates_user_name"),
        {"schema": "health"},
    )

    MealTemplateId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    TemplateName = Column(String(200), nullable=False)
    Servings = Column(Numeric(10, 2), nullable=False, default=1)
    IsFavourite = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class MealTemplateItem(Base):
    __tablename__ = "meal_template_items"
    __table_args__ = {"schema": "health"}

    MealTemplateItemId = Column(String(36), primary_key=True, index=True)
    MealTemplateId = Column(String(36), nullable=False, index=True)
    FoodId = Column(String(36), nullable=False, index=True)
    MealType = Column(String(30), nullable=False)
    Quantity = Column(Numeric(10, 4), nullable=False)
    EntryQuantity = Column(Numeric(10, 4))
    EntryUnit = Column(String(40))
    EntryNotes = Column(Text)
    SortOrder = Column(Integer, nullable=False, default=0)


class ScheduleSlot(Base):
    __tablename__ = "schedule_slots"
    __table_args__ = {"schema": "health"}

    ScheduleSlotId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    SlotName = Column(String(120), nullable=False)
    SlotTime = Column(String(10), nullable=False)
    MealType = Column(String(30), nullable=False)
    SortOrder = Column(Integer, nullable=False, default=0)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"
    __table_args__ = {"schema": "health"}

    RecommendationLogId = Column(Integer, primary_key=True, index=True, autoincrement=True)
    UserId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    Age = Column(Integer, nullable=False)
    HeightCm = Column(Numeric(6, 2), nullable=False)
    WeightKg = Column(Numeric(6, 2), nullable=False)
    ActivityLevel = Column(String(40), nullable=False)
    DailyCalorieTarget = Column(Integer, nullable=False)
    ProteinTargetMin = Column(Numeric(10, 2), nullable=False)
    ProteinTargetMax = Column(Numeric(10, 2), nullable=False)
    FibreTarget = Column(Numeric(10, 2))
    CarbsTarget = Column(Numeric(10, 2))
    FatTarget = Column(Numeric(10, 2))
    SaturatedFatTarget = Column(Numeric(10, 2))
    SugarTarget = Column(Numeric(10, 2))
    SodiumTarget = Column(Numeric(10, 2))
    Explanation = Column(Text, nullable=False)


class ImportLog(Base):
    __tablename__ = "import_logs"
    __table_args__ = {"schema": "health"}

    ImportLogId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    Source = Column(String(40), nullable=False)
    Payload = Column(Text, nullable=False)
    MetricsCount = Column(Integer, nullable=False, default=0)
    WorkoutsCount = Column(Integer, nullable=False, default=0)
    ImportedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class MetricEntry(Base):
    __tablename__ = "metric_entries"
    __table_args__ = {"schema": "health"}

    MetricEntryId = Column(String(36), primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    LogDate = Column(Date, nullable=False, index=True)
    MetricType = Column(String(20), nullable=False, index=True)
    Value = Column(Numeric(12, 2), nullable=False)
    OccurredAt = Column(DateTime(timezone=True), nullable=False)
    Source = Column(String(20), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
