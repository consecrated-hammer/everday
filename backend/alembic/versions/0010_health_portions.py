"""add health portion options and base amounts

Revision ID: 0010_health_portions
Revises: 0009_health_module
Create Date: 2026-01-07 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_health_portions"
down_revision = "0009_health_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portion_options",
        sa.Column("PortionOptionId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("FoodId", sa.String(length=36), nullable=True),
        sa.Column("Label", sa.String(length=80), nullable=False),
        sa.Column("BaseUnit", sa.String(length=10), nullable=False),
        sa.Column("BaseAmount", sa.Numeric(10, 4), nullable=False),
        sa.Column("Scope", sa.String(length=20), nullable=False),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("IsDefault", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="health",
    )
    op.create_index(
        "ix_health_portion_options_user_id",
        "portion_options",
        ["UserId"],
        schema="health",
    )
    op.create_index(
        "ix_health_portion_options_food_id",
        "portion_options",
        ["FoodId"],
        schema="health",
    )

    op.add_column(
        "meal_entries",
        sa.Column("DisplayQuantity", sa.Numeric(10, 4), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("PortionOptionId", sa.String(length=36), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("PortionLabel", sa.String(length=80), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("PortionBaseUnit", sa.String(length=10), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("PortionBaseAmount", sa.Numeric(10, 4), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("PortionBaseTotal", sa.Numeric(10, 4), nullable=True),
        schema="health",
    )

    op.drop_column("meal_entries", "EntryQuantity", schema="health")
    op.drop_column("meal_entries", "EntryUnit", schema="health")
    op.drop_column("meal_entries", "ConversionDetail", schema="health")


def downgrade() -> None:
    op.add_column(
        "meal_entries",
        sa.Column("EntryQuantity", sa.Numeric(10, 4), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("EntryUnit", sa.String(length=40), nullable=True),
        schema="health",
    )
    op.add_column(
        "meal_entries",
        sa.Column("ConversionDetail", sa.Text(), nullable=True),
        schema="health",
    )
    op.drop_column("meal_entries", "PortionBaseTotal", schema="health")
    op.drop_column("meal_entries", "PortionBaseAmount", schema="health")
    op.drop_column("meal_entries", "PortionBaseUnit", schema="health")
    op.drop_column("meal_entries", "PortionLabel", schema="health")
    op.drop_column("meal_entries", "PortionOptionId", schema="health")
    op.drop_column("meal_entries", "DisplayQuantity", schema="health")

    op.drop_index("ix_health_portion_options_food_id", table_name="portion_options", schema="health")
    op.drop_index("ix_health_portion_options_user_id", table_name="portion_options", schema="health")
    op.drop_table("portion_options", schema="health")
