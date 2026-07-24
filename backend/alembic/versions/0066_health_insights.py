"""add flexible health insights table

Revision ID: 0066_health_insights
Revises: 0065_health_knowledge_entities
Create Date: 2026-07-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0066_health_insights"
down_revision = "0065_health_knowledge_entities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "insights",
        sa.Column("InsightId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("InsightType", sa.String(length=80), nullable=False),
        sa.Column("PeriodType", sa.String(length=20), nullable=False),
        sa.Column("PeriodStart", sa.Date(), nullable=False),
        sa.Column("PeriodEnd", sa.Date(), nullable=True),
        sa.Column("Title", sa.String(length=200), nullable=False),
        sa.Column("Summary", sa.Text(), nullable=True),
        sa.Column("Confidence", sa.String(length=20), nullable=True),
        sa.Column("Status", sa.String(length=20), nullable=False),
        sa.Column("Source", sa.String(length=40), nullable=False),
        sa.Column("SchemaVersion", sa.Integer(), nullable=False),
        sa.Column("PayloadJson", sa.Text(), nullable=True),
        sa.Column("TagsJson", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("InsightId"),
        schema="health",
    )
    op.create_index("ix_health_insights_user_id", "insights", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_insights_insight_type", "insights", ["InsightType"], unique=False, schema="health")
    op.create_index("ix_health_insights_period_type", "insights", ["PeriodType"], unique=False, schema="health")
    op.create_index("ix_health_insights_period_start", "insights", ["PeriodStart"], unique=False, schema="health")


def downgrade() -> None:
    op.drop_index("ix_health_insights_period_start", table_name="insights", schema="health")
    op.drop_index("ix_health_insights_period_type", table_name="insights", schema="health")
    op.drop_index("ix_health_insights_insight_type", table_name="insights", schema="health")
    op.drop_index("ix_health_insights_user_id", table_name="insights", schema="health")
    op.drop_table("insights", schema="health")
