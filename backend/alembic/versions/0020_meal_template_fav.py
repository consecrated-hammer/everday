"""Add IsFavourite to meal templates.

Revision ID: 0020_meal_template_fav
Revises: 0019_health_meal_servings
Create Date: 2026-01-18
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_meal_template_fav"
down_revision = "0019_health_meal_servings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "meal_templates",
        sa.Column("IsFavourite", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema="health",
    )
    op.alter_column(
        "meal_templates",
        "IsFavourite",
        schema="health",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("meal_templates", "IsFavourite", schema="health")
