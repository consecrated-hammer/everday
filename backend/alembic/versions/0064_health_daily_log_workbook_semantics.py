"""add workbook-semantic daily log fields

Revision ID: 0064_health_daily_log_workbook_semantics
Revises: 0063_health_daily_log_metadata
Create Date: 2026-07-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0064_health_daily_log_workbook_semantics"
down_revision = "0063_health_daily_log_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("daily_logs", sa.Column("PeriodLabel", sa.String(length=40), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("AdherentStatus", sa.String(length=20), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("DailyCalorieTargetSnapshot", sa.Integer(), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("ProteinTargetSnapshot", sa.Numeric(10, 2), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("StepTargetSnapshot", sa.Integer(), nullable=True), schema="health")


def downgrade() -> None:
    op.drop_column("daily_logs", "StepTargetSnapshot", schema="health")
    op.drop_column("daily_logs", "ProteinTargetSnapshot", schema="health")
    op.drop_column("daily_logs", "DailyCalorieTargetSnapshot", schema="health")
    op.drop_column("daily_logs", "AdherentStatus", schema="health")
    op.drop_column("daily_logs", "PeriodLabel", schema="health")
