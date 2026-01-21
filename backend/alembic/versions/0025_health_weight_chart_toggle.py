"""Add health weight chart toggle.

Revision ID: 0025_health_weight_chart_toggle
Revises: 0024_health_goal_settings
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0025_health_weight_chart_toggle"
down_revision = "0024_health_goal_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column("ShowWeightChartOnToday", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        schema="health",
    )
    op.alter_column("settings", "ShowWeightChartOnToday", server_default=None, schema="health")


def downgrade() -> None:
    op.drop_column("settings", "ShowWeightChartOnToday", schema="health")
