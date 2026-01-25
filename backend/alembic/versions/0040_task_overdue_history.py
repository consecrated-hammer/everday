"""create task overdue notification run history

Revision ID: 0040_task_overdue_history
Revises: 0039_task_settings_enabled
Create Date: 2026-01-25
"""

from alembic import op
import sqlalchemy as sa

revision = "0040_task_overdue_history"
down_revision = "0039_task_settings_enabled"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "overdue_notification_runs",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("RanAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("Result", sa.String(length=20), nullable=False),
        sa.Column("NotificationsSent", sa.Integer(), nullable=False),
        sa.Column("OverdueTasks", sa.Integer(), nullable=False),
        sa.Column("UsersProcessed", sa.Integer(), nullable=False),
        sa.Column("ErrorMessage", sa.String(length=500)),
        sa.Column("TriggeredByUserId", sa.Integer()),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_overdue_notification_runs_ran_at",
        "overdue_notification_runs",
        ["RanAt"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_overdue_notification_runs_triggered_by",
        "overdue_notification_runs",
        ["TriggeredByUserId"],
        schema="tasks",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_tasks_overdue_notification_runs_triggered_by",
        table_name="overdue_notification_runs",
        schema="tasks",
    )
    op.drop_index(
        "ix_tasks_overdue_notification_runs_ran_at",
        table_name="overdue_notification_runs",
        schema="tasks",
    )
    op.drop_table("overdue_notification_runs", schema="tasks")
