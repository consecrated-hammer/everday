"""add added by type to shopping items

Revision ID: 0014_shopping_added_by_type
Revises: 0013_shopping_list_items
Create Date: 2026-01-11 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_shopping_added_by_type"
down_revision = "0013_shopping_list_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shopping_items",
        sa.Column(
            "AddedByType",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'User'"),
        ),
        schema="shopping",
    )


def downgrade() -> None:
    op.drop_column("shopping_items", "AddedByType", schema="shopping")
