"""create kids module tables

Revision ID: 0011_kids_module
Revises: 0010_health_portions
Create Date: 2026-02-01 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_kids_module"
down_revision = "0010_health_portions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'kids') EXEC('CREATE SCHEMA kids')"
    )

    op.create_table(
        "kid_links",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("ParentUserId", sa.Integer(), nullable=False),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("ParentUserId", "KidUserId", name="uq_kids_links_parent_kid"),
        schema="kids",
    )
    op.create_index("ix_kids_kid_links_parent_user_id", "kid_links", ["ParentUserId"], schema="kids")
    op.create_index("ix_kids_kid_links_kid_user_id", "kid_links", ["KidUserId"], schema="kids")

    op.create_table(
        "chores",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Label", sa.String(length=200), nullable=False),
        sa.Column("Amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("IsActive", sa.Boolean(), nullable=False, server_default=sa.text("1")),
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
        schema="kids",
    )
    op.create_index("ix_kids_chores_owner_user_id", "chores", ["OwnerUserId"], schema="kids")

    op.create_table(
        "chore_assignments",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("ChoreId", sa.Integer(), nullable=False),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("ChoreId", "KidUserId", name="uq_kids_chore_assignments"),
        schema="kids",
    )
    op.create_index("ix_kids_chore_assignments_chore_id", "chore_assignments", ["ChoreId"], schema="kids")
    op.create_index("ix_kids_chore_assignments_kid_user_id", "chore_assignments", ["KidUserId"], schema="kids")

    op.create_table(
        "chore_entries",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column("ChoreId", sa.Integer(), nullable=False),
        sa.Column("EntryDate", sa.Date(), nullable=False),
        sa.Column("Amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("IsDeleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("UpdatedByUserId", sa.Integer(), nullable=True),
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
        schema="kids",
    )
    op.create_index("ix_kids_chore_entries_kid_user_id", "chore_entries", ["KidUserId"], schema="kids")
    op.create_index("ix_kids_chore_entries_chore_id", "chore_entries", ["ChoreId"], schema="kids")
    op.create_index("ix_kids_chore_entries_entry_date", "chore_entries", ["EntryDate"], schema="kids")

    op.create_table(
        "chore_entry_audits",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("ChoreEntryId", sa.Integer(), nullable=False),
        sa.Column("Action", sa.String(length=30), nullable=False),
        sa.Column("ActorUserId", sa.Integer(), nullable=False),
        sa.Column("Summary", sa.String(length=300), nullable=True),
        sa.Column("BeforeJson", sa.Text(), nullable=True),
        sa.Column("AfterJson", sa.Text(), nullable=True),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="kids",
    )
    op.create_index(
        "ix_kids_chore_entry_audits_entry_id",
        "chore_entry_audits",
        ["ChoreEntryId"],
        schema="kids",
    )

    op.create_table(
        "ledger_entries",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column("EntryType", sa.String(length=40), nullable=False),
        sa.Column("Amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("EntryDate", sa.Date(), nullable=False),
        sa.Column("Narrative", sa.String(length=200), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("SourceType", sa.String(length=60), nullable=True),
        sa.Column("SourceId", sa.Integer(), nullable=True),
        sa.Column("IsDeleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
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
            "KidUserId",
            "SourceType",
            "SourceId",
            "EntryDate",
            name="uq_kids_ledger_source",
        ),
        schema="kids",
    )
    op.create_index("ix_kids_ledger_entries_kid_user_id", "ledger_entries", ["KidUserId"], schema="kids")
    op.create_index("ix_kids_ledger_entries_entry_date", "ledger_entries", ["EntryDate"], schema="kids")

    op.create_table(
        "pocket_money_rules",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("KidUserId", sa.Integer(), nullable=False),
        sa.Column("Amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("Frequency", sa.String(length=30), nullable=False),
        sa.Column("DayOfWeek", sa.Integer(), nullable=True),
        sa.Column("DayOfMonth", sa.Integer(), nullable=True),
        sa.Column("StartDate", sa.Date(), nullable=False),
        sa.Column("LastPostedOn", sa.Date(), nullable=True),
        sa.Column("IsActive", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
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
        sa.UniqueConstraint("KidUserId", name="uq_kids_pocket_money_kid"),
        schema="kids",
    )
    op.create_index("ix_kids_pocket_money_rules_kid_user_id", "pocket_money_rules", ["KidUserId"], schema="kids")

    op.execute(
        """
        IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'EverdayCrud')
        BEGIN
          GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[kids] TO [EverdayCrud];
        END
        """
    )


def downgrade() -> None:
    op.drop_index("ix_kids_pocket_money_rules_kid_user_id", table_name="pocket_money_rules", schema="kids")
    op.drop_table("pocket_money_rules", schema="kids")

    op.drop_index("ix_kids_ledger_entries_entry_date", table_name="ledger_entries", schema="kids")
    op.drop_index("ix_kids_ledger_entries_kid_user_id", table_name="ledger_entries", schema="kids")
    op.drop_table("ledger_entries", schema="kids")

    op.drop_index("ix_kids_chore_entry_audits_entry_id", table_name="chore_entry_audits", schema="kids")
    op.drop_table("chore_entry_audits", schema="kids")

    op.drop_index("ix_kids_chore_entries_entry_date", table_name="chore_entries", schema="kids")
    op.drop_index("ix_kids_chore_entries_chore_id", table_name="chore_entries", schema="kids")
    op.drop_index("ix_kids_chore_entries_kid_user_id", table_name="chore_entries", schema="kids")
    op.drop_table("chore_entries", schema="kids")

    op.drop_index("ix_kids_chore_assignments_kid_user_id", table_name="chore_assignments", schema="kids")
    op.drop_index("ix_kids_chore_assignments_chore_id", table_name="chore_assignments", schema="kids")
    op.drop_table("chore_assignments", schema="kids")

    op.drop_index("ix_kids_chores_owner_user_id", table_name="chores", schema="kids")
    op.drop_table("chores", schema="kids")

    op.drop_index("ix_kids_kid_links_kid_user_id", table_name="kid_links", schema="kids")
    op.drop_index("ix_kids_kid_links_parent_user_id", table_name="kid_links", schema="kids")
    op.drop_table("kid_links", schema="kids")
