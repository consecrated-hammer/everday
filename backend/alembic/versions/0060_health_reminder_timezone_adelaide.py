"""set health reminder timezone to australia adelaide

Revision ID: 0060_health_reminder_timezone_adelaide
Revises: 0059_kids_reconcile_monthly_payouts
Create Date: 2026-03-10 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0060_health_reminder_timezone_adelaide"
down_revision = "0059_kids_reconcile_monthly_payouts"
branch_labels = None
depends_on = None


TARGET_TZ = "Australia/Adelaide"


def upgrade() -> None:
    # Idempotent: subsequent runs match no rows after first update.
    # Only normalize UTC/blank values; preserve user-selected non-UTC zones.
    op.execute(
        sa.text(
            """
            UPDATE health.settings
            SET ReminderTimeZone = :target_tz
            WHERE ReminderTimeZone IS NULL
               OR LTRIM(RTRIM(ReminderTimeZone)) = ''
               OR UPPER(LTRIM(RTRIM(ReminderTimeZone))) IN ('UTC', 'ETC/UTC')
            """
        ).bindparams(target_tz=TARGET_TZ)
    )
    op.execute(
        sa.text(
            """
            UPDATE tasks.task_settings
            SET OverdueReminderTimeZone = :target_tz
            WHERE OverdueReminderTimeZone IS NULL
               OR LTRIM(RTRIM(OverdueReminderTimeZone)) = ''
               OR UPPER(LTRIM(RTRIM(OverdueReminderTimeZone))) IN ('UTC', 'ETC/UTC')
            """
        ).bindparams(target_tz=TARGET_TZ)
    )
    op.execute(
        sa.text(
            """
            UPDATE kids.reminder_settings
            SET ReminderTimeZone = :target_tz
            WHERE ReminderTimeZone IS NULL
               OR LTRIM(RTRIM(ReminderTimeZone)) = ''
               OR UPPER(LTRIM(RTRIM(ReminderTimeZone))) IN ('UTC', 'ETC/UTC')
            """
        ).bindparams(target_tz=TARGET_TZ)
    )


def downgrade() -> None:
    # Intentionally no-op to avoid restoring invalid/unknown prior values.
    pass
