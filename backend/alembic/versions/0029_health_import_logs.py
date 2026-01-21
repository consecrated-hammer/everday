"""Add health import logs and daily log update timestamps.

Revision ID: 0029_health_import_logs
Revises: 0028_health_goal_target_bmi
Create Date: 2026-02-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0029_health_import_logs"
down_revision = "0028_health_goal_target_bmi"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_logs",
        sa.Column("StepsUpdatedAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )
    op.add_column(
        "daily_logs",
        sa.Column("WeightUpdatedAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )
    op.execute(
        "UPDATE health.daily_logs SET StepsUpdatedAt = CreatedAt "
        "WHERE StepsUpdatedAt IS NULL AND Steps > 0"
    )
    op.execute(
        "UPDATE health.daily_logs SET WeightUpdatedAt = CreatedAt "
        "WHERE WeightUpdatedAt IS NULL AND WeightKg IS NOT NULL"
    )

    op.create_table(
        "import_logs",
        sa.Column("ImportLogId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("Source", sa.String(length=40), nullable=False),
        sa.Column("Payload", sa.Text(), nullable=False),
        sa.Column("MetricsCount", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("WorkoutsCount", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "ImportedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="health",
    )
    op.create_index(
        "ix_health_import_logs_user_id",
        "import_logs",
        ["UserId"],
        schema="health",
    )


def downgrade() -> None:
    op.drop_index("ix_health_import_logs_user_id", table_name="import_logs", schema="health")
    op.drop_table("import_logs", schema="health")
    op.drop_column("daily_logs", "WeightUpdatedAt", schema="health")
    op.drop_column("daily_logs", "StepsUpdatedAt", schema="health")
