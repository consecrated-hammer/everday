from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.db import Base


class TaskList(Base):
    __tablename__ = "task_lists"
    __table_args__ = (
        UniqueConstraint("OwnerUserId", "Name", name="uq_tasks_list_owner_name"),
        {"schema": "tasks"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(120), nullable=False)
    IsShared = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class TaskTag(Base):
    __tablename__ = "task_tags"
    __table_args__ = (
        UniqueConstraint("OwnerUserId", "Slug", name="uq_tasks_tag_owner_slug"),
        {"schema": "tasks"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(80), nullable=False)
    Slug = Column(String(120), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_owner_status_start", "OwnerUserId", "IsCompleted", "StartDate"),
        Index("ix_tasks_series", "SeriesId"),
        {"schema": "tasks"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    SeriesId = Column(String(36), index=True)
    Title = Column(String(200), nullable=False)
    Description = Column(Text)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    ListId = Column(Integer, index=True)
    RelatedModule = Column(String(80))
    RelatedRecordId = Column(String(120))
    IsStarred = Column(Boolean, nullable=False, default=False)
    IsCompleted = Column(Boolean, nullable=False, default=False)
    CompletedAt = Column(DateTime(timezone=True))
    CompletedByUserId = Column(Integer)
    StartDate = Column(Date, nullable=False, index=True)
    StartTime = Column(String(5))
    EndDate = Column(Date)
    EndTime = Column(String(5))
    IsAllDay = Column(Boolean, nullable=False, default=False)
    TimeZone = Column(String(64))
    RepeatType = Column(String(20), nullable=False, default="none")
    RepeatInterval = Column(Integer, nullable=False, default=1)
    RepeatWeekdays = Column(String(40))
    RepeatMonthday = Column(Integer)
    RepeatUntilDate = Column(Date)
    ReminderAt = Column(DateTime(timezone=True))
    ReminderOffsetMinutes = Column(Integer)
    ReminderSentAt = Column(DateTime(timezone=True))
    SnoozedUntil = Column(DateTime(timezone=True))
    OverdueNotifiedAt = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class TaskAssignee(Base):
    __tablename__ = "task_assignees"
    __table_args__ = (
        UniqueConstraint("TaskId", "UserId", name="uq_tasks_assignee_task_user"),
        Index("ix_tasks_assignee_user_id", "UserId"),
        {"schema": "tasks"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    TaskId = Column(Integer, nullable=False, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    AssignedByUserId = Column(Integer, nullable=False, index=True)
    AssignedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class TaskTagLink(Base):
    __tablename__ = "task_tag_links"
    __table_args__ = (
        UniqueConstraint("TaskId", "TagId", name="uq_tasks_tag_link"),
        Index("ix_tasks_tag_link_tag_id", "TagId"),
        {"schema": "tasks"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    TaskId = Column(Integer, nullable=False, index=True)
    TagId = Column(Integer, nullable=False, index=True)


class TaskSettings(Base):
    __tablename__ = "task_settings"
    __table_args__ = (
        UniqueConstraint("UserId", name="uq_tasks_settings_user_id"),
        {"schema": "tasks"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    OverdueReminderTime = Column(String(5))
    OverdueReminderTimeZone = Column(String(64))
    OverdueLastNotifiedDate = Column(Date)
    OverdueRemindersEnabled = Column(Boolean, default=True, nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class TaskOverdueNotificationRun(Base):
    __tablename__ = "overdue_notification_runs"
    __table_args__ = {"schema": "tasks"}

    Id = Column(Integer, primary_key=True, index=True)
    RanAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    Result = Column(String(20), nullable=False)
    NotificationsSent = Column(Integer, default=0, nullable=False)
    OverdueTasks = Column(Integer, default=0, nullable=False)
    UsersProcessed = Column(Integer, default=0, nullable=False)
    ErrorMessage = Column(String(500))
    TriggeredByUserId = Column(Integer)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
