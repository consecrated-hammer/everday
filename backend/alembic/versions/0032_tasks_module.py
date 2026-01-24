"""create tasks module tables

Revision ID: 0032_tasks_module
Revises: 0031_health_steps_chart_toggle
Create Date: 2026-01-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0032_tasks_module"
down_revision = "0031_health_steps_chart_toggle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'tasks') EXEC('CREATE SCHEMA tasks')"
    )

    op.create_table(
        "task_lists",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=120), nullable=False),
        sa.Column("IsShared", sa.Boolean(), nullable=False, server_default=sa.text("0")),
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
        sa.UniqueConstraint("OwnerUserId", "Name", name="uq_tasks_list_owner_name"),
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_lists_owner_user_id",
        "task_lists",
        ["OwnerUserId"],
        schema="tasks",
    )

    op.create_table(
        "task_tags",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=80), nullable=False),
        sa.Column("Slug", sa.String(length=120), nullable=False),
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
        sa.UniqueConstraint("OwnerUserId", "Slug", name="uq_tasks_tag_owner_slug"),
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_tags_owner_user_id",
        "task_tags",
        ["OwnerUserId"],
        schema="tasks",
    )

    op.create_table(
        "tasks",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("SeriesId", sa.String(length=36)),
        sa.Column("Title", sa.String(length=200), nullable=False),
        sa.Column("Description", sa.Text()),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("ListId", sa.Integer()),
        sa.Column("RelatedModule", sa.String(length=80)),
        sa.Column("RelatedRecordId", sa.String(length=120)),
        sa.Column("IsStarred", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("IsCompleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("CompletedAt", sa.DateTime(timezone=True)),
        sa.Column("CompletedByUserId", sa.Integer()),
        sa.Column("StartDate", sa.Date(), nullable=False),
        sa.Column("StartTime", sa.String(length=5)),
        sa.Column("EndDate", sa.Date()),
        sa.Column("EndTime", sa.String(length=5)),
        sa.Column("IsAllDay", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("TimeZone", sa.String(length=64)),
        sa.Column("RepeatType", sa.String(length=20), nullable=False, server_default=sa.text("'none'")),
        sa.Column("RepeatInterval", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("RepeatWeekdays", sa.String(length=40)),
        sa.Column("RepeatMonthday", sa.Integer()),
        sa.Column("RepeatUntilDate", sa.Date()),
        sa.Column("ReminderAt", sa.DateTime(timezone=True)),
        sa.Column("ReminderOffsetMinutes", sa.Integer()),
        sa.Column("ReminderSentAt", sa.DateTime(timezone=True)),
        sa.Column("SnoozedUntil", sa.DateTime(timezone=True)),
        sa.Column("OverdueNotifiedAt", sa.DateTime(timezone=True)),
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
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_tasks_owner_status_start",
        "tasks",
        ["OwnerUserId", "IsCompleted", "StartDate"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_tasks_series_id",
        "tasks",
        ["SeriesId"],
        schema="tasks",
    )

    op.create_table(
        "task_assignees",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("TaskId", sa.Integer(), nullable=False),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("AssignedByUserId", sa.Integer(), nullable=False),
        sa.Column(
            "AssignedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("TaskId", "UserId", name="uq_tasks_assignee_task_user"),
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_assignees_user_id",
        "task_assignees",
        ["UserId"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_assignees_task_id",
        "task_assignees",
        ["TaskId"],
        schema="tasks",
    )

    op.create_table(
        "task_tag_links",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("TaskId", sa.Integer(), nullable=False),
        sa.Column("TagId", sa.Integer(), nullable=False),
        sa.UniqueConstraint("TaskId", "TagId", name="uq_tasks_tag_link"),
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_tag_links_task_id",
        "task_tag_links",
        ["TaskId"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_task_tag_links_tag_id",
        "task_tag_links",
        ["TagId"],
        schema="tasks",
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_task_tag_links_tag_id", table_name="task_tag_links", schema="tasks")
    op.drop_index("ix_tasks_task_tag_links_task_id", table_name="task_tag_links", schema="tasks")
    op.drop_table("task_tag_links", schema="tasks")

    op.drop_index("ix_tasks_task_assignees_task_id", table_name="task_assignees", schema="tasks")
    op.drop_index("ix_tasks_task_assignees_user_id", table_name="task_assignees", schema="tasks")
    op.drop_table("task_assignees", schema="tasks")

    op.drop_index("ix_tasks_tasks_series_id", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_tasks_owner_status_start", table_name="tasks", schema="tasks")
    op.drop_table("tasks", schema="tasks")

    op.drop_index("ix_tasks_task_tags_owner_user_id", table_name="task_tags", schema="tasks")
    op.drop_table("task_tags", schema="tasks")

    op.drop_index("ix_tasks_task_lists_owner_user_id", table_name="task_lists", schema="tasks")
    op.drop_table("task_lists", schema="tasks")

    op.execute("DROP SCHEMA IF EXISTS tasks")
