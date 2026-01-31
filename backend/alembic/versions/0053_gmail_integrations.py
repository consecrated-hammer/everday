"""create gmail integrations table

Revision ID: 0053_gmail_integrations
Revises: 0052_life_admin_documents
Create Date: 2026-01-31
"""

from alembic import op
import sqlalchemy as sa

revision = "0053_gmail_integrations"
down_revision = "0052_life_admin_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'integrations') "
        "EXEC('CREATE SCHEMA integrations')"
    )
    op.create_table(
        "gmail_integrations",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("RefreshToken", sa.Text(), nullable=False),
        sa.Column("TokenType", sa.String(length=40)),
        sa.Column("Scope", sa.Text()),
        sa.Column("AccountEmail", sa.String(length=256)),
        sa.Column("ConnectedByUserId", sa.Integer(), nullable=False),
        sa.Column("ConnectedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_gmail_integrations_connected_by_user_id",
        "gmail_integrations",
        ["ConnectedByUserId"],
        schema="integrations",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_integrations_gmail_integrations_connected_by_user_id",
        table_name="gmail_integrations",
        schema="integrations",
    )
    op.drop_table("gmail_integrations", schema="integrations")
