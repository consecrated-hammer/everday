"""Add metric entries and health integration keys.

Revision ID: 0030_health_metric_entries
Revises: 0029_health_import_logs
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0030_health_metric_entries"
down_revision = "0029_health_import_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_logs",
        sa.Column("StepsSource", sa.String(length=20), nullable=True),
        schema="health",
    )
    op.add_column(
        "daily_logs",
        sa.Column("WeightSource", sa.String(length=20), nullable=True),
        schema="health",
    )
    op.execute(
        "UPDATE health.daily_logs SET StepsSource = 'user' "
        "WHERE StepsSource IS NULL AND Steps > 0"
    )
    op.execute(
        "UPDATE health.daily_logs SET WeightSource = 'user' "
        "WHERE WeightSource IS NULL AND WeightKg IS NOT NULL"
    )

    op.add_column(
        "settings",
        sa.Column("HaeApiKeyHash", sa.Text(), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("HaeApiKeyLast4", sa.String(length=8), nullable=True),
        schema="health",
    )
    op.add_column(
        "settings",
        sa.Column("HaeApiKeyCreatedAt", sa.DateTime(timezone=True), nullable=True),
        schema="health",
    )

    op.create_table(
        "metric_entries",
        sa.Column("MetricEntryId", sa.String(length=36), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("LogDate", sa.Date(), nullable=False),
        sa.Column("MetricType", sa.String(length=20), nullable=False),
        sa.Column("Value", sa.Numeric(12, 2), nullable=False),
        sa.Column("OccurredAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("Source", sa.String(length=20), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        schema="health",
    )
    op.create_index(
        "ix_health_metric_entries_user_id",
        "metric_entries",
        ["UserId"],
        schema="health",
    )
    op.create_index(
        "ix_health_metric_entries_log_date",
        "metric_entries",
        ["LogDate"],
        schema="health",
    )
    op.create_index(
        "ix_health_metric_entries_metric_type",
        "metric_entries",
        ["MetricType"],
        schema="health",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_health_metric_entries_metric_type",
        table_name="metric_entries",
        schema="health",
    )
    op.drop_index(
        "ix_health_metric_entries_log_date",
        table_name="metric_entries",
        schema="health",
    )
    op.drop_index(
        "ix_health_metric_entries_user_id",
        table_name="metric_entries",
        schema="health",
    )
    op.drop_table("metric_entries", schema="health")
    op.drop_column("settings", "HaeApiKeyCreatedAt", schema="health")
    op.drop_column("settings", "HaeApiKeyLast4", schema="health")
    op.drop_column("settings", "HaeApiKeyHash", schema="health")
    op.drop_column("daily_logs", "WeightSource", schema="health")
    op.drop_column("daily_logs", "StepsSource", schema="health")
