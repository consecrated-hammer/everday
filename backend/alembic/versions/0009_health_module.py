"""create health module tables

Revision ID: 0009_health_module
Revises: 0008_fix_identity_defaults
Create Date: 2026-01-05 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_health_module"
down_revision = "0008_fix_identity_defaults"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("BirthDate", sa.Date(), nullable=True), schema="auth")
    op.add_column("users", sa.Column("HeightCm", sa.Integer(), nullable=True), schema="auth")
    op.add_column("users", sa.Column("WeightKg", sa.Numeric(6, 2), nullable=True), schema="auth")
    op.add_column("users", sa.Column("ActivityLevel", sa.String(length=40), nullable=True), schema="auth")

    op.create_table(
        "foods",
        sa.Column("FoodId", sa.String(length=36), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("FoodName", sa.String(length=200), nullable=False),
        sa.Column("ServingDescription", sa.String(length=200), nullable=False),
        sa.Column("ServingQuantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("ServingUnit", sa.String(length=40), nullable=False),
        sa.Column("CaloriesPerServing", sa.Integer(), nullable=False),
        sa.Column("ProteinPerServing", sa.Numeric(10, 2), nullable=False),
        sa.Column("FibrePerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("CarbsPerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("FatPerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("SaturatedFatPerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("SugarPerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("SodiumPerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("DataSource", sa.String(length=40), nullable=False, server_default=sa.text("'manual'")),
        sa.Column("CountryCode", sa.String(length=8), nullable=False, server_default=sa.text("'AU'")),
        sa.Column("IsFavourite", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("OwnerUserId", "FoodName", name="uq_health_foods_owner_name"),
        schema="health",
    )
    op.create_index(
        "ix_health_foods_owner_user_id",
        "foods",
        ["OwnerUserId"],
        schema="health",
    )

    op.create_table(
        "settings",
        sa.Column("SettingsId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("DailyCalorieTarget", sa.Integer(), nullable=False),
        sa.Column("ProteinTargetMin", sa.Numeric(10, 2), nullable=False),
        sa.Column("ProteinTargetMax", sa.Numeric(10, 2), nullable=False),
        sa.Column("StepKcalFactor", sa.Numeric(10, 4), nullable=False),
        sa.Column("StepTarget", sa.Integer(), nullable=False),
        sa.Column("FibreTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("CarbsTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("FatTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("SaturatedFatTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("SugarTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("SodiumTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("ShowProteinOnToday", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("ShowStepsOnToday", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("ShowFibreOnToday", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("ShowCarbsOnToday", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("ShowFatOnToday", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("ShowSaturatedFatOnToday", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("ShowSugarOnToday", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("ShowSodiumOnToday", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("TodayLayout", sa.Text(), nullable=False),
        sa.Column("BarOrder", sa.Text(), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("UserId", name="uq_health_settings_user"),
        schema="health",
    )
    op.create_index(
        "ix_health_settings_user_id",
        "settings",
        ["UserId"],
        schema="health",
    )

    op.create_table(
        "daily_logs",
        sa.Column("DailyLogId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("LogDate", sa.Date(), nullable=False),
        sa.Column("Steps", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("StepKcalFactorOverride", sa.Numeric(10, 4), nullable=True),
        sa.Column("WeightKg", sa.Numeric(6, 2), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("UserId", "LogDate", name="uq_health_daily_logs_user_date"),
        schema="health",
    )
    op.create_index(
        "ix_health_daily_logs_user_id",
        "daily_logs",
        ["UserId"],
        schema="health",
    )
    op.create_index(
        "ix_health_daily_logs_log_date",
        "daily_logs",
        ["LogDate"],
        schema="health",
    )

    op.create_table(
        "meal_entries",
        sa.Column("MealEntryId", sa.String(length=36), primary_key=True),
        sa.Column("DailyLogId", sa.String(length=36), nullable=False),
        sa.Column("MealType", sa.String(length=30), nullable=False),
        sa.Column("FoodId", sa.String(length=36), nullable=True),
        sa.Column("MealTemplateId", sa.String(length=36), nullable=True),
        sa.Column("Quantity", sa.Numeric(10, 4), nullable=False),
        sa.Column("EntryQuantity", sa.Numeric(10, 4), nullable=True),
        sa.Column("EntryUnit", sa.String(length=40), nullable=True),
        sa.Column("ConversionDetail", sa.Text(), nullable=True),
        sa.Column("EntryNotes", sa.Text(), nullable=True),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ScheduleSlotId", sa.String(length=36), nullable=True),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="health",
    )
    op.create_index(
        "ix_health_meal_entries_daily_log_id",
        "meal_entries",
        ["DailyLogId"],
        schema="health",
    )
    op.create_index(
        "ix_health_meal_entries_food_id",
        "meal_entries",
        ["FoodId"],
        schema="health",
    )
    op.create_index(
        "ix_health_meal_entries_meal_template_id",
        "meal_entries",
        ["MealTemplateId"],
        schema="health",
    )

    op.create_table(
        "meal_templates",
        sa.Column("MealTemplateId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("TemplateName", sa.String(length=200), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("UserId", "TemplateName", name="uq_health_templates_user_name"),
        schema="health",
    )
    op.create_index(
        "ix_health_meal_templates_user_id",
        "meal_templates",
        ["UserId"],
        schema="health",
    )

    op.create_table(
        "meal_template_items",
        sa.Column("MealTemplateItemId", sa.String(length=36), primary_key=True),
        sa.Column("MealTemplateId", sa.String(length=36), nullable=False),
        sa.Column("FoodId", sa.String(length=36), nullable=False),
        sa.Column("MealType", sa.String(length=30), nullable=False),
        sa.Column("Quantity", sa.Numeric(10, 4), nullable=False),
        sa.Column("EntryQuantity", sa.Numeric(10, 4), nullable=True),
        sa.Column("EntryUnit", sa.String(length=40), nullable=True),
        sa.Column("EntryNotes", sa.Text(), nullable=True),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        schema="health",
    )
    op.create_index(
        "ix_health_meal_template_items_template_id",
        "meal_template_items",
        ["MealTemplateId"],
        schema="health",
    )
    op.create_index(
        "ix_health_meal_template_items_food_id",
        "meal_template_items",
        ["FoodId"],
        schema="health",
    )

    op.create_table(
        "schedule_slots",
        sa.Column("ScheduleSlotId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("SlotName", sa.String(length=120), nullable=False),
        sa.Column("SlotTime", sa.String(length=10), nullable=False),
        sa.Column("MealType", sa.String(length=30), nullable=False),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="health",
    )
    op.create_index(
        "ix_health_schedule_slots_user_id",
        "schedule_slots",
        ["UserId"],
        schema="health",
    )

    op.create_table(
        "recommendation_logs",
        sa.Column("RecommendationLogId", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column("Age", sa.Integer(), nullable=False),
        sa.Column("HeightCm", sa.Numeric(6, 2), nullable=False),
        sa.Column("WeightKg", sa.Numeric(6, 2), nullable=False),
        sa.Column("ActivityLevel", sa.String(length=40), nullable=False),
        sa.Column("DailyCalorieTarget", sa.Integer(), nullable=False),
        sa.Column("ProteinTargetMin", sa.Numeric(10, 2), nullable=False),
        sa.Column("ProteinTargetMax", sa.Numeric(10, 2), nullable=False),
        sa.Column("FibreTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("CarbsTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("FatTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("SaturatedFatTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("SugarTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("SodiumTarget", sa.Numeric(10, 2), nullable=True),
        sa.Column("Explanation", sa.Text(), nullable=False),
        schema="health",
    )
    op.create_index(
        "ix_health_recommendation_logs_user_id",
        "recommendation_logs",
        ["UserId"],
        schema="health",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_health_recommendation_logs_user_id",
        table_name="recommendation_logs",
        schema="health",
    )
    op.drop_table("recommendation_logs", schema="health")

    op.drop_index("ix_health_schedule_slots_user_id", table_name="schedule_slots", schema="health")
    op.drop_table("schedule_slots", schema="health")

    op.drop_index(
        "ix_health_meal_template_items_food_id",
        table_name="meal_template_items",
        schema="health",
    )
    op.drop_index(
        "ix_health_meal_template_items_template_id",
        table_name="meal_template_items",
        schema="health",
    )
    op.drop_table("meal_template_items", schema="health")

    op.drop_index("ix_health_meal_templates_user_id", table_name="meal_templates", schema="health")
    op.drop_table("meal_templates", schema="health")

    op.drop_index("ix_health_meal_entries_meal_template_id", table_name="meal_entries", schema="health")
    op.drop_index("ix_health_meal_entries_food_id", table_name="meal_entries", schema="health")
    op.drop_index("ix_health_meal_entries_daily_log_id", table_name="meal_entries", schema="health")
    op.drop_table("meal_entries", schema="health")

    op.drop_index("ix_health_daily_logs_log_date", table_name="daily_logs", schema="health")
    op.drop_index("ix_health_daily_logs_user_id", table_name="daily_logs", schema="health")
    op.drop_table("daily_logs", schema="health")

    op.drop_index("ix_health_settings_user_id", table_name="settings", schema="health")
    op.drop_table("settings", schema="health")

    op.drop_index("ix_health_foods_owner_user_id", table_name="foods", schema="health")
    op.drop_table("foods", schema="health")

    op.drop_column("users", "ActivityLevel", schema="auth")
    op.drop_column("users", "WeightKg", schema="auth")
    op.drop_column("users", "HeightCm", schema="auth")
    op.drop_column("users", "BirthDate", schema="auth")
