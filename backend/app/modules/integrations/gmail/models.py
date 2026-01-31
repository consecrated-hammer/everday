from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db import Base


class GmailIntegration(Base):
    __tablename__ = "gmail_integrations"
    __table_args__ = {"schema": "integrations"}

    Id = Column(Integer, primary_key=True, index=True)
    RefreshToken = Column(Text, nullable=False)
    TokenType = Column(String(40))
    Scope = Column(Text)
    AccountEmail = Column(String(256))
    ConnectedByUserId = Column(Integer, nullable=False, index=True)
    ConnectedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
