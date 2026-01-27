"""add sort order to life admin records

Revision ID: 0049_life_admin_record_sort_order
Revises: 0048_notes_schema_grants
Create Date: 2026-01-26
"""

from alembic import op
import sqlalchemy as sa

revision = "0049_life_admin_record_sort_order"
down_revision = "0048_notes_schema_grants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "records",
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        schema="life_admin",
    )
    op.execute(
        """
        WITH Ordered AS (
            SELECT
                Id,
                CategoryId,
                ROW_NUMBER() OVER (PARTITION BY CategoryId ORDER BY CreatedAt DESC, Id DESC) AS rn
            FROM life_admin.records
        )
        UPDATE r
        SET SortOrder = Ordered.rn
        FROM life_admin.records r
        INNER JOIN Ordered ON r.Id = Ordered.Id
        """
    )


def downgrade() -> None:
    op.drop_column("records", "SortOrder", schema="life_admin")
