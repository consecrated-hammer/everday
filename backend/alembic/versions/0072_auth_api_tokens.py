"""add scoped API tokens

Revision ID: 0072_auth_api_tokens
Revises: 0071_health_meal_entry_nutrition
"""

from alembic import op
import sqlalchemy as sa


revision = "0072_auth_api_tokens"
down_revision = "0071_health_meal_entry_nutrition"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("Id", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=100), nullable=False),
        sa.Column("TokenHash", sa.String(length=255), nullable=False),
        sa.Column("LookupHash", sa.String(length=64), nullable=False),
        sa.Column("Scopes", sa.Text(), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ExpiresAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("LastUsedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("RevokedAt", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["UserId"], ["auth.users.Id"]),
        sa.PrimaryKeyConstraint("Id"),
        sa.UniqueConstraint("LookupHash"),
        schema="auth",
    )
    op.create_index("ix_auth_api_tokens_user_id", "api_tokens", ["UserId"], unique=False, schema="auth")


def downgrade() -> None:
    op.drop_index("ix_auth_api_tokens_user_id", table_name="api_tokens", schema="auth")
    op.drop_table("api_tokens", schema="auth")
