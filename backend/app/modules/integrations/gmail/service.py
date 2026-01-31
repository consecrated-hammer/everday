"""Gmail integration helpers for life-admin documents."""

from __future__ import annotations

import base64
import os
import re
import secrets
import urllib.parse
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import httpx
import jwt

from app.modules.auth.deps import NowUtc, _require_env

GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
]


@dataclass(frozen=True)
class GmailConfig:
    ClientId: str
    ClientSecret: str
    RedirectUri: str
    UserId: str
    InboxLabel: str
    ProcessedLabel: str
    IntakeQuery: str | None


def _GetEnv(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped if stripped else default


def LoadGmailConfig() -> GmailConfig:
    client_id = _require_env("GMAIL_CLIENT_ID")
    client_secret = _require_env("GMAIL_CLIENT_SECRET")
    base_url = _require_env("APP_PUBLIC_URL").rstrip("/")
    redirect_uri = f"{base_url}/api/integrations/gmail/oauth/callback"
    inbox_label = _GetEnv("GMAIL_INBOX_LABEL", "Everday")
    processed_label = _GetEnv("GMAIL_PROCESSED_LABEL", "Everday/Processed")
    user_id = _GetEnv("GMAIL_USER_EMAIL") or "me"
    intake_query = _GetEnv("GMAIL_INTAKE_QUERY")

    return GmailConfig(
        ClientId=client_id,
        ClientSecret=client_secret,
        RedirectUri=redirect_uri,
        UserId=user_id,
        InboxLabel=inbox_label,
        ProcessedLabel=processed_label,
        IntakeQuery=intake_query,
    )


def BuildGmailAuthUrl(config: GmailConfig, state_token: str) -> str:
    params = {
        "client_id": config.ClientId,
        "redirect_uri": config.RedirectUri,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state_token,
    }
    return f"{GMAIL_AUTH_URL}?{urllib.parse.urlencode(params)}"


def CreateGmailStateToken(user_id: int) -> str:
    secret = _require_env("JWT_SECRET_KEY")
    now = NowUtc()
    expires = now + timedelta(minutes=10)
    payload = {
        "sub": str(user_id),
        "purpose": "gmail_oauth",
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "nonce": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def ParseGmailStateToken(state_token: str) -> int:
    secret = _require_env("JWT_SECRET_KEY")
    payload = jwt.decode(state_token, secret, algorithms=["HS256"])
    if payload.get("purpose") != "gmail_oauth":
        raise ValueError("Invalid OAuth state.")
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid OAuth state.")
    return int(user_id)


def ExchangeGmailCode(config: GmailConfig, code: str) -> dict:
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
        raise ValueError(f"Gmail token exchange failed ({response.status_code}). {detail}") from exc
    return response.json()


def RefreshAccessToken(config: GmailConfig, refresh_token: str) -> str:
    data = {
        "client_id": config.ClientId,
        "client_secret": config.ClientSecret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    response = httpx.post(GOOGLE_TOKEN_URL, data=data, timeout=15.0)
    response.raise_for_status()
    payload = response.json()
    token = payload.get("access_token")
    if not token:
        raise ValueError("Gmail access token missing.")
    return token


def _Headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _DecodeBase64Url(value: str | None) -> bytes:
    if not value:
        return b""
    padded = value.replace("-", "+").replace("_", "/")
    padding = 4 - (len(padded) % 4)
    if padding and padding != 4:
        padded += "=" * padding
    return base64.b64decode(padded)


def _ListLabels(token: str, user_id: str) -> list[dict]:
    response = httpx.get(f"{GMAIL_API_BASE}/users/{user_id}/labels", headers=_Headers(token), timeout=15.0)
    response.raise_for_status()
    return response.json().get("labels", [])


def ResolveLabelId(token: str, user_id: str, label_name: str) -> str | None:
    labels = _ListLabels(token, user_id)
    for label in labels:
        if label.get("name") == label_name:
            return label.get("id")
    return None


def ListMessages(
    token: str,
    user_id: str,
    label_id: str | None,
    max_results: int = 10,
    query: str | None = None,
) -> list[str]:
    params: dict[str, Any] = {"maxResults": max(1, min(max_results, 50))}
    if label_id:
        params["labelIds"] = [label_id]
    if query:
        params["q"] = query
    response = httpx.get(
        f"{GMAIL_API_BASE}/users/{user_id}/messages",
        headers=_Headers(token),
        params=params,
        timeout=15.0,
    )
    response.raise_for_status()
    items = response.json().get("messages", []) or []
    return [item.get("id") for item in items if item.get("id")]


def FetchMessage(token: str, user_id: str, message_id: str) -> dict:
    response = httpx.get(
        f"{GMAIL_API_BASE}/users/{user_id}/messages/{message_id}",
        headers=_Headers(token),
        params={"format": "full"},
        timeout=15.0,
    )
    response.raise_for_status()
    return response.json()


def FetchAttachment(token: str, user_id: str, message_id: str, attachment_id: str) -> bytes:
    response = httpx.get(
        f"{GMAIL_API_BASE}/users/{user_id}/messages/{message_id}/attachments/{attachment_id}",
        headers=_Headers(token),
        timeout=15.0,
    )
    response.raise_for_status()
    payload = response.json()
    return _DecodeBase64Url(payload.get("data"))


def _WalkParts(parts: list[dict], results: list[dict]) -> None:
    for part in parts:
        filename = part.get("filename") or ""
        mime_type = part.get("mimeType")
        body = part.get("body") or {}
        if filename and body.get("attachmentId"):
            results.append(
                {
                    "filename": filename,
                    "mimeType": mime_type,
                    "attachmentId": body.get("attachmentId"),
                }
            )
        if part.get("parts"):
            _WalkParts(part.get("parts") or [], results)


def ExtractAttachments(message: dict) -> list[dict]:
    payload = message.get("payload") or {}
    parts = payload.get("parts") or []
    results: list[dict] = []
    _WalkParts(parts, results)
    return results


def ExtractSubject(message: dict) -> str:
    payload = message.get("payload") or {}
    headers = payload.get("headers") or []
    for header in headers:
        if header.get("name", "").lower() == "subject":
            return header.get("value") or ""
    return ""


def ExtractSnippet(message: dict) -> str:
    return message.get("snippet") or ""


def ParseHints(text: str) -> dict:
    if not text:
        return {"tags": [], "folder": None, "links": []}
    tags = re.findall(r"#([a-zA-Z0-9_-]{2,})", text)
    folder_match = re.search(r"folder\s*:\s*([^\n\r#]+)", text, re.IGNORECASE)
    link_matches = re.findall(r"link\s*:\s*(\d+)", text, re.IGNORECASE)
    folder = folder_match.group(1).strip() if folder_match else None
    return {
        "tags": list({tag.strip() for tag in tags if tag.strip()}),
        "folder": folder,
        "links": [int(value) for value in link_matches if value.isdigit()],
    }


def ModifyMessageLabels(
    token: str,
    user_id: str,
    message_id: str,
    add_label_ids: list[str] | None = None,
    remove_label_ids: list[str] | None = None,
) -> None:
    payload: dict[str, Any] = {}
    if add_label_ids:
        payload["addLabelIds"] = add_label_ids
    if remove_label_ids:
        payload["removeLabelIds"] = remove_label_ids
    if not payload:
        return
    response = httpx.post(
        f"{GMAIL_API_BASE}/users/{user_id}/messages/{message_id}/modify",
        headers=_Headers(token),
        json=payload,
        timeout=15.0,
    )
    response.raise_for_status()


def FetchProfileEmail(access_token: str) -> str | None:
    response = httpx.get(
        f"{GMAIL_API_BASE}/users/me/profile",
        headers=_Headers(access_token),
        timeout=15.0,
    )
    response.raise_for_status()
    payload = response.json()
    email = payload.get("emailAddress")
    return email.strip() if isinstance(email, str) and email.strip() else None
