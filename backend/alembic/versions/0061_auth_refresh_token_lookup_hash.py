"""add refresh token lookup hash

Revision ID: 0061_auth_refresh_token_lookup_hash
Revises: 0060_health_reminder_timezone_adelaide
Create Date: 2026-03-24 09:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0061_auth_refresh_token_lookup_hash"
down_revision = "0060_health_reminder_timezone_adelaide"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column("LookupHash", sa.String(length=64), nullable=True),
        schema="auth",
    )
    op.create_index(
        "ix_auth_refresh_tokens_lookup_hash",
        "refresh_tokens",
        ["LookupHash"],
        unique=False,
        schema="auth",
    )


def downgrade() -> None:
    op.drop_index("ix_auth_refresh_tokens_lookup_hash", table_name="refresh_tokens", schema="auth")
    op.drop_column("refresh_tokens", "LookupHash", schema="auth")
