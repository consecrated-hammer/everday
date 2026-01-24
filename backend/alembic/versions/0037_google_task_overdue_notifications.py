"""create google task overdue notifications table

Revision ID: 0037_google_task_overdue_notifications
Revises: 0036_task_settings
Create Date: 2026-01-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0037_google_task_overdue_notifications"
down_revision = "0036_task_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_task_overdue_notifications",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("GoogleTaskId", sa.String(length=200), nullable=False),
        sa.Column("GoogleTaskListId", sa.String(length=200), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("NotifiedAt", sa.DateTime(timezone=True), nullable=False),
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
        sa.UniqueConstraint(
            "GoogleTaskId",
            "GoogleTaskListId",
            "UserId",
            name="uq_integrations_google_task_overdue",
        ),
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_overdue_task_id",
        "google_task_overdue_notifications",
        ["GoogleTaskId"],
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_overdue_task_list_id",
        "google_task_overdue_notifications",
        ["GoogleTaskListId"],
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_overdue_user_id",
        "google_task_overdue_notifications",
        ["UserId"],
        schema="integrations",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_integrations_google_task_overdue_user_id",
        table_name="google_task_overdue_notifications",
        schema="integrations",
    )
    op.drop_index(
        "ix_integrations_google_task_overdue_task_list_id",
        table_name="google_task_overdue_notifications",
        schema="integrations",
    )
    op.drop_index(
        "ix_integrations_google_task_overdue_task_id",
        table_name="google_task_overdue_notifications",
        schema="integrations",
    )
    op.drop_table("google_task_overdue_notifications", schema="integrations")
