"""create shopping list items table

Revision ID: 0013_shopping_list_items
Revises: 0012_kids_ledger_unique_index
Create Date: 2026-01-09 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_shopping_list_items"
down_revision = "0012_kids_ledger_unique_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shopping_items",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("HouseholdId", sa.Integer(), nullable=False),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Item", sa.String(length=200), nullable=False),
        sa.Column("IsActive", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column(
            "UpdatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="shopping",
    )
    op.create_index(
        "ix_shopping_items_household_id",
        "shopping_items",
        ["HouseholdId"],
        schema="shopping",
    )
    op.create_index(
        "ix_shopping_items_owner_user_id",
        "shopping_items",
        ["OwnerUserId"],
        schema="shopping",
    )
    op.create_index(
        "ix_shopping_items_household_active_sort",
        "shopping_items",
        ["HouseholdId", "IsActive", "SortOrder"],
        schema="shopping",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_shopping_items_household_active_sort",
        table_name="shopping_items",
        schema="shopping",
    )
    op.drop_index(
        "ix_shopping_items_owner_user_id",
        table_name="shopping_items",
        schema="shopping",
    )
    op.drop_index(
        "ix_shopping_items_household_id",
        table_name="shopping_items",
        schema="shopping",
    )
    op.drop_table("shopping_items", schema="shopping")
