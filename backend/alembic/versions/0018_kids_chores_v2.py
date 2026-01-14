"""kids chores v2 fields

Revision ID: 0018_kids_chores_v2
Revises: 0017_life_admin_module
Create Date: 2026-01-14 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0018_kids_chores_v2"
down_revision = "0017_life_admin_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chores",
        sa.Column(
            "Type",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'Bonus'"),
        ),
        schema="kids",
    )
    op.add_column(
        "chores",
        sa.Column(
            "SortOrder",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        schema="kids",
    )
    op.add_column(
        "chores",
        sa.Column("StartsOn", sa.Date(), nullable=True),
        schema="kids",
    )
    op.add_column(
        "chores",
        sa.Column("DisabledOn", sa.Date(), nullable=True),
        schema="kids",
    )
    op.execute("UPDATE kids.chores SET StartsOn = CAST(CreatedAt AS date) WHERE StartsOn IS NULL")
    op.alter_column(
        "chores",
        "StartsOn",
        nullable=False,
        existing_type=sa.Date(),
        schema="kids",
    )

    op.add_column(
        "chore_assignments",
        sa.Column(
            "IsEnabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        schema="kids",
    )
    op.add_column(
        "chore_assignments",
        sa.Column("StartsOn", sa.Date(), nullable=True),
        schema="kids",
    )
    op.add_column(
        "chore_assignments",
        sa.Column("DisabledOn", sa.Date(), nullable=True),
        schema="kids",
    )
    op.add_column(
        "chore_assignments",
        sa.Column(
            "UpdatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="kids",
    )
    op.execute(
        "UPDATE kids.chore_assignments SET StartsOn = CAST(CreatedAt AS date) WHERE StartsOn IS NULL"
    )
    op.execute(
        "UPDATE kids.chore_assignments SET UpdatedAt = CreatedAt WHERE UpdatedAt IS NULL"
    )
    op.alter_column(
        "chore_assignments",
        "StartsOn",
        nullable=False,
        existing_type=sa.Date(),
        schema="kids",
    )

    op.add_column(
        "chore_entries",
        sa.Column(
            "Status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'Approved'"),
        ),
        schema="kids",
    )
    op.add_column(
        "chore_entries",
        sa.Column("ReviewedByUserId", sa.Integer(), nullable=True),
        schema="kids",
    )
    op.add_column(
        "chore_entries",
        sa.Column("ReviewedAt", sa.DateTime(timezone=True), nullable=True),
        schema="kids",
    )
    op.add_column(
        "chore_entries",
        sa.Column("ChoreType", sa.String(length=20), nullable=True),
        schema="kids",
    )
    op.execute(
        "UPDATE entries SET ChoreType = chores.Type FROM kids.chore_entries entries "
        "JOIN kids.chores chores ON entries.ChoreId = chores.Id WHERE entries.ChoreType IS NULL"
    )
    op.create_index(
        "ix_kids_chore_entries_status",
        "chore_entries",
        ["Status"],
        schema="kids",
    )


def downgrade() -> None:
    op.drop_index("ix_kids_chore_entries_status", table_name="chore_entries", schema="kids")
    op.drop_column("chore_entries", "ChoreType", schema="kids")
    op.drop_column("chore_entries", "ReviewedAt", schema="kids")
    op.drop_column("chore_entries", "ReviewedByUserId", schema="kids")
    op.drop_column("chore_entries", "Status", schema="kids")

    op.drop_column("chore_assignments", "UpdatedAt", schema="kids")
    op.drop_column("chore_assignments", "DisabledOn", schema="kids")
    op.drop_column("chore_assignments", "StartsOn", schema="kids")
    op.drop_column("chore_assignments", "IsEnabled", schema="kids")

    op.drop_column("chores", "DisabledOn", schema="kids")
    op.drop_column("chores", "StartsOn", schema="kids")
    op.drop_column("chores", "SortOrder", schema="kids")
    op.drop_column("chores", "Type", schema="kids")
