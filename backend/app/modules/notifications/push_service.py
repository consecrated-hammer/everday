import base64
import json
import logging
import os
import threading
import time
from dataclasses import dataclass

import httpx
import jwt
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.notifications.models import Notification, NotificationDeviceRegistration

logger = logging.getLogger("notifications.push")

_APNS_DEACTIVATE_REASONS = {"BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"}


@dataclass(frozen=True)
class _ApnsConfig:
    team_id: str
    key_id: str
    bundle_id: str
    private_key: str
    timeout_seconds: float


def _ReadBoolEnv(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _NormalizePrivateKey(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    normalized = value.replace("\\n", "\n").strip()
    if "BEGIN PRIVATE KEY" in normalized:
        return normalized
    try:
        decoded = base64.b64decode(normalized).decode("utf-8").strip()
        if "BEGIN PRIVATE KEY" in decoded:
            return decoded
    except Exception:  # noqa: BLE001
        return ""
    return ""


def _LoadApnsConfig() -> _ApnsConfig | None:
    if not _ReadBoolEnv("APNS_ENABLED", default=False):
        return None

    team_id = os.getenv("APNS_TEAM_ID", "").strip()
    key_id = os.getenv("APNS_KEY_ID", "").strip()
    bundle_id = os.getenv("APNS_BUNDLE_ID", "").strip()
    private_key = _NormalizePrivateKey(os.getenv("APNS_PRIVATE_KEY"))
    if not (team_id and key_id and bundle_id and private_key):
        logger.warning("APNS is enabled but required configuration is missing")
        return None

    timeout_raw = os.getenv("APNS_TIMEOUT_SECONDS", "").strip()
    try:
        timeout_seconds = float(timeout_raw) if timeout_raw else 8.0
    except ValueError:
        timeout_seconds = 8.0

    return _ApnsConfig(
        team_id=team_id,
        key_id=key_id,
        bundle_id=bundle_id,
        private_key=private_key,
        timeout_seconds=timeout_seconds,
    )


class _ApnsTokenProvider:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._token: str | None = None
        self._expires_at: float = 0

    def BuildBearerToken(self, config: _ApnsConfig) -> str:
        now = time.time()
        with self._lock:
            if self._token and now < (self._expires_at - 60):
                return self._token

            issued_at = int(now)
            token = jwt.encode(
                {"iss": config.team_id, "iat": issued_at},
                config.private_key,
                algorithm="ES256",
                headers={"alg": "ES256", "kid": config.key_id},
            )
            if isinstance(token, bytes):
                token = token.decode("utf-8")

            self._token = token
            self._expires_at = issued_at + (50 * 60)
            return token


_token_provider = _ApnsTokenProvider()


def _NormalizeToken(value: str) -> str:
    cleaned = value.strip().replace(" ", "").replace("<", "").replace(">", "")
    return cleaned.lower()


def _NormalizePushEnvironment(value: str | None) -> str:
    normalized = (value or "production").strip().lower()
    return "development" if normalized == "development" else "production"


def RegisterNotificationDevice(
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
    normalized_platform = (platform or "ios").strip().lower()
    normalized_token = _NormalizeToken(device_token)
    if len(normalized_token) < 10:
        raise ValueError("Device token is invalid.")

    normalized_device_id = (device_id or "").strip() or None
    now = NowUtc()

    record = (
        db.query(NotificationDeviceRegistration)
        .filter(
            NotificationDeviceRegistration.Platform == normalized_platform,
            NotificationDeviceRegistration.DeviceToken == normalized_token,
        )
        .first()
    )
    if not record:
        record = NotificationDeviceRegistration(
            Platform=normalized_platform,
            DeviceToken=normalized_token,
            CreatedAt=now,
        )

    record.UserId = user_id
    record.DeviceId = normalized_device_id
    record.PushEnvironment = _NormalizePushEnvironment(push_environment)
    record.AppVersion = (app_version or "").strip() or None
    record.BuildNumber = (build_number or "").strip() or None
    record.IsActive = True
    record.LastSeenAt = now
    record.UpdatedAt = now
    record.LastError = None

    db.add(record)
    if normalized_device_id:
        stale_records = (
            db.query(NotificationDeviceRegistration)
            .filter(
                NotificationDeviceRegistration.UserId == user_id,
                NotificationDeviceRegistration.Platform == normalized_platform,
                NotificationDeviceRegistration.DeviceId == normalized_device_id,
                NotificationDeviceRegistration.DeviceToken != normalized_token,
                NotificationDeviceRegistration.IsActive == True,  # noqa: E712
            )
            .all()
        )
        for stale in stale_records:
            stale.IsActive = False
            stale.UpdatedAt = now
            db.add(stale)

    db.commit()
    db.refresh(record)
    return record


def UnregisterNotificationDevice(
    db: Session,
    *,
    user_id: int,
    platform: str,
    device_token: str | None,
    device_id: str | None,
) -> int:
    normalized_platform = (platform or "ios").strip().lower()
    normalized_token = _NormalizeToken(device_token) if device_token else None
    normalized_device_id = (device_id or "").strip() or None
    if not normalized_token and not normalized_device_id:
        raise ValueError("Device token or device id is required.")

    now = NowUtc()
    query = db.query(NotificationDeviceRegistration).filter(
        NotificationDeviceRegistration.UserId == user_id,
        NotificationDeviceRegistration.Platform == normalized_platform,
        NotificationDeviceRegistration.IsActive == True,  # noqa: E712
    )
    if normalized_token:
        query = query.filter(NotificationDeviceRegistration.DeviceToken == normalized_token)
    if normalized_device_id:
        query = query.filter(NotificationDeviceRegistration.DeviceId == normalized_device_id)

    updated = query.update(
        {
            NotificationDeviceRegistration.IsActive: False,
            NotificationDeviceRegistration.UpdatedAt: now,
        },
        synchronize_session=False,
    )
    db.commit()
    return int(updated or 0)


def _BuildPayload(notification: Notification, badge_count: int) -> dict:
    alert: dict[str, str] = {"title": notification.Title}
    if notification.Body:
        alert["body"] = notification.Body

    payload: dict[str, object] = {
        "aps": {
            "alert": alert,
            "badge": max(0, int(badge_count)),
            "sound": "default",
        },
        "notification_id": notification.Id,
        "type": notification.Type,
    }
    if notification.LinkUrl:
        payload["link_url"] = notification.LinkUrl
    if notification.SourceModule:
        payload["source_module"] = notification.SourceModule
    if notification.SourceId:
        payload["source_id"] = notification.SourceId
    return payload


def _ResolveApnsHost(device: NotificationDeviceRegistration) -> str:
    if _NormalizePushEnvironment(device.PushEnvironment) == "development":
        return "https://api.sandbox.push.apple.com"
    return "https://api.push.apple.com"


def _ExtractReason(response: httpx.Response) -> str:
    if not response.content:
        return f"HTTP {response.status_code}"
    try:
        parsed = response.json()
    except json.JSONDecodeError:
        return response.text[:255] or f"HTTP {response.status_code}"
    reason = str(parsed.get("reason") or "").strip()
    if reason:
        return reason[:255]
    return f"HTTP {response.status_code}"


def _ShouldDeactivateToken(status_code: int, reason: str) -> bool:
    return status_code in {400, 410} and reason in _APNS_DEACTIVATE_REASONS


def SendPushForNotification(
    db: Session,
    *,
    notification: Notification,
    badge_count: int,
) -> int:
    config = _LoadApnsConfig()
    if not config:
        return 0

    devices = (
        db.query(NotificationDeviceRegistration)
        .filter(
            NotificationDeviceRegistration.UserId == notification.UserId,
            NotificationDeviceRegistration.Platform == "ios",
            NotificationDeviceRegistration.IsActive == True,  # noqa: E712
        )
        .all()
    )
    if not devices:
        return 0

    now = NowUtc()
    payload = _BuildPayload(notification, badge_count=badge_count)
    bearer_token = _token_provider.BuildBearerToken(config)
    delivered = 0

    try:
        with httpx.Client(http2=True, timeout=config.timeout_seconds) as client:
            for device in devices:
                response = client.post(
                    f"{_ResolveApnsHost(device)}/3/device/{device.DeviceToken}",
                    json=payload,
                    headers={
                        "authorization": f"bearer {bearer_token}",
                        "apns-topic": config.bundle_id,
                        "apns-push-type": "alert",
                        "apns-priority": "10",
                    },
                )
                reason = _ExtractReason(response)
                device.LastSeenAt = now
                device.UpdatedAt = now
                if response.status_code == 200:
                    delivered += 1
                    device.LastDeliveredAt = now
                    device.LastError = None
                    logger.info(
                        "APNS sent user_id=%s notification_id=%s device_id=%s",
                        notification.UserId,
                        notification.Id,
                        device.Id,
                    )
                else:
                    device.LastError = reason
                    if _ShouldDeactivateToken(response.status_code, reason):
                        device.IsActive = False
                    logger.warning(
                        "APNS send failed user_id=%s notification_id=%s status=%s reason=%s",
                        notification.UserId,
                        notification.Id,
                        response.status_code,
                        reason,
                    )
                db.add(device)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to dispatch APNS notification id=%s", notification.Id)
        return 0

    db.commit()
    return delivered
