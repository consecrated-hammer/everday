"""create budget income streams table

Revision ID: 0001_budget_income_streams
Revises:
Create Date: 2025-12-30 00:12:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_budget_income_streams"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "income_streams",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Label", sa.String(length=200), nullable=False),
        sa.Column("NetAmount", sa.Numeric(12, 2), nullable=False),
        sa.Column("GrossAmount", sa.Numeric(12, 2), nullable=False),
        sa.Column("FirstPayDate", sa.Date(), nullable=False),
        sa.Column("Frequency", sa.String(length=50), nullable=False),
        sa.Column("EndDate", sa.Date(), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="budget",
    )
    op.create_index(
        "ix_budget_income_streams_owner_user_id",
        "income_streams",
        ["OwnerUserId"],
        schema="budget",
    )


def downgrade() -> None:
    op.drop_index("ix_budget_income_streams_owner_user_id", table_name="income_streams", schema="budget")
    op.drop_table("income_streams", schema="budget")
