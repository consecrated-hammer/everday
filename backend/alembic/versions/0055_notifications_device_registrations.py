"""create notifications device registration table

Revision ID: 0055_notifications_device_registrations
Revises: 0054_life_admin_gmail_intake_runs
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0055_notifications_device_registrations"
down_revision = "0054_life_admin_gmail_intake_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "device_registrations",
        sa.Column("Id", sa.Integer(), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("Platform", sa.String(length=20), nullable=False),
        sa.Column("DeviceToken", sa.String(length=255), nullable=False),
        sa.Column("DeviceId", sa.String(length=128), nullable=True),
        sa.Column("PushEnvironment", sa.String(length=20), nullable=False),
        sa.Column("AppVersion", sa.String(length=32), nullable=True),
        sa.Column("BuildNumber", sa.String(length=32), nullable=True),
        sa.Column("IsActive", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("LastError", sa.String(length=255), nullable=True),
        sa.Column("LastDeliveredAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("LastSeenAt", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
        sa.PrimaryKeyConstraint("Id"),
        schema="notifications",
    )
    op.create_index(
        "ix_notifications_device_registrations_user_active",
        "device_registrations",
        ["UserId", "Platform", "IsActive"],
        unique=False,
        schema="notifications",
    )
    op.create_index(
        "ix_notifications_device_registrations_token",
        "device_registrations",
        ["Platform", "DeviceToken"],
        unique=True,
        schema="notifications",
    )
    op.alter_column(
        "device_registrations",
        "IsActive",
        server_default=None,
        schema="notifications",
    )
    op.alter_column(
        "device_registrations",
        "LastSeenAt",
        server_default=None,
        schema="notifications",
    )
    op.alter_column(
        "device_registrations",
        "CreatedAt",
        server_default=None,
        schema="notifications",
    )
    op.alter_column(
        "device_registrations",
        "UpdatedAt",
        server_default=None,
        schema="notifications",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notifications_device_registrations_token",
        table_name="device_registrations",
        schema="notifications",
    )
    op.drop_index(
        "ix_notifications_device_registrations_user_active",
        table_name="device_registrations",
        schema="notifications",
    )
    op.drop_table("device_registrations", schema="notifications")
