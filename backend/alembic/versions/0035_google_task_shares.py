"""create google task shares table

Revision ID: 0035_google_task_shares
Revises: 0034_google_integrations
Create Date: 2026-01-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0035_google_task_shares"
down_revision = "0034_google_integrations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_task_shares",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("GoogleTaskId", sa.String(length=200), nullable=False),
        sa.Column("GoogleTaskListId", sa.String(length=200), nullable=False),
        sa.Column("AssignedToUserId", sa.Integer(), nullable=False),
        sa.Column("AssignedByUserId", sa.Integer(), nullable=False),
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
            name="uq_integrations_google_task_share",
        ),
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_shares_task_id",
        "google_task_shares",
        ["GoogleTaskId"],
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_shares_task_list_id",
        "google_task_shares",
        ["GoogleTaskListId"],
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_shares_assigned_to_user_id",
        "google_task_shares",
        ["AssignedToUserId"],
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_task_shares_assigned_by_user_id",
        "google_task_shares",
        ["AssignedByUserId"],
        schema="integrations",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_integrations_google_task_shares_assigned_by_user_id",
        table_name="google_task_shares",
        schema="integrations",
    )
    op.drop_index(
        "ix_integrations_google_task_shares_assigned_to_user_id",
        table_name="google_task_shares",
        schema="integrations",
    )
    op.drop_index(
        "ix_integrations_google_task_shares_task_list_id",
        table_name="google_task_shares",
        schema="integrations",
    )
    op.drop_index(
        "ix_integrations_google_task_shares_task_id",
        table_name="google_task_shares",
        schema="integrations",
    )
    op.drop_table("google_task_shares", schema="integrations")
