"""add per-slot food reminder settings

Revision ID: 0051_health_food_reminder_slots
Revises: 0050_health_log_reminders
Create Date: 2026-01-27
"""

from alembic import op
import sqlalchemy as sa

revision = "0051_health_food_reminder_slots"
down_revision = "0050_health_log_reminders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column("FoodReminderSlots", sa.Text(), nullable=True),
        schema="health",
    )


def downgrade() -> None:
    op.drop_column("settings", "FoodReminderSlots", schema="health")

