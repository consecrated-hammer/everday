"""Add goal settings fields to health settings.

Revision ID: 0024_health_goal_settings
Revises: 0023_notifications
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0024_health_goal_settings"
down_revision = "0023_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column("GoalType", sa.String(length=20), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalBmiMin", sa.Numeric(5, 2), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalBmiMax", sa.Numeric(5, 2), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalStartDate", sa.Date(), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalEndDate", sa.Date(), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalSetAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalUpdatedAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalCompletedAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("GoalCompletionNotifiedAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )


def downgrade() -> None:
    op.drop_column("settings", "GoalCompletionNotifiedAt", schema="health")
    op.drop_column("settings", "GoalCompletedAt", schema="health")
    op.drop_column("settings", "GoalUpdatedAt", schema="health")
    op.drop_column("settings", "GoalSetAt", schema="health")
    op.drop_column("settings", "GoalEndDate", schema="health")
    op.drop_column("settings", "GoalStartDate", schema="health")
    op.drop_column("settings", "GoalBmiMax", schema="health")
    op.drop_column("settings", "GoalBmiMin", schema="health")
    op.drop_column("settings", "GoalType", schema="health")
