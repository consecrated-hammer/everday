"""Add goal target BMI override.

Revision ID: 0028_health_goal_target_bmi
Revises: 0027_alembic_version_len
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0028_health_goal_target_bmi"
down_revision = "0027_alembic_version_len"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column("GoalTargetBmi", sa.Numeric(5, 2), nullable=True),
        schema="health",
    )


def downgrade() -> None:
    op.drop_column("settings", "GoalTargetBmi", schema="health")
