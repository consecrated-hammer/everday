"""create kids reminder settings and runs

Revision ID: 0056_kids_reminder_settings
Revises: 0055_notifications_device_registrations
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0056_kids_reminder_settings"
down_revision = "0055_notifications_device_registrations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reminder_settings",
        sa.Column("Id", sa.Integer(), nullable=False),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column(
            "DailyJobsRemindersEnabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column(
            "DailyJobsReminderTime",
            sa.String(length=5),
            nullable=False,
            server_default=sa.text("'19:00'"),
        ),
        sa.Column(
            "HabitsRemindersEnabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column(
            "HabitsReminderTime",
            sa.String(length=5),
            nullable=False,
            server_default=sa.text("'19:00'"),
        ),
        sa.Column(
            "ReminderTimeZone",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text("'Australia/Adelaide'"),
        ),
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
        sa.PrimaryKeyConstraint("Id"),
        sa.UniqueConstraint("KidUserId", name="uq_kids_reminder_settings_kid"),
        schema="kids",
    )
    op.create_index(
        "ix_kids_reminder_settings_kid_user_id",
        "reminder_settings",
        ["KidUserId"],
        unique=False,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "DailyJobsRemindersEnabled",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "DailyJobsReminderTime",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "HabitsRemindersEnabled",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "HabitsReminderTime",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "ReminderTimeZone",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "CreatedAt",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_settings",
        "UpdatedAt",
        server_default=None,
        schema="kids",
    )

    op.create_table(
        "reminder_runs",
        sa.Column("Id", sa.Integer(), nullable=False),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column("RunDate", sa.Date(), nullable=False),
        sa.Column("RunTime", sa.String(length=5), nullable=False),
        sa.Column("ReminderType", sa.String(length=20), nullable=False),
        sa.Column("Result", sa.String(length=20), nullable=False),
        sa.Column(
            "NotificationSent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("ErrorMessage", sa.String(length=500), nullable=True),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.PrimaryKeyConstraint("Id"),
        sa.UniqueConstraint(
            "KidUserId",
            "RunDate",
            "RunTime",
            "ReminderType",
            name="uq_kids_reminder_runs_kid_date_time_type",
        ),
        schema="kids",
    )
    op.create_index(
        "ix_kids_reminder_runs_kid_user_id",
        "reminder_runs",
        ["KidUserId"],
        unique=False,
        schema="kids",
    )
    op.create_index(
        "ix_kids_reminder_runs_run_date",
        "reminder_runs",
        ["RunDate"],
        unique=False,
        schema="kids",
    )
    op.alter_column(
        "reminder_runs",
        "NotificationSent",
        server_default=None,
        schema="kids",
    )
    op.alter_column(
        "reminder_runs",
        "CreatedAt",
        server_default=None,
        schema="kids",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_kids_reminder_runs_run_date",
        table_name="reminder_runs",
        schema="kids",
    )
    op.drop_index(
        "ix_kids_reminder_runs_kid_user_id",
        table_name="reminder_runs",
        schema="kids",
    )
    op.drop_table("reminder_runs", schema="kids")

    op.drop_index(
        "ix_kids_reminder_settings_kid_user_id",
        table_name="reminder_settings",
        schema="kids",
    )
    op.drop_table("reminder_settings", schema="kids")
