"""add auth user profile fields

Revision ID: 0004_auth_user_profile_fields
Revises: 0003_auth_user_security_flags
Create Date: 2025-12-30 11:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_auth_user_profile_fields"
down_revision = "0003_auth_user_security_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("FirstName", sa.String(length=120), nullable=True), schema="auth")
    op.add_column("users", sa.Column("LastName", sa.String(length=120), nullable=True), schema="auth")
    op.add_column("users", sa.Column("Email", sa.String(length=254), nullable=True), schema="auth")
    op.add_column("users", sa.Column("DiscordHandle", sa.String(length=120), nullable=True), schema="auth")


def downgrade() -> None:
    op.drop_column("users", "DiscordHandle", schema="auth")
    op.drop_column("users", "Email", schema="auth")
    op.drop_column("users", "LastName", schema="auth")
    op.drop_column("users", "FirstName", schema="auth")
