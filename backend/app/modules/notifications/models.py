from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text

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
    Title = Column(String(160), nullable=False)
    Body = Column(String(400))
    LinkUrl = Column(String(400))
    ActionLabel = Column(String(80))
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
