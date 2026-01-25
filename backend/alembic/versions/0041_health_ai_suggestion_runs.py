"""health_ai_suggestion_runs

Revision ID: 0041_health_ai_suggestion_runs
Revises: 0040_task_overdue_history
Create Date: 2026-01-26

"""

from alembic import op
import sqlalchemy as sa


revision = "0041_health_ai_suggestion_runs"
down_revision = "0040_task_overdue_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'health')
        BEGIN
            EXEC('CREATE SCHEMA health')
        END
        """
    )
    op.create_table(
        "ai_suggestion_runs",
        sa.Column("Id", sa.Integer(), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("RunDate", sa.Date(), nullable=False),
        sa.Column("SuggestionsGenerated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ModelUsed", sa.String(80), nullable=True),
        sa.Column("NotificationSent", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("ErrorMessage", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("Id"),
        sa.UniqueConstraint("UserId", "RunDate", name="uq_health_ai_suggestion_runs_user_date"),
        schema="health",
    )
    op.create_index(
        "ix_health_ai_suggestion_runs_user_date",
        "ai_suggestion_runs",
        ["UserId", "RunDate"],
        unique=False,
        schema="health",
    )
    # Note: Grant skipped for dev; apply manually in prod if needed
    # GRANT SELECT, INSERT, UPDATE, DELETE ON health.ai_suggestion_runs TO EverdayCrud


def downgrade() -> None:
    op.drop_index("ix_health_ai_suggestion_runs_user_date", table_name="ai_suggestion_runs", schema="health")
    op.drop_table("ai_suggestion_runs", schema="health")
