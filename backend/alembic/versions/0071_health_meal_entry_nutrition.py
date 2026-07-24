"""add entry-level meal nutrition overrides

Revision ID: 0071_health_meal_entry_nutrition
Revises: 0070_health_resting_heart_rate_source
"""

from alembic import op
import sqlalchemy as sa


revision = "0071_health_meal_entry_nutrition"
down_revision = "0070_health_resting_heart_rate_source"
branch_labels = None
depends_on = None


_COLUMNS = (
    ("EntryCaloriesPerServing", sa.Integer()),
    ("EntryProteinPerServing", sa.Numeric(10, 2)),
    ("EntryFibrePerServing", sa.Numeric(10, 2)),
    ("EntryCarbsPerServing", sa.Numeric(10, 2)),
    ("EntryFatPerServing", sa.Numeric(10, 2)),
    ("EntrySaturatedFatPerServing", sa.Numeric(10, 2)),
    ("EntrySugarPerServing", sa.Numeric(10, 2)),
    ("EntrySodiumPerServing", sa.Numeric(10, 2)),
)


def upgrade() -> None:
    for name, column_type in _COLUMNS:
        op.add_column("meal_entries", sa.Column(name, column_type, nullable=True), schema="health")


def downgrade() -> None:
    for name, _column_type in reversed(_COLUMNS):
        op.drop_column("meal_entries", name, schema="health")
