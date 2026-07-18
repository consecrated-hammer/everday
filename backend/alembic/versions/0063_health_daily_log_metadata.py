"""add daily log metadata fields

Revision ID: 0063_health_daily_log_metadata
Revises: 0062_health_workouts
Create Date: 2026-07-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0063_health_daily_log_metadata"
down_revision = "0062_health_workouts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("daily_logs", sa.Column("OfficeMode", sa.String(length=20), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("WaterLitres", sa.Numeric(6, 2), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("WalkingPadMinutes", sa.Integer(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("ExerciseNotes", sa.Text(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("SleepHours", sa.Numeric(4, 2), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("Period", sa.Boolean(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("HungerBeforeDinner", sa.Integer(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("OverallSatisfaction", sa.Integer(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("Takeaway", sa.Boolean(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("LoggedComplete", sa.Boolean(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("AdherentDay", sa.Boolean(), nullable=True), schema="health")


def downgrade() -> None:
    op.drop_column("daily_logs", "AdherentDay", schema="health")
    op.drop_column("daily_logs", "LoggedComplete", schema="health")
    op.drop_column("daily_logs", "Takeaway", schema="health")
    op.drop_column("daily_logs", "OverallSatisfaction", schema="health")
    op.drop_column("daily_logs", "HungerBeforeDinner", schema="health")
    op.drop_column("daily_logs", "Period", schema="health")
    op.drop_column("daily_logs", "SleepHours", schema="health")
    op.drop_column("daily_logs", "ExerciseNotes", schema="health")
    op.drop_column("daily_logs", "WalkingPadMinutes", schema="health")
    op.drop_column("daily_logs", "WaterLitres", schema="health")
    op.drop_column("daily_logs", "OfficeMode", schema="health")
