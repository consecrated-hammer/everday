"""update kids ledger source uniqueness

Revision ID: 0012_kids_ledger_unique_index
Revises: 0011_kids_module
Create Date: 2026-02-01 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_kids_ledger_unique_index"
down_revision = "0011_kids_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_kids_ledger_source",
        "ledger_entries",
        schema="kids",
        type_="unique",
    )
    op.create_index(
        "ux_kids_ledger_source",
        "ledger_entries",
        ["KidUserId", "SourceType", "SourceId", "EntryDate"],
        unique=True,
        schema="kids",
        mssql_where=sa.text("SourceType IS NOT NULL AND SourceId IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_kids_ledger_source", table_name="ledger_entries", schema="kids")
    op.create_unique_constraint(
        "uq_kids_ledger_source",
        "ledger_entries",
        ["KidUserId", "SourceType", "SourceId", "EntryDate"],
        schema="kids",
    )
