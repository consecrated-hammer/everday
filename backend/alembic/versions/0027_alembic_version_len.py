"""Widen alembic version column.

Revision ID: 0027_alembic_version_len
Revises: 0026_health_weight_proj_toggle
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0027_alembic_version_len"
down_revision = "0026_health_weight_proj_toggle"
branch_labels = None
depends_on = None

TARGET_LENGTH = 128
LEGACY_LENGTH = 32


def _get_current_length() -> int | None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns("alembic_version", schema="ref")
    for column in columns:
        if column.get("name", "").lower() == "version_num":
            column_type = column.get("type")
            return getattr(column_type, "length", None)
    return None


def _drop_primary_key() -> None:
    op.execute(
        """
        IF EXISTS (
            SELECT 1
            FROM sys.key_constraints
            WHERE name = 'alembic_version_pkc'
              AND parent_object_id = OBJECT_ID('ref.alembic_version')
        )
        ALTER TABLE ref.alembic_version DROP CONSTRAINT alembic_version_pkc;
        """
    )


def _rebuild_primary_key() -> None:
    op.create_primary_key("alembic_version_pkc", "alembic_version", ["version_num"], schema="ref")


def upgrade() -> None:
    current_length = _get_current_length()
    if current_length is None or current_length < TARGET_LENGTH:
        _drop_primary_key()
        op.alter_column(
            "alembic_version",
            "version_num",
            type_=sa.String(TARGET_LENGTH),
            existing_type=sa.String(current_length or LEGACY_LENGTH),
            existing_nullable=False,
            schema="ref",
        )
        _rebuild_primary_key()


def downgrade() -> None:
    bind = op.get_bind()
    result = bind.execute(sa.text("SELECT MAX(LEN(version_num)) FROM ref.alembic_version"))
    max_length = result.scalar() or 0
    if max_length <= LEGACY_LENGTH:
        _drop_primary_key()
        op.alter_column(
            "alembic_version",
            "version_num",
            type_=sa.String(LEGACY_LENGTH),
            existing_type=sa.String(TARGET_LENGTH),
            existing_nullable=False,
            schema="ref",
        )
        _rebuild_primary_key()
