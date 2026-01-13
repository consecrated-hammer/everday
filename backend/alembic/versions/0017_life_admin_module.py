"""create life admin module tables

Revision ID: 0017_life_admin_module
Revises: 0016_auth_user_role
Create Date: 2026-01-12 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0017_life_admin_module"
down_revision = "0016_auth_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'life_admin') EXEC('CREATE SCHEMA life_admin')"
    )

    op.create_table(
        "categories",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("Name", sa.String(length=120), nullable=False),
        sa.Column("Slug", sa.String(length=140), nullable=False),
        sa.Column("Description", sa.String(length=400)),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
        sa.UniqueConstraint("Slug", name="uq_life_admin_categories_slug"),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_categories_slug",
        "categories",
        ["Slug"],
        unique=True,
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_categories_created_by_user_id",
        "categories",
        ["CreatedByUserId"],
        schema="life_admin",
    )

    op.create_table(
        "fields",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("CategoryId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=120), nullable=False),
        sa.Column("Key", sa.String(length=120), nullable=False),
        sa.Column("FieldType", sa.String(length=30), nullable=False),
        sa.Column("IsRequired", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("IsMulti", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("DropdownId", sa.Integer()),
        sa.Column("LinkedCategoryId", sa.Integer()),
        sa.Column("ConfigJson", sa.Text()),
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
        sa.UniqueConstraint("CategoryId", "Key", name="uq_life_admin_fields_category_key"),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_fields_category_id",
        "fields",
        ["CategoryId"],
        schema="life_admin",
    )

    op.create_table(
        "dropdowns",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("Name", sa.String(length=120), nullable=False),
        sa.Column("Description", sa.String(length=400)),
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
        sa.UniqueConstraint("Name", name="uq_life_admin_dropdowns_name"),
        schema="life_admin",
    )

    op.create_table(
        "dropdown_options",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("DropdownId", sa.Integer(), nullable=False),
        sa.Column("Label", sa.String(length=160), nullable=False),
        sa.Column("Value", sa.String(length=160)),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
        sa.UniqueConstraint(
            "DropdownId",
            "Label",
            name="uq_life_admin_dropdown_options_label",
        ),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_dropdown_options_dropdown_id",
        "dropdown_options",
        ["DropdownId"],
        schema="life_admin",
    )

    op.create_table(
        "people",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("Name", sa.String(length=160), nullable=False),
        sa.Column("UserId", sa.Integer()),
        sa.Column("Notes", sa.String(length=400)),
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
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_people_user_id",
        "people",
        ["UserId"],
        schema="life_admin",
    )

    op.create_table(
        "records",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("CategoryId", sa.Integer(), nullable=False),
        sa.Column("Title", sa.String(length=200)),
        sa.Column("DataJson", sa.Text(), nullable=False),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("UpdatedByUserId", sa.Integer(), nullable=False),
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
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_records_category_id",
        "records",
        ["CategoryId"],
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_records_created_by_user_id",
        "records",
        ["CreatedByUserId"],
        schema="life_admin",
    )


def downgrade() -> None:
    op.drop_index("ix_life_admin_records_created_by_user_id", table_name="records", schema="life_admin")
    op.drop_index("ix_life_admin_records_category_id", table_name="records", schema="life_admin")
    op.drop_table("records", schema="life_admin")
    op.drop_index("ix_life_admin_people_user_id", table_name="people", schema="life_admin")
    op.drop_table("people", schema="life_admin")
    op.drop_index(
        "ix_life_admin_dropdown_options_dropdown_id",
        table_name="dropdown_options",
        schema="life_admin",
    )
    op.drop_table("dropdown_options", schema="life_admin")
    op.drop_table("dropdowns", schema="life_admin")
    op.drop_index("ix_life_admin_fields_category_id", table_name="fields", schema="life_admin")
    op.drop_table("fields", schema="life_admin")
    op.drop_index(
        "ix_life_admin_categories_created_by_user_id",
        table_name="categories",
        schema="life_admin",
    )
    op.drop_index(
        "ix_life_admin_categories_slug",
        table_name="categories",
        schema="life_admin",
    )
    op.drop_table("categories", schema="life_admin")
