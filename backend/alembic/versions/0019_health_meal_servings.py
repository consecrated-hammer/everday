"""health meal template servings

Revision ID: 0019_health_meal_servings
Revises: 0018_kids_chores_v2
Create Date: 2026-01-16 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0019_health_meal_servings"
down_revision = "0018_kids_chores_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"].lower() for col in inspector.get_columns("meal_templates", schema="health")}
    if "servings" not in existing:
        op.add_column(
            "meal_templates",
            sa.Column(
                "Servings",
                sa.Numeric(10, 2),
                nullable=False,
                server_default=sa.text("1"),
            ),
            schema="health",
        )
        op.execute("UPDATE health.meal_templates SET Servings = 1 WHERE Servings IS NULL")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"].lower() for col in inspector.get_columns("meal_templates", schema="health")}
    if "servings" in existing:
        op.drop_column("meal_templates", "Servings", schema="health")
