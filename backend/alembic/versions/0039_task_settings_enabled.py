"""add task settings enabled flag

Revision ID: 0039_task_settings_enabled
Revises: 0038_task_settings_timezone
Create Date: 2026-01-25
"""

from alembic import op
import sqlalchemy as sa

revision = "0039_task_settings_enabled"
down_revision = "0038_task_settings_timezone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_settings",
        sa.Column(
            "OverdueRemindersEnabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        schema="tasks",
    )


def downgrade() -> None:
    op.drop_column("task_settings", "OverdueRemindersEnabled", schema="tasks")
