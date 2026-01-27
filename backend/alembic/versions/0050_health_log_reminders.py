"""add health log reminder settings and run history

Revision ID: 0050_health_log_reminders
Revises: 0049_life_admin_record_sort_order
Create Date: 2026-01-27
"""

from alembic import op
import sqlalchemy as sa

revision = "0050_health_log_reminders"
down_revision = "0049_life_admin_record_sort_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column(
            "FoodRemindersEnabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("FoodReminderTimes", sa.Text(), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column(
            "WeightRemindersEnabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("WeightReminderTime", sa.String(length=5), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("ReminderTimeZone", sa.String(length=64), nullable=True),
        schema="health",
    )

    op.create_table(
        "reminder_runs",
        sa.Column("Id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("RunDate", sa.Date(), nullable=False),
        sa.Column("RunTime", sa.String(length=5), nullable=False),
        sa.Column("ReminderType", sa.String(length=20), nullable=False),
        sa.Column(
            "MealType",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("''"),
        ),
        sa.Column("Result", sa.String(length=20), nullable=False),
        sa.Column(
            "NotificationSent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("ErrorMessage", sa.Text(), nullable=True),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint(
            "UserId",
            "RunDate",
            "RunTime",
            "ReminderType",
            "MealType",
            name="uq_health_reminder_runs_user_date_time_type_meal",
        ),
        schema="health",
    )
    op.create_index(
        "ix_health_reminder_runs_user_date",
        "reminder_runs",
        ["UserId", "RunDate"],
        schema="health",
    )
    op.create_index(
        "ix_health_reminder_runs_created_at",
        "reminder_runs",
        ["CreatedAt"],
        schema="health",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_health_reminder_runs_created_at",
        table_name="reminder_runs",
        schema="health",
    )
    op.drop_index(
        "ix_health_reminder_runs_user_date",
        table_name="reminder_runs",
        schema="health",
    )
    op.drop_table("reminder_runs", schema="health")

    op.drop_column("settings", "ReminderTimeZone", schema="health")
    op.drop_column("settings", "WeightReminderTime", schema="health")
    op.drop_column("settings", "WeightRemindersEnabled", schema="health")
    op.drop_column("settings", "FoodReminderTimes", schema="health")
    op.drop_column("settings", "FoodRemindersEnabled", schema="health")

