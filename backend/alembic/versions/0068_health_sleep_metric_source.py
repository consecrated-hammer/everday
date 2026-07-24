"""track whether a sleep value was manually set or imported

Revision ID: 0068_health_sleep_metric_source
Revises: 0067_clear_unrated_recipe_hall_of_fame
Create Date: 2026-07-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0068_health_sleep_metric_source"
down_revision = "0067_clear_unrated_recipe_hall_of_fame"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("daily_logs", sa.Column("SleepUpdatedAt", sa.DateTime(timezone=True), nullable=True), schema="health")
    op.add_column("daily_logs", sa.Column("SleepSource", sa.String(length=20), nullable=True), schema="health")
    op.execute(
        """
        UPDATE logs
        SET SleepSource = CASE WHEN automated.LastOccurredAt IS NULL THEN 'user' ELSE 'automation' END,
            SleepUpdatedAt = automated.LastOccurredAt
        FROM health.daily_logs AS logs
        OUTER APPLY (
            SELECT MAX(entries.OccurredAt) AS LastOccurredAt
            FROM health.metric_entries AS entries
            WHERE entries.UserId = logs.UserId
              AND entries.LogDate = logs.LogDate
              AND entries.MetricType = 'sleep'
              AND entries.Source = 'automation'
        ) AS automated
        WHERE logs.SleepHours IS NOT NULL
          AND logs.SleepSource IS NULL;
        """
    )


def downgrade() -> None:
    op.drop_column("daily_logs", "SleepSource", schema="health")
    op.drop_column("daily_logs", "SleepUpdatedAt", schema="health")
