from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    Id = Column(Integer, primary_key=True, index=True)
    Username = Column(String(120), nullable=False, unique=True, index=True)
    PasswordHash = Column(String(255), nullable=False)
    FirstName = Column(String(120))
    LastName = Column(String(120))
    Email = Column(String(254))
    DiscordHandle = Column(String(120))
    Role = Column(String(20), nullable=False, default="Parent")
    IsApproved = Column(Boolean, default=True, nullable=False)
    ApprovedAt = Column(DateTime(timezone=True))
    ApprovedByUserId = Column(Integer, ForeignKey("auth.users.Id"))
    BirthDate = Column(Date)
    HeightCm = Column(Integer)
    WeightKg = Column(Numeric(6, 2))
    ActivityLevel = Column(String(40))
    RequirePasswordChange = Column(Boolean, default=False, nullable=False)
    FailedLoginCount = Column(Integer, default=0, nullable=False)
    LockedUntil = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    RefreshTokens = relationship("RefreshToken", back_populates="User")
    ModuleRoles = relationship("UserModuleRole", back_populates="User")
    PasswordResetTokens = relationship("PasswordResetToken", back_populates="User")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = {"schema": "auth"}

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, ForeignKey("auth.users.Id"), nullable=False, index=True)
    TokenHash = Column(String(255), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    ExpiresAt = Column(DateTime(timezone=True), nullable=False)
    RevokedAt = Column(DateTime(timezone=True))

    User = relationship("User", back_populates="RefreshTokens")


class UserModuleRole(Base):
    __tablename__ = "user_module_roles"
    __table_args__ = {"schema": "auth"}

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, ForeignKey("auth.users.Id"), nullable=False, index=True)
    ModuleName = Column(String(80), nullable=False, index=True)
    Role = Column(String(20), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    User = relationship("User", back_populates="ModuleRoles")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = {"schema": "auth"}

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, ForeignKey("auth.users.Id"), nullable=False, index=True)
    TokenHash = Column(String(255), nullable=False)
    ExpiresAt = Column(DateTime(timezone=True), nullable=False)
    UsedAt = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    User = relationship("User", back_populates="PasswordResetTokens")
