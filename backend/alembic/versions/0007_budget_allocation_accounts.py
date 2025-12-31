"""create budget allocation accounts

Revision ID: 0007_budget_allocation_accounts
Revises: 0006_budget_expenses
Create Date: 2025-12-31 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_budget_allocation_accounts"
down_revision = "0006_budget_expenses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "allocation_accounts",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=200), nullable=False),
        sa.Column("Percent", sa.Numeric(6, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("Enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="budget",
    )
    op.create_index(
        "ix_budget_allocation_accounts_owner_user_id",
        "allocation_accounts",
        ["OwnerUserId"],
        schema="budget",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_budget_allocation_accounts_owner_user_id",
        table_name="allocation_accounts",
        schema="budget",
    )
    op.drop_table("allocation_accounts", schema="budget")
