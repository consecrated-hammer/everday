"""add auth user security flags

Revision ID: 0003_auth_user_security_flags
Revises: 0002_auth_users_roles
Create Date: 2025-12-30 10:35:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_auth_user_security_flags"
down_revision = "0002_auth_users_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "RequirePasswordChange",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        schema="auth",
    )
    op.add_column(
        "users",
        sa.Column(
            "FailedLoginCount",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        schema="auth",
    )
    op.add_column(
        "users",
        sa.Column("LockedUntil", sa.DateTime(timezone=True), nullable=True),
        schema="auth",
    )


def downgrade() -> None:
    op.drop_column("users", "LockedUntil", schema="auth")
    op.drop_column("users", "FailedLoginCount", schema="auth")
    op.drop_column("users", "RequirePasswordChange", schema="auth")
