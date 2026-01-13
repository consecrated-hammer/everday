"""normalize roles to parent/kid

Revision ID: 0015_parent_kid_roles
Revises: 0014_shopping_added_by_type
Create Date: 2026-01-12 09:00:00.000000
"""

from alembic import op

revision = "0015_parent_kid_roles"
down_revision = "0014_shopping_added_by_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE auth.user_module_roles
        SET Role = 'Parent'
        WHERE Role IS NOT NULL AND Role <> 'Kid'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE auth.user_module_roles
        SET Role = 'Admin'
        WHERE Role = 'Parent'
        """
    )
