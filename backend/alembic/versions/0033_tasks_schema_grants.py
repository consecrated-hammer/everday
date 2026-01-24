"""grant tasks schema to app role

Revision ID: 0033_tasks_schema_grants
Revises: 0032_tasks_module
Create Date: 2026-01-22
"""

from alembic import op

revision = "0033_tasks_schema_grants"
down_revision = "0032_tasks_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'tasks')
        BEGIN
          IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'EverdayCrud')
          BEGIN
            GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[tasks] TO [EverdayCrud];
          END
        END
        """
    )


def downgrade() -> None:
    op.execute(
        """
        IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'tasks')
        BEGIN
          IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'EverdayCrud')
          BEGIN
            REVOKE SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[tasks] FROM [EverdayCrud];
          END
        END
        """
    )
