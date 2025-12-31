"""add password reset tokens

Revision ID: 0005_auth_password_resets
Revises: 0004_auth_user_profile_fields
Create Date: 2025-12-30 13:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_auth_password_resets"
down_revision = "0004_auth_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False, index=True),
        sa.Column("TokenHash", sa.String(length=255), nullable=False),
        sa.Column("ExpiresAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UsedAt", sa.DateTime(timezone=True)),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["UserId"], ["auth.users.Id"]),
        schema="auth",
    )


def downgrade() -> None:
    op.drop_table("password_reset_tokens", schema="auth")
