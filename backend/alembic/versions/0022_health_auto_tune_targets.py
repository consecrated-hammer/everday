"""Add auto tune settings for health targets.

Revision ID: 0022_health_auto_tune_targets
Revises: 0021_health_food_image_url
Create Date: 2026-01-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0022_health_auto_tune_targets"
down_revision = "0021_health_food_image_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "settings",
        sa.Column("AutoTuneTargetsWeekly", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("LastAutoTuneAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )
    op.alter_column("settings", "AutoTuneTargetsWeekly", server_default=None, schema="health")


def downgrade() -> None:
    op.drop_column("settings", "LastAutoTuneAt", schema="health")
    op.drop_column("settings", "AutoTuneTargetsWeekly", schema="health")
