import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireAuthenticated, UserContext
from app.modules.auth.models import User
from app.modules.notifications.schemas import (
    NotificationBadgeCountResponse,
    NotificationBulkUpdateResponse,
    NotificationCreate,
    NotificationCreateResponse,
    NotificationDeviceRegistrationOut,
    NotificationDeviceUnregisterRequest,
    NotificationDeviceUnregisterResponse,
    NotificationDeviceRegisterRequest,
    NotificationListResponse,
    NotificationOut,
)
from app.modules.notifications.services import (
    BuildNotificationPayload,
    CountUnread,
    CreateNotificationsForUsers,
    DismissNotification,
    IsSystemNotificationType,
    ListNotifications,
    MarkAllRead,
    MarkNotificationRead,
    RegisterUserNotificationDevice,
    ResolveNotificationCreatedByName,
    ResolveTargetUserIds,
    UnregisterUserNotificationDevice,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger("notifications")


def _handle_db_error(exc: Exception) -> None:
    logger.exception("notifications database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Notifications storage not initialized. Run alembic upgrade head.",
    ) from exc


def _DisplayName(user: User) -> str:
    if user.FirstName:
        return user.FirstName.strip()
    if user.LastName:
        return user.LastName.strip()
    return user.Username


def _LoadUserNames(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    users = db.query(User).filter(User.Id.in_(user_ids)).all()
    return {user.Id: _DisplayName(user) for user in users}


def _BuildNotificationOut(record, name_map: dict[int, str]) -> NotificationOut:
    payload = BuildNotificationPayload(record)
    payload["CreatedByName"] = ResolveNotificationCreatedByName(
        created_by_user_id=record.CreatedByUserId,
        created_by_name=name_map.get(record.CreatedByUserId),
        notification_type=payload.get("Type"),
    )
    return NotificationOut(**payload)


def _BuildDeviceOut(record) -> NotificationDeviceRegistrationOut:
    return NotificationDeviceRegistrationOut(
        Id=record.Id,
        Platform=record.Platform,
        DeviceId=record.DeviceId,
        PushEnvironment=record.PushEnvironment,
        IsActive=record.IsActive,
        LastSeenAt=record.LastSeenAt,
        UpdatedAt=record.UpdatedAt,
    )


@router.get("", response_model=NotificationListResponse)
def ListNotificationItems(
    include_read: bool = True,
    include_dismissed: bool = False,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationListResponse:
    try:
        records = ListNotifications(
            db,
            user_id=user.Id,
            include_read=include_read,
            include_dismissed=include_dismissed,
            limit=limit,
            offset=offset,
        )
        user_ids = {
            record.CreatedByUserId
            for record in records
            if record.CreatedByUserId > 0 and not IsSystemNotificationType(record.Type)
        }
        name_map = _LoadUserNames(db, user_ids)
        notifications = [_BuildNotificationOut(record, name_map) for record in records]
        unread_count = CountUnread(db, user_id=user.Id)
        return NotificationListResponse(Notifications=notifications, UnreadCount=unread_count)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=NotificationCreateResponse, status_code=status.HTTP_201_CREATED)
def CreateNotificationItems(
    payload: NotificationCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationCreateResponse:
    try:
        target_ids = ResolveTargetUserIds(
            db,
            user=user,
            target_scope=payload.TargetScope,
            target_user_ids=payload.TargetUserIds,
        )
        records = CreateNotificationsForUsers(
            db,
            user_ids=target_ids,
            created_by_user_id=user.Id,
            title=payload.Title,
            body=payload.Body,
            notification_type=payload.Type or "General",
            link_url=payload.LinkUrl,
            action_label=payload.ActionLabel,
            action_type=payload.ActionType,
            action_payload=payload.ActionPayload,
            source_module=payload.SourceModule,
            source_id=payload.SourceId,
            meta=payload.Meta,
        )
        user_ids = {
            record.CreatedByUserId
            for record in records
            if record.CreatedByUserId > 0 and not IsSystemNotificationType(record.Type)
        }
        name_map = _LoadUserNames(db, user_ids)
        notifications = [_BuildNotificationOut(record, name_map) for record in records]
        return NotificationCreateResponse(Notifications=notifications)
    except ValueError as exc:
        detail = str(exc)
        if "Unauthorized" in detail:
            status_code = status.HTTP_403_FORBIDDEN
        elif "not found" in detail.lower():
            status_code = status.HTTP_404_NOT_FOUND
        else:
            status_code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/badge-count", response_model=NotificationBadgeCountResponse)
def GetBadgeCount(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationBadgeCountResponse:
    try:
        unread_count = CountUnread(db, user_id=user.Id)
        return NotificationBadgeCountResponse(UnreadCount=unread_count)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/devices/register", response_model=NotificationDeviceRegistrationOut)
def RegisterDevice(
    payload: NotificationDeviceRegisterRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationDeviceRegistrationOut:
    try:
        record = RegisterUserNotificationDevice(
            db,
            user_id=user.Id,
            platform=payload.Platform.value,
            device_token=payload.DeviceToken,
            device_id=payload.DeviceId,
            push_environment=payload.PushEnvironment.value,
            app_version=payload.AppVersion,
            build_number=payload.BuildNumber,
        )
        return _BuildDeviceOut(record)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/devices/unregister", response_model=NotificationDeviceUnregisterResponse)
def UnregisterDevice(
    payload: NotificationDeviceUnregisterRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationDeviceUnregisterResponse:
    try:
        updated = UnregisterUserNotificationDevice(
            db,
            user_id=user.Id,
            platform=payload.Platform.value,
            device_token=payload.DeviceToken,
            device_id=payload.DeviceId,
        )
        return NotificationDeviceUnregisterResponse(UpdatedCount=updated)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def MarkNotificationReadRoute(
    notification_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationOut:
    try:
        record = MarkNotificationRead(db, user_id=user.Id, notification_id=notification_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        user_ids = (
            {record.CreatedByUserId}
            if record.CreatedByUserId > 0 and not IsSystemNotificationType(record.Type)
            else set()
        )
        name_map = _LoadUserNames(db, user_ids)
        return _BuildNotificationOut(record, name_map)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/{notification_id}/dismiss", response_model=NotificationOut)
def DismissNotificationRoute(
    notification_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationOut:
    try:
        record = DismissNotification(db, user_id=user.Id, notification_id=notification_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        user_ids = (
            {record.CreatedByUserId}
            if record.CreatedByUserId > 0 and not IsSystemNotificationType(record.Type)
            else set()
        )
        name_map = _LoadUserNames(db, user_ids)
        return _BuildNotificationOut(record, name_map)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/read-all", response_model=NotificationBulkUpdateResponse)
def MarkAllReadRoute(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> NotificationBulkUpdateResponse:
    try:
        updated = MarkAllRead(db, user_id=user.Id)
        return NotificationBulkUpdateResponse(UpdatedCount=updated)
    except ProgrammingError as exc:
        _handle_db_error(exc)
