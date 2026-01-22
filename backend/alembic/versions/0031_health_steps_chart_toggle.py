"""Add steps chart toggle to health settings.

Revision ID: 0031_health_steps_chart_toggle
Revises: 0030_health_metric_entries
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0031_health_steps_chart_toggle"
down_revision = "0030_health_metric_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column("ShowStepsChartOnToday", sa.Boolean(), nullable=True, server_default=sa.text("1")),
        schema="health",
    )
    op.execute(
        "UPDATE health.settings SET ShowStepsChartOnToday = 1 "
        "WHERE ShowStepsChartOnToday IS NULL"
    )
    op.alter_column(
        "settings",
        "ShowStepsChartOnToday",
        existing_type=sa.Boolean(),
        nullable=False,
        schema="health",
    )


def downgrade() -> None:
    op.drop_column("settings", "ShowStepsChartOnToday", schema="health")
