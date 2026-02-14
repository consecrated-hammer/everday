from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text, Unicode

from app.db import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index(
            "ix_notifications_user_status_created",
            "UserId",
            "IsDismissed",
            "IsRead",
            "CreatedAt",
        ),
        {"schema": "notifications"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    Type = Column(String(50), nullable=False, default="General")
    Title = Column(Unicode(160), nullable=False)
    Body = Column(Unicode(400))
    LinkUrl = Column(String(400))
    ActionLabel = Column(Unicode(80))
    ActionType = Column(String(40))
    ActionPayloadJson = Column(Text)
    SourceModule = Column(String(80))
    SourceId = Column(String(120))
    MetaJson = Column(Text)
    IsRead = Column(Boolean, nullable=False, default=False)
    ReadAt = Column(DateTime(timezone=True))
    IsDismissed = Column(Boolean, nullable=False, default=False)
    DismissedAt = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class NotificationDeviceRegistration(Base):
    __tablename__ = "device_registrations"
    __table_args__ = (
        Index(
            "ix_notifications_device_registrations_user_active",
            "UserId",
            "Platform",
            "IsActive",
        ),
        Index(
            "ix_notifications_device_registrations_token",
            "Platform",
            "DeviceToken",
            unique=True,
        ),
        {"schema": "notifications"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, nullable=False, index=True)
    Platform = Column(String(20), nullable=False, default="ios")
    DeviceToken = Column(String(255), nullable=False)
    DeviceId = Column(String(128))
    PushEnvironment = Column(String(20), nullable=False, default="production")
    AppVersion = Column(String(32))
    BuildNumber = Column(String(32))
    IsActive = Column(Boolean, nullable=False, default=True)
    LastError = Column(String(255))
    LastDeliveredAt = Column(DateTime(timezone=True))
    LastSeenAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
