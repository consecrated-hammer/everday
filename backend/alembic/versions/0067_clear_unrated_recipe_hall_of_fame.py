"""clear Hall of Fame overrides from unrated recipe reviews

Revision ID: 0067_clear_unrated_recipe_hall_of_fame
Revises: 0066_health_insights
Create Date: 2026-07-20
"""

from alembic import op


revision = "0067_clear_unrated_recipe_hall_of_fame"
down_revision = "0066_health_insights"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE health.recipe_reviews
        SET HallOfFameOverride = NULL,
            UpdatedAt = SYSUTCDATETIME()
        WHERE Rating IS NULL
          AND HallOfFameOverride IS NOT NULL;
        """
    )


def downgrade() -> None:
    # Clearing stale overrides is intentionally irreversible.
    pass
