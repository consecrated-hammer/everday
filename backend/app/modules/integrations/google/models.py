from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint

from app.db import Base


class GoogleIntegration(Base):
    __tablename__ = "google_integrations"
    __table_args__ = {"schema": "integrations"}

    Id = Column(Integer, primary_key=True, index=True)
    RefreshToken = Column(Text, nullable=False)
    TokenType = Column(String(40))
    Scope = Column(Text)
    CalendarId = Column(String(256))
    TaskListId = Column(String(256))
    ConnectedByUserId = Column(Integer, nullable=False, index=True)
    ConnectedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class GoogleTaskShare(Base):
    __tablename__ = "google_task_shares"
    __table_args__ = (
        UniqueConstraint("GoogleTaskId", "GoogleTaskListId", name="uq_integrations_google_task_share"),
        {"schema": "integrations"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    GoogleTaskId = Column(String(200), nullable=False, index=True)
    GoogleTaskListId = Column(String(200), nullable=False, index=True)
    AssignedToUserId = Column(Integer, nullable=False, index=True)
    AssignedByUserId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class GoogleTaskOverdueNotification(Base):
    __tablename__ = "google_task_overdue_notifications"
    __table_args__ = (
        UniqueConstraint(
            "GoogleTaskId",
            "GoogleTaskListId",
            "UserId",
            name="uq_integrations_google_task_overdue",
        ),
        {"schema": "integrations"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    GoogleTaskId = Column(String(200), nullable=False, index=True)
    GoogleTaskListId = Column(String(200), nullable=False, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    NotifiedAt = Column(DateTime(timezone=True), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
