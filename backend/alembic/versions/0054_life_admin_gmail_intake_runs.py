"""life admin gmail intake runs

Revision ID: 0054_life_admin_gmail_intake_runs
Revises: 0053_gmail_integrations
Create Date: 2026-02-09
"""

from alembic import op
import sqlalchemy as sa

revision = "0054_life_admin_gmail_intake_runs"
down_revision = "0053_gmail_integrations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'life_admin')
        BEGIN
            EXEC('CREATE SCHEMA life_admin')
        END
        """
    )

    op.create_table(
        "gmail_intake_runs",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("RunDate", sa.Date(), nullable=False),
        sa.Column("StartedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("FinishedAt", sa.DateTime(timezone=True)),
        sa.Column("Result", sa.String(length=20), nullable=False, server_default=sa.text("'Running'")),
        sa.Column("MessagesProcessed", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("DocumentsCreated", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("AttachmentErrors", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ErrorMessage", sa.String(length=500)),
        sa.Column("TriggeredByUserId", sa.Integer()),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_gmail_intake_runs_owner", "gmail_intake_runs", ["OwnerUserId"], schema="life_admin"
    )
    op.create_index(
        "ix_life_admin_gmail_intake_runs_owner_started",
        "gmail_intake_runs",
        ["OwnerUserId", "StartedAt"],
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_gmail_intake_runs_date",
        "gmail_intake_runs",
        ["RunDate"],
        schema="life_admin",
    )


def downgrade() -> None:
    op.drop_index("ix_life_admin_gmail_intake_runs_date", table_name="gmail_intake_runs", schema="life_admin")
    op.drop_index("ix_life_admin_gmail_intake_runs_owner_started", table_name="gmail_intake_runs", schema="life_admin")
    op.drop_index("ix_life_admin_gmail_intake_runs_owner", table_name="gmail_intake_runs", schema="life_admin")
    op.drop_table("gmail_intake_runs", schema="life_admin")
