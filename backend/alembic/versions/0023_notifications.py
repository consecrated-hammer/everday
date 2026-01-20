"""create notifications module tables

Revision ID: 0023_notifications
Revises: 0022_health_auto_tune_targets
Create Date: 2026-02-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0023_notifications"
down_revision = "0022_health_auto_tune_targets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'notifications') "
        "EXEC('CREATE SCHEMA notifications')"
    )

    op.create_table(
        "notifications",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("Type", sa.String(length=50), nullable=False),
        sa.Column("Title", sa.String(length=160), nullable=False),
        sa.Column("Body", sa.String(length=400)),
        sa.Column("LinkUrl", sa.String(length=400)),
        sa.Column("ActionLabel", sa.String(length=80)),
        sa.Column("ActionType", sa.String(length=40)),
        sa.Column("ActionPayloadJson", sa.Text()),
        sa.Column("SourceModule", sa.String(length=80)),
        sa.Column("SourceId", sa.String(length=120)),
        sa.Column("MetaJson", sa.Text()),
        sa.Column("IsRead", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("ReadAt", sa.DateTime(timezone=True)),
        sa.Column("IsDismissed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("DismissedAt", sa.DateTime(timezone=True)),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column(
            "UpdatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="notifications",
    )
    op.create_index(
        "ix_notifications_user_id",
        "notifications",
        ["UserId"],
        schema="notifications",
    )
    op.create_index(
        "ix_notifications_created_by_user_id",
        "notifications",
        ["CreatedByUserId"],
        schema="notifications",
    )
    op.create_index(
        "ix_notifications_user_status_created",
        "notifications",
        ["UserId", "IsDismissed", "IsRead", "CreatedAt"],
        schema="notifications",
    )
    op.alter_column("notifications", "IsRead", server_default=None, schema="notifications")
    op.alter_column("notifications", "IsDismissed", server_default=None, schema="notifications")


def downgrade() -> None:
    op.drop_index(
        "ix_notifications_user_status_created",
        table_name="notifications",
        schema="notifications",
    )
    op.drop_index(
        "ix_notifications_created_by_user_id",
        table_name="notifications",
        schema="notifications",
    )
    op.drop_index(
        "ix_notifications_user_id",
        table_name="notifications",
        schema="notifications",
    )
    op.drop_table("notifications", schema="notifications")
