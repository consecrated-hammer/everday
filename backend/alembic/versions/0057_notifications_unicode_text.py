"""store notification text as unicode for emoji support

Revision ID: 0057_notifications_unicode_text
Revises: 0056_kids_reminder_settings
Create Date: 2026-02-13 07:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0057_notifications_unicode_text"
down_revision = "0056_kids_reminder_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "notifications",
        "Title",
        existing_type=sa.String(length=160),
        type_=sa.Unicode(length=160),
        schema="notifications",
    )
    op.alter_column(
        "notifications",
        "Body",
        existing_type=sa.String(length=400),
        type_=sa.Unicode(length=400),
        schema="notifications",
    )
    op.alter_column(
        "notifications",
        "ActionLabel",
        existing_type=sa.String(length=80),
        type_=sa.Unicode(length=80),
        schema="notifications",
    )


def downgrade() -> None:
    op.alter_column(
        "notifications",
        "ActionLabel",
        existing_type=sa.Unicode(length=80),
        type_=sa.String(length=80),
        schema="notifications",
    )
    op.alter_column(
        "notifications",
        "Body",
        existing_type=sa.Unicode(length=400),
        type_=sa.String(length=400),
        schema="notifications",
    )
    op.alter_column(
        "notifications",
        "Title",
        existing_type=sa.Unicode(length=160),
        type_=sa.String(length=160),
        schema="notifications",
    )
