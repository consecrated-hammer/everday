"""Add ImageUrl to foods.

Revision ID: 0021_health_food_image_url
Revises: 0020_meal_template_fav
Create Date: 2026-01-19
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_health_food_image_url"
down_revision = "0020_meal_template_fav"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "foods",
        sa.Column("ImageUrl", sa.String(length=500), nullable=True),
        schema="health",
    )


def downgrade() -> None:
    op.drop_column("foods", "ImageUrl", schema="health")
