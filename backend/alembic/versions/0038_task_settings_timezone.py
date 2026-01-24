"""add task settings timezone

Revision ID: 0038_task_settings_timezone
Revises: 0037_google_task_overdue_notifications
Create Date: 2026-01-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0038_task_settings_timezone"
down_revision = "0037_google_task_overdue_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_settings",
        sa.Column("OverdueReminderTimeZone", sa.String(length=64), nullable=True),
        schema="tasks",
    )


def downgrade() -> None:
    op.drop_column("task_settings", "OverdueReminderTimeZone", schema="tasks")
