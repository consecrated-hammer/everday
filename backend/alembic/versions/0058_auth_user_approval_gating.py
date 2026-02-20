"""add auth user approval gating

Revision ID: 0058_auth_user_approval_gating
Revises: 0057_notifications_unicode_text
Create Date: 2026-02-20 11:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0058_auth_user_approval_gating"
down_revision = "0057_notifications_unicode_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "IsApproved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        schema="auth",
    )
    op.add_column(
        "users",
        sa.Column("ApprovedAt", sa.DateTime(timezone=True), nullable=True),
        schema="auth",
    )
    op.add_column(
        "users",
        sa.Column("ApprovedByUserId", sa.Integer(), nullable=True),
        schema="auth",
    )
    op.create_foreign_key(
        "fk_auth_users_approved_by_user",
        "users",
        "users",
        ["ApprovedByUserId"],
        ["Id"],
        source_schema="auth",
        referent_schema="auth",
    )
    op.execute(
        """
        UPDATE auth.users
        SET ApprovedAt = CreatedAt
        WHERE IsApproved = 1 AND ApprovedAt IS NULL
        """
    )
    op.alter_column("users", "IsApproved", server_default=None, schema="auth")


def downgrade() -> None:
    op.drop_constraint("fk_auth_users_approved_by_user", "users", schema="auth", type_="foreignkey")
    op.drop_column("users", "ApprovedByUserId", schema="auth")
    op.drop_column("users", "ApprovedAt", schema="auth")
    op.drop_column("users", "IsApproved", schema="auth")
