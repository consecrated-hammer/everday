"""health_ai_suggestions_storage

Revision ID: 0042_health_ai_suggestions_storage
Revises: 0041_health_ai_suggestion_runs
Create Date: 2026-01-26

"""

from alembic import op
import sqlalchemy as sa


revision = "0042_health_ai_suggestions_storage"
down_revision = "0041_health_ai_suggestion_runs"
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
        "ai_suggestions",
        sa.Column("Id", sa.Integer(), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("RunId", sa.Integer(), nullable=False),
        sa.Column("SuggestionType", sa.String(40), nullable=False, server_default="AiSuggestion"),
        sa.Column("Title", sa.String(200), nullable=False),
        sa.Column("Detail", sa.Text(), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("Id"),
        sa.ForeignKeyConstraint(["RunId"], ["health.ai_suggestion_runs.Id"], ondelete="CASCADE"),
        schema="health",
    )
    op.create_index(
        "ix_health_ai_suggestions_user_run",
        "ai_suggestions",
        ["UserId", "RunId"],
        unique=False,
        schema="health",
    )
    # Note: Grant skipped for dev; apply manually in prod if needed
    # GRANT SELECT, INSERT, UPDATE, DELETE ON health.ai_suggestions TO EverdayCrud


def downgrade() -> None:
    op.drop_index("ix_health_ai_suggestions_user_run", table_name="ai_suggestions", schema="health")
    op.drop_table("ai_suggestions", schema="health")
