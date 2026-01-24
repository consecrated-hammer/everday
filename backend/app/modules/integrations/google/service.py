import os
import secrets
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
import jwt

from app.modules.auth.deps import NowUtc, _require_env

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TASKS_BASE = "https://tasks.googleapis.com/tasks/v1"
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]


@dataclass(frozen=True)
class GoogleConfig:
    ClientId: str
    ClientSecret: str
    RedirectUri: str
    CalendarId: str | None
    TaskListId: str | None


def LoadGoogleConfig() -> GoogleConfig:
    client_id = _require_env("GOOGLE_CLIENT_ID")
    client_secret = _require_env("GOOGLE_CLIENT_SECRET")
    base_url = _require_env("APP_PUBLIC_URL").rstrip("/")
    redirect_uri = f"{base_url}/api/integrations/google/oauth/callback"
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "").strip() or None
    task_list_id = os.getenv("GOOGLE_LIST_ID", "").strip() or None
    return GoogleConfig(
        ClientId=client_id,
        ClientSecret=client_secret,
        RedirectUri=redirect_uri,
        CalendarId=calendar_id,
        TaskListId=task_list_id,
    )


def BuildGoogleAuthUrl(config: GoogleConfig, state_token: str) -> str:
    params = {
        "client_id": config.ClientId,
        "redirect_uri": config.RedirectUri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state_token,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def CreateGoogleStateToken(user_id: int) -> str:
    secret = _require_env("JWT_SECRET_KEY")
    now = NowUtc()
    expires = now + timedelta(minutes=10)
    payload = {
        "sub": str(user_id),
        "purpose": "google_oauth",
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "nonce": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def ParseGoogleStateToken(state_token: str) -> int:
    secret = _require_env("JWT_SECRET_KEY")
    payload = jwt.decode(state_token, secret, algorithms=["HS256"])
    if payload.get("purpose") != "google_oauth":
        raise ValueError("Invalid OAuth state.")
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid OAuth state.")
    return int(user_id)


def ExchangeGoogleCode(config: GoogleConfig, code: str) -> dict:
    data = {
        "code": code,
        "client_id": config.ClientId,
        "client_secret": config.ClientSecret,
        "redirect_uri": config.RedirectUri,
        "grant_type": "authorization_code",
    }
    response = httpx.post(GOOGLE_TOKEN_URL, data=data, timeout=15.0)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise ValueError(f"Google token exchange failed ({response.status_code}). {detail}") from exc
    return response.json()


def RefreshGoogleAccessToken(config: GoogleConfig, refresh_token: str) -> dict:
    data = {
        "client_id": config.ClientId,
        "client_secret": config.ClientSecret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    response = httpx.post(GOOGLE_TOKEN_URL, data=data, timeout=15.0)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise ValueError(f"Google token refresh failed ({response.status_code}). {detail}") from exc
    return response.json()


def BuildGoogleTasksHeaders(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}


def FormatGoogleDueDate(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def ParseGoogleDueDate(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed.date().isoformat()


def FetchGoogleTasks(access_token: str, list_id: str) -> list[dict]:
    response = httpx.get(
        f"{GOOGLE_TASKS_BASE}/lists/{list_id}/tasks",
        headers=BuildGoogleTasksHeaders(access_token),
        params={"showCompleted": "true", "showDeleted": "false", "showHidden": "true", "maxResults": 100},
        timeout=15.0,
    )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise ValueError(f"Google tasks list failed ({response.status_code}). {detail}") from exc
    payload = response.json()
    return payload.get("items", []) or []


def CreateGoogleTask(access_token: str, list_id: str, payload: dict) -> dict:
    response = httpx.post(
        f"{GOOGLE_TASKS_BASE}/lists/{list_id}/tasks",
        headers=BuildGoogleTasksHeaders(access_token),
        json=payload,
        timeout=15.0,
    )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise ValueError(f"Google tasks create failed ({response.status_code}). {detail}") from exc
    return response.json()


def UpdateGoogleTask(access_token: str, list_id: str, task_id: str, payload: dict) -> dict:
    response = httpx.patch(
        f"{GOOGLE_TASKS_BASE}/lists/{list_id}/tasks/{task_id}",
        headers=BuildGoogleTasksHeaders(access_token),
        json=payload,
        timeout=15.0,
    )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise ValueError(f"Google tasks update failed ({response.status_code}). {detail}") from exc
    return response.json()


def DeleteGoogleTask(access_token: str, list_id: str, task_id: str) -> None:
    response = httpx.delete(
        f"{GOOGLE_TASKS_BASE}/lists/{list_id}/tasks/{task_id}",
        headers=BuildGoogleTasksHeaders(access_token),
        timeout=15.0,
    )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise ValueError(f"Google tasks delete failed ({response.status_code}). {detail}") from exc
