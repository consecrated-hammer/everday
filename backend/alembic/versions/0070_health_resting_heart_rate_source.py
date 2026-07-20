"""track the source of resting heart rate measurements

Revision ID: 0070_health_resting_heart_rate_source
Revises: 0069_health_symptom_tracking
"""

from alembic import op
import sqlalchemy as sa


revision = "0070_health_resting_heart_rate_source"
down_revision = "0069_health_symptom_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("body_measurements", sa.Column("RestingHeartRateUpdatedAt", sa.DateTime(timezone=True), nullable=True), schema="health")
    op.add_column("body_measurements", sa.Column("RestingHeartRateSource", sa.String(length=20), nullable=True), schema="health")
    op.execute(
        """
        UPDATE health.body_measurements
        SET RestingHeartRateSource = 'user'
        WHERE RestingHeartRate IS NOT NULL
          AND RestingHeartRateSource IS NULL;
        """
    )


def downgrade() -> None:
    op.drop_column("body_measurements", "RestingHeartRateSource", schema="health")
    op.drop_column("body_measurements", "RestingHeartRateUpdatedAt", schema="health")
