"""add health workouts table

Revision ID: 0062_health_workouts
Revises: 0061_auth_refresh_token_lookup_hash
Create Date: 2026-07-16
"""

from alembic import op
import sqlalchemy as sa


revision = "0062_health_workouts"
down_revision = "0061_auth_refresh_token_lookup_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workouts",
        sa.Column("WorkoutId", sa.String(length=36), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("LogDate", sa.Date(), nullable=False),
        sa.Column("WorkoutType", sa.String(length=80), nullable=False),
        sa.Column("WorkoutName", sa.String(length=200), nullable=False),
        sa.Column("DurationMinutes", sa.Numeric(10, 2), nullable=True),
        sa.Column("CaloriesBurned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("DistanceKm", sa.Numeric(10, 2), nullable=True),
        sa.Column("Source", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("ExternalId", sa.String(length=200), nullable=True),
        sa.Column("StartedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("EndedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("Notes", sa.Text(), nullable=True),
        sa.Column("MetadataJson", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("WorkoutId"),
        schema="health",
    )
    op.create_index("ix_health_workouts_user_id", "workouts", ["UserId"], unique=False, schema="health")
    op.create_index("ix_health_workouts_log_date", "workouts", ["LogDate"], unique=False, schema="health")
    op.create_index("ix_health_workouts_external_id", "workouts", ["ExternalId"], unique=False, schema="health")


def downgrade() -> None:
    op.drop_index("ix_health_workouts_external_id", table_name="workouts", schema="health")
    op.drop_index("ix_health_workouts_log_date", table_name="workouts", schema="health")
    op.drop_index("ix_health_workouts_user_id", table_name="workouts", schema="health")
    op.drop_table("workouts", schema="health")
