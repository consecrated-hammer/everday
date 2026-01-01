"""create budget expense tables

Revision ID: 0006_budget_expenses
Revises: 0005_auth_password_resets
Create Date: 2025-12-31 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_budget_expenses"
down_revision = "0005_auth_password_resets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Label", sa.String(length=200), nullable=False),
        sa.Column("Amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("Frequency", sa.String(length=50), nullable=False),
        sa.Column("Account", sa.String(length=200), nullable=True),
        sa.Column("Type", sa.String(length=200), nullable=True),
        sa.Column("NextDueDate", sa.Date(), nullable=True),
        sa.Column("Cadence", sa.String(length=50), nullable=True),
        sa.Column("Interval", sa.Integer(), nullable=True),
        sa.Column("Month", sa.Integer(), nullable=True),
        sa.Column("DayOfMonth", sa.Integer(), nullable=True),
        sa.Column("Enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("DisplayOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="budget",
    )
    op.create_index(
        "ix_budget_expenses_owner_user_id",
        "expenses",
        ["OwnerUserId"],
        schema="budget",
    )
    op.create_index(
        "ix_budget_expenses_display_order",
        "expenses",
        ["DisplayOrder"],
        schema="budget",
    )

    op.create_table(
        "expense_accounts",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=200), nullable=False),
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
        "ix_budget_expense_accounts_owner_user_id",
        "expense_accounts",
        ["OwnerUserId"],
        schema="budget",
    )

    op.create_table(
        "expense_types",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=200), nullable=False),
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
        "ix_budget_expense_types_owner_user_id",
        "expense_types",
        ["OwnerUserId"],
        schema="budget",
    )


def downgrade() -> None:
    op.drop_index("ix_budget_expense_types_owner_user_id", table_name="expense_types", schema="budget")
    op.drop_table("expense_types", schema="budget")

    op.drop_index("ix_budget_expense_accounts_owner_user_id", table_name="expense_accounts", schema="budget")
    op.drop_table("expense_accounts", schema="budget")

    op.drop_index("ix_budget_expenses_display_order", table_name="expenses", schema="budget")
    op.drop_index("ix_budget_expenses_owner_user_id", table_name="expenses", schema="budget")
    op.drop_table("expenses", schema="budget")
