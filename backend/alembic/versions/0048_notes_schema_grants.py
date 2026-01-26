"""grant notes schema to app role

Revision ID: 0048_notes_schema_grants
Revises: 0047_notes_associations
Create Date: 2026-01-26
"""

from alembic import op

revision = "0048_notes_schema_grants"
down_revision = "0047_notes_associations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'notes')
        BEGIN
          IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'EverdayCrud')
          BEGIN
            GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[notes] TO [EverdayCrud];
          END
        END
        """
    )


def downgrade() -> None:
    op.execute(
        """
        IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'notes')
        BEGIN
          IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'EverdayCrud')
          BEGIN
            REVOKE SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[notes] FROM [EverdayCrud];
          END
        END
        """
    )
