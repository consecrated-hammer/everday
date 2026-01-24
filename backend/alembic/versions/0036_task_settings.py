"""create task settings table

Revision ID: 0036_task_settings
Revises: 0035_google_task_shares
Create Date: 2026-01-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0036_task_settings"
down_revision = "0035_google_task_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_settings",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("OverdueReminderTime", sa.String(length=5)),
        sa.Column("OverdueLastNotifiedDate", sa.Date()),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column(
            "UpdatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("UserId", name="uq_tasks_settings_user_id"),
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_settings_user_id",
        "task_settings",
        ["UserId"],
        schema="tasks",
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_task_settings_user_id", table_name="task_settings", schema="tasks")
    op.drop_table("task_settings", schema="tasks")
