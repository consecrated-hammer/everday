import json
import logging

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc, UserContext
from app.modules.auth.models import User
from app.modules.notifications.models import Notification, NotificationDeviceRegistration
from app.modules.notifications.push_service import (
    RegisterNotificationDevice,
    SendPushForNotification,
    UnregisterNotificationDevice,
)
from app.modules.notifications.schemas import NotificationTargetScope
from app.modules.notifications.utils.rbac import IsAdmin
from app.modules.notifications.utils.text import NormalizeNotificationTitle

logger = logging.getLogger("notifications")
SYSTEM_CREATED_BY_NAME = "Everday"
SYSTEM_NOTIFICATION_TYPES: frozenset[str] = frozenset(
    {
        "KidsReminder",
        "HealthReminder",
        "HealthAiSuggestion",
        "TaskReminder",
        "TaskOverdue",
    }
)


def IsSystemNotificationType(notification_type: str | None) -> bool:
    return (notification_type or "").strip() in SYSTEM_NOTIFICATION_TYPES


def ResolveNotificationCreatedByName(
    *,
    created_by_user_id: int,
    created_by_name: str | None,
    notification_type: str | None,
) -> str | None:
    if created_by_user_id <= 0 or IsSystemNotificationType(notification_type):
        return SYSTEM_CREATED_BY_NAME
    return created_by_name


def _SerializeJson(value: dict | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, separators=(",", ":"))


def _ParseJson(value: str | None) -> dict | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def ResolveTargetUserIds(
    db: Session,
    user: UserContext,
    target_scope: NotificationTargetScope | None,
    target_user_ids: list[int] | None,
) -> list[int]:
    if target_scope == NotificationTargetScope.AllUsers:
        if not IsAdmin(user):
            raise ValueError("Unauthorized")
        users = db.query(User.Id).all()
        return [row.Id for row in users]
    if target_scope == NotificationTargetScope.Self:
        return [user.Id]

    resolved_ids = {int(value) for value in (target_user_ids or []) if value}
    if not resolved_ids:
        return [user.Id]

    if resolved_ids != {user.Id} and not IsAdmin(user):
        raise ValueError("Unauthorized")

    rows = db.query(User.Id).filter(User.Id.in_(resolved_ids)).all()
    found_ids = {row.Id for row in rows}
    if found_ids != resolved_ids:
        raise ValueError("User not found")

    return sorted(found_ids)


def CreateNotification(
    db: Session,
    *,
    user_id: int,
    created_by_user_id: int,
    title: str,
    body: str | None = None,
    notification_type: str = "General",
    link_url: str | None = None,
    action_label: str | None = None,
    action_type: str | None = None,
    action_payload: dict | None = None,
    source_module: str | None = None,
    source_id: str | None = None,
    meta: dict | None = None,
) -> Notification:
    now = NowUtc()
    record = Notification(
        UserId=user_id,
        CreatedByUserId=created_by_user_id,
        Type=notification_type or "General",
        Title=title,
        Body=body,
        LinkUrl=link_url,
        ActionLabel=action_label,
        ActionType=action_type,
        ActionPayloadJson=_SerializeJson(action_payload),
        SourceModule=source_module,
        SourceId=source_id,
        MetaJson=_SerializeJson(meta),
        IsRead=False,
        IsDismissed=False,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    _DispatchPushForNotifications(db, [record])
    return record


def CreateNotificationsForUsers(
    db: Session,
    *,
    user_ids: list[int],
    created_by_user_id: int,
    title: str,
    body: str | None = None,
    notification_type: str = "General",
    link_url: str | None = None,
    action_label: str | None = None,
    action_type: str | None = None,
    action_payload: dict | None = None,
    source_module: str | None = None,
    source_id: str | None = None,
    meta: dict | None = None,
) -> list[Notification]:
    now = NowUtc()
    payload_json = _SerializeJson(action_payload)
    meta_json = _SerializeJson(meta)
    records = []
    for user_id in user_ids:
        records.append(
            Notification(
                UserId=user_id,
                CreatedByUserId=created_by_user_id,
                Type=notification_type or "General",
                Title=title,
                Body=body,
                LinkUrl=link_url,
                ActionLabel=action_label,
                ActionType=action_type,
                ActionPayloadJson=payload_json,
                SourceModule=source_module,
                SourceId=source_id,
                MetaJson=meta_json,
                IsRead=False,
                IsDismissed=False,
                CreatedAt=now,
                UpdatedAt=now,
            )
        )
    if not records:
        return []
    db.add_all(records)
    db.commit()
    for record in records:
        db.refresh(record)
    _DispatchPushForNotifications(db, records)
    return records


def ListNotifications(
    db: Session,
    *,
    user_id: int,
    include_read: bool,
    include_dismissed: bool,
    limit: int,
    offset: int = 0,
) -> list[Notification]:
    query = db.query(Notification).filter(Notification.UserId == user_id)
    if not include_read:
        query = query.filter(Notification.IsRead == False)  # noqa: E712
    if not include_dismissed:
        query = query.filter(Notification.IsDismissed == False)  # noqa: E712
    return (
        query.order_by(Notification.CreatedAt.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def CountUnread(db: Session, *, user_id: int) -> int:
    value = (
        db.query(func.count(Notification.Id))
        .filter(
            Notification.UserId == user_id,
            Notification.IsRead == False,  # noqa: E712
            Notification.IsDismissed == False,  # noqa: E712
        )
        .scalar()
    )
    return int(value or 0)


def CountUnreadByUserIds(db: Session, *, user_ids: set[int]) -> dict[int, int]:
    if not user_ids:
        return {}
    rows = (
        db.query(Notification.UserId, func.count(Notification.Id).label("UnreadCount"))
        .filter(
            Notification.UserId.in_(user_ids),
            Notification.IsRead == False,  # noqa: E712
            Notification.IsDismissed == False,  # noqa: E712
        )
        .group_by(Notification.UserId)
        .all()
    )
    counts = {int(row.UserId): int(row.UnreadCount or 0) for row in rows}
    for user_id in user_ids:
        counts.setdefault(user_id, 0)
    return counts


def MarkNotificationRead(
    db: Session,
    *,
    user_id: int,
    notification_id: int,
) -> Notification | None:
    record = (
        db.query(Notification)
        .filter(Notification.Id == notification_id, Notification.UserId == user_id)
        .first()
    )
    if record is None:
        return None
    if record.IsRead:
        return record
    now = NowUtc()
    record.IsRead = True
    record.ReadAt = now
    record.UpdatedAt = now
    db.commit()
    db.refresh(record)
    return record


def DismissNotification(
    db: Session,
    *,
    user_id: int,
    notification_id: int,
) -> Notification | None:
    record = (
        db.query(Notification)
        .filter(Notification.Id == notification_id, Notification.UserId == user_id)
        .first()
    )
    if record is None:
        return None
    now = NowUtc()
    record.IsDismissed = True
    record.DismissedAt = now
    if not record.IsRead:
        record.IsRead = True
        record.ReadAt = now
    record.UpdatedAt = now
    db.commit()
    db.refresh(record)
    return record


def MarkAllRead(db: Session, *, user_id: int) -> int:
    now = NowUtc()
    updated = (
        db.query(Notification)
        .filter(
            Notification.UserId == user_id,
            Notification.IsRead == False,  # noqa: E712
            Notification.IsDismissed == False,  # noqa: E712
        )
        .update(
            {
                Notification.IsRead: True,
                Notification.ReadAt: now,
                Notification.UpdatedAt: now,
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return int(updated or 0)


def RegisterUserNotificationDevice(
    db: Session,
    *,
    user_id: int,
    platform: str,
    device_token: str,
    device_id: str | None,
    push_environment: str,
    app_version: str | None,
    build_number: str | None,
) -> NotificationDeviceRegistration:
    return RegisterNotificationDevice(
        db,
        user_id=user_id,
        platform=platform,
        device_token=device_token,
        device_id=device_id,
        push_environment=push_environment,
        app_version=app_version,
        build_number=build_number,
    )


def UnregisterUserNotificationDevice(
    db: Session,
    *,
    user_id: int,
    platform: str,
    device_token: str | None,
    device_id: str | None,
) -> int:
    return UnregisterNotificationDevice(
        db,
        user_id=user_id,
        platform=platform,
        device_token=device_token,
        device_id=device_id,
    )


def _DispatchPushForNotifications(db: Session, records: list[Notification]) -> None:
    if not records:
        return
    unread_count_map = CountUnreadByUserIds(db, user_ids={record.UserId for record in records})
    for record in records:
        try:
            SendPushForNotification(
                db,
                notification=record,
                badge_count=unread_count_map.get(record.UserId, 0),
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed push dispatch notification_id=%s", record.Id)


def BuildNotificationPayload(record: Notification) -> dict:
    return {
        "Id": record.Id,
        "UserId": record.UserId,
        "CreatedByUserId": record.CreatedByUserId,
        "Type": record.Type,
        "Title": NormalizeNotificationTitle(record.Title, record.Type),
        "Body": record.Body,
        "LinkUrl": record.LinkUrl,
        "ActionLabel": record.ActionLabel,
        "ActionType": record.ActionType,
        "ActionPayload": _ParseJson(record.ActionPayloadJson),
        "SourceModule": record.SourceModule,
        "SourceId": record.SourceId,
        "Meta": _ParseJson(record.MetaJson),
        "IsRead": record.IsRead,
        "ReadAt": record.ReadAt,
        "IsDismissed": record.IsDismissed,
        "DismissedAt": record.DismissedAt,
        "CreatedAt": record.CreatedAt,
        "UpdatedAt": record.UpdatedAt,
    }
