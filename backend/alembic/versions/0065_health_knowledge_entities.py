"""add health knowledge entities for reviews experiments and measurements

Revision ID: 0065_health_knowledge_entities
Revises: 0064_health_daily_log_workbook_semantics
Create Date: 2026-07-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0065_health_knowledge_entities"
down_revision = "0064_health_daily_log_workbook_semantics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_reviews",
        sa.Column("RecipeReviewId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("RecipeName", sa.String(length=200), nullable=False),
        sa.Column("LogDate", sa.Date(), nullable=False),
        sa.Column("MealEntryId", sa.String(length=36), nullable=True),
        sa.Column("Rating", sa.Numeric(4, 1), nullable=True),
        sa.Column("WouldMakeAgain", sa.String(length=20), nullable=True),
        sa.Column("HallOfFameOverride", sa.String(length=20), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("RecipeReviewId"),
        sa.UniqueConstraint("UserId", "RecipeName", "LogDate", name="uq_health_recipe_reviews_user_recipe_date"),
        schema="health",
    )
    op.create_index("ix_health_recipe_reviews_user_id", "recipe_reviews", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_recipe_reviews_recipe_name", "recipe_reviews", ["RecipeName"], unique=False, schema="health")
    op.create_index("ix_health_recipe_reviews_log_date", "recipe_reviews", ["LogDate"], unique=False, schema="health")

    op.create_table(
        "product_reviews",
        sa.Column("ProductReviewId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("FoodId", sa.String(length=36), nullable=True),
        sa.Column("ProductName", sa.String(length=200), nullable=False),
        sa.Column("Brand", sa.String(length=120), nullable=True),
        sa.Column("Category", sa.String(length=120), nullable=True),
        sa.Column("BuyAgain", sa.String(length=20), nullable=True),
        sa.Column("Rating", sa.Numeric(4, 1), nullable=True),
        sa.Column("CaloriesPerServing", sa.Integer(), nullable=True),
        sa.Column("ProteinPerServing", sa.Numeric(10, 2), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("ProductReviewId"),
        sa.UniqueConstraint("UserId", "ProductName", "Brand", name="uq_health_product_reviews_user_product_brand"),
        schema="health",
    )
    op.create_index("ix_health_product_reviews_user_id", "product_reviews", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_product_reviews_product_name", "product_reviews", ["ProductName"], unique=False, schema="health")

    op.create_table(
        "experiments",
        sa.Column("ExperimentId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("StartDate", sa.Date(), nullable=False),
        sa.Column("EndDate", sa.Date(), nullable=True),
        sa.Column("VariableChanged", sa.String(length=200), nullable=False),
        sa.Column("Reason", sa.Text(), nullable=True),
        sa.Column("ExpectedOutcome", sa.Text(), nullable=True),
        sa.Column("ActualOutcome", sa.Text(), nullable=True),
        sa.Column("Decision", sa.String(length=40), nullable=True),
        sa.Column("Status", sa.String(length=40), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("ExperimentId"),
        schema="health",
    )
    op.create_index("ix_health_experiments_user_id", "experiments", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_experiments_start_date", "experiments", ["StartDate"], unique=False, schema="health")

    op.create_table(
        "body_measurements",
        sa.Column("BodyMeasurementId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("LogDate", sa.Date(), nullable=False),
        sa.Column("WaistCm", sa.Numeric(6, 2), nullable=True),
        sa.Column("HipsCm", sa.Numeric(6, 2), nullable=True),
        sa.Column("RestingHeartRate", sa.Integer(), nullable=True),
        sa.Column("PeriodCycleNotes", sa.Text(), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("BodyMeasurementId"),
        sa.UniqueConstraint("UserId", "LogDate", name="uq_health_body_measurements_user_date"),
        schema="health",
    )
    op.create_index("ix_health_body_measurements_user_id", "body_measurements", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_body_measurements_log_date", "body_measurements", ["LogDate"], unique=False, schema="health")

    op.create_table(
        "weekly_review_notes",
        sa.Column("WeeklyReviewNoteId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("WeekStart", sa.Date(), nullable=False),
        sa.Column("BiggestNutritionWin", sa.Text(), nullable=True),
        sa.Column("ImprovementForNextWeek", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("WeeklyReviewNoteId"),
        sa.UniqueConstraint("UserId", "WeekStart", name="uq_health_weekly_review_notes_user_week"),
        schema="health",
    )
    op.create_index("ix_health_weekly_review_notes_user_id", "weekly_review_notes", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_weekly_review_notes_week_start", "weekly_review_notes", ["WeekStart"], unique=False, schema="health")


def downgrade() -> None:
    op.drop_index("ix_health_weekly_review_notes_week_start", table_name="weekly_review_notes", schema="health")
    op.drop_index("ix_health_weekly_review_notes_user_id", table_name="weekly_review_notes", schema="health")
    op.drop_table("weekly_review_notes", schema="health")

    op.drop_index("ix_health_body_measurements_log_date", table_name="body_measurements", schema="health")
    op.drop_index("ix_health_body_measurements_user_id", table_name="body_measurements", schema="health")
    op.drop_table("body_measurements", schema="health")

    op.drop_index("ix_health_experiments_start_date", table_name="experiments", schema="health")
    op.drop_index("ix_health_experiments_user_id", table_name="experiments", schema="health")
    op.drop_table("experiments", schema="health")

    op.drop_index("ix_health_product_reviews_product_name", table_name="product_reviews", schema="health")
    op.drop_index("ix_health_product_reviews_user_id", table_name="product_reviews", schema="health")
    op.drop_table("product_reviews", schema="health")

    op.drop_index("ix_health_recipe_reviews_log_date", table_name="recipe_reviews", schema="health")
    op.drop_index("ix_health_recipe_reviews_recipe_name", table_name="recipe_reviews", schema="health")
    op.drop_index("ix_health_recipe_reviews_user_id", table_name="recipe_reviews", schema="health")
    op.drop_table("recipe_reviews", schema="health")
