from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class NotificationTargetScope(str, Enum):
    Self = "Self"
    UserIds = "UserIds"
    AllUsers = "AllUsers"


class NotificationDevicePlatform(str, Enum):
    Ios = "ios"


class NotificationPushEnvironment(str, Enum):
    Development = "development"
    Production = "production"


class NotificationCreate(BaseModel):
    Title: str = Field(min_length=1, max_length=160)
    Body: str | None = Field(default=None, max_length=400)
    Type: str | None = Field(default=None, max_length=50)
    LinkUrl: str | None = Field(default=None, max_length=400)
    ActionLabel: str | None = Field(default=None, max_length=80)
    ActionType: str | None = Field(default=None, max_length=40)
    ActionPayload: dict | None = None
    SourceModule: str | None = Field(default=None, max_length=80)
    SourceId: str | None = Field(default=None, max_length=120)
    Meta: dict | None = None
    TargetUserIds: list[int] | None = None
    TargetScope: NotificationTargetScope | None = None


class NotificationOut(BaseModel):
    Id: int
    UserId: int
    CreatedByUserId: int
    CreatedByName: str | None = None
    Type: str
    Title: str
    Body: str | None = None
    LinkUrl: str | None = None
    ActionLabel: str | None = None
    ActionType: str | None = None
    ActionPayload: dict | None = None
    SourceModule: str | None = None
    SourceId: str | None = None
    Meta: dict | None = None
    IsRead: bool
    ReadAt: datetime | None = None
    IsDismissed: bool
    DismissedAt: datetime | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class NotificationListResponse(BaseModel):
    Notifications: list[NotificationOut]
    UnreadCount: int


class NotificationBulkUpdateResponse(BaseModel):
    UpdatedCount: int


class NotificationCreateResponse(BaseModel):
    Notifications: list[NotificationOut]


class NotificationBadgeCountResponse(BaseModel):
    UnreadCount: int


class NotificationDeviceRegisterRequest(BaseModel):
    Platform: NotificationDevicePlatform = NotificationDevicePlatform.Ios
    DeviceToken: str = Field(min_length=10, max_length=255)
    DeviceId: str | None = Field(default=None, max_length=128)
    PushEnvironment: NotificationPushEnvironment = NotificationPushEnvironment.Production
    AppVersion: str | None = Field(default=None, max_length=32)
    BuildNumber: str | None = Field(default=None, max_length=32)


class NotificationDeviceRegistrationOut(BaseModel):
    Id: int
    Platform: NotificationDevicePlatform
    DeviceId: str | None = None
    PushEnvironment: NotificationPushEnvironment
    IsActive: bool
    LastSeenAt: datetime
    UpdatedAt: datetime


class NotificationDeviceUnregisterRequest(BaseModel):
    Platform: NotificationDevicePlatform = NotificationDevicePlatform.Ios
    DeviceToken: str | None = Field(default=None, max_length=255)
    DeviceId: str | None = Field(default=None, max_length=128)


class NotificationDeviceUnregisterResponse(BaseModel):
    UpdatedCount: int
