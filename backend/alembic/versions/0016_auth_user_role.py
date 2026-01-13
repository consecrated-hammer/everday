"""add global user role

Revision ID: 0016_auth_user_role
Revises: 0015_parent_kid_roles
Create Date: 2026-01-12 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0016_auth_user_role"
down_revision = "0015_parent_kid_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("Role", sa.String(length=20), nullable=False, server_default=sa.text("'Parent'")),
        schema="auth",
    )
    op.execute(
        """
        UPDATE auth.users
        SET Role = 'Kid'
        WHERE Id IN (
            SELECT DISTINCT UserId
            FROM auth.user_module_roles
            WHERE Role = 'Kid'
        )
        """
    )
    op.alter_column("users", "Role", server_default=None, schema="auth")


def downgrade() -> None:
    op.drop_column("users", "Role", schema="auth")
