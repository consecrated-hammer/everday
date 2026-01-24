"""create google integrations table

Revision ID: 0034_google_integrations
Revises: 0033_tasks_schema_grants
Create Date: 2026-01-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0034_google_integrations"
down_revision = "0033_tasks_schema_grants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'integrations') "
        "EXEC('CREATE SCHEMA integrations')"
    )

    op.create_table(
        "google_integrations",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("RefreshToken", sa.Text(), nullable=False),
        sa.Column("TokenType", sa.String(length=40)),
        sa.Column("Scope", sa.Text()),
        sa.Column("CalendarId", sa.String(length=256)),
        sa.Column("TaskListId", sa.String(length=256)),
        sa.Column("ConnectedByUserId", sa.Integer(), nullable=False),
        sa.Column(
            "ConnectedAt",
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
        schema="integrations",
    )
    op.create_index(
        "ix_integrations_google_integrations_connected_by_user_id",
        "google_integrations",
        ["ConnectedByUserId"],
        schema="integrations",
    )

    op.execute(
        """
        IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'integrations')
        BEGIN
          IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'EverdayCrud')
          BEGIN
            GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[integrations] TO [EverdayCrud];
          END
        END
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_integrations_google_integrations_connected_by_user_id",
        table_name="google_integrations",
        schema="integrations",
    )
    op.drop_table("google_integrations", schema="integrations")
