"""Add weight projection toggle.

Revision ID: 0026_health_weight_proj_toggle
Revises: 0025_health_weight_chart_toggle
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0026_health_weight_proj_toggle"
down_revision = "0025_health_weight_chart_toggle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"].lower() for col in inspector.get_columns("settings", schema="health")}
    if "showweightprojectionontoday" not in existing:
        op.add_column(
            "settings",
            sa.Column("ShowWeightProjectionOnToday", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            schema="health",
        )
        op.alter_column("settings", "ShowWeightProjectionOnToday", server_default=None, schema="health")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"].lower() for col in inspector.get_columns("settings", schema="health")}
    if "showweightprojectionontoday" in existing:
        op.drop_column("settings", "ShowWeightProjectionOnToday", schema="health")
