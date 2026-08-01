from __future__ import annotations

import logging
import os
import re
import time

import httpx

logger = logging.getLogger(__name__)

DiscordWebhookEnvPrefix = "DISCORD_"
DiscordWebhookFallbackEnvPrefix = "HEALTH_DISCORD_WEBHOOK_USER_"
DiscordSendTimeoutSeconds = 10.0
DiscordMaxContentLength = 2000
DiscordRetryStatuses = frozenset({429, 500, 502, 503, 504})
DiscordMaxAttempts = 2
DiscordMaxRetryDelaySeconds = 5.0


def _EnvKeySuffix(username: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", username.strip().upper()).strip("_")


def ResolveWebhookUrl(user_id: int, username: str | None = None) -> str | None:
    """Return the configured Discord webhook for a user, or None when unset.

    Resolves `DISCORD_<USERNAME>` first (for example `DISCORD_KEVIN`), then falls
    back to `HEALTH_DISCORD_WEBHOOK_USER_<id>`.
    """
    candidates: list[str] = []
    if username:
        suffix = _EnvKeySuffix(username)
        if suffix:
            candidates.append(f"{DiscordWebhookEnvPrefix}{suffix}")
    candidates.append(f"{DiscordWebhookFallbackEnvPrefix}{user_id}")

    for key in candidates:
        value = os.getenv(key, "").strip()
        if value:
            return value
    return None


def _RetryDelaySeconds(response: httpx.Response) -> float:
    raw = response.headers.get("Retry-After", "")
    try:
        delay = float(raw)
    except ValueError:
        delay = 1.0
    return min(max(delay, 0.0), DiscordMaxRetryDelaySeconds)


def SendDiscordMessage(webhook_url: str, content: str) -> None:
    """Post a plain-text message to a Discord webhook.

    Raises on failure. Webhook URLs are secrets and are never logged.
    """
    body = content.strip()[:DiscordMaxContentLength]
    if not body:
        raise ValueError("Discord message content must not be empty.")

    last_status: int | None = None
    for attempt in range(1, DiscordMaxAttempts + 1):
        with httpx.Client(timeout=DiscordSendTimeoutSeconds) as client:
            response = client.post(webhook_url, json={"content": body})
        if response.status_code < 400:
            return
        last_status = response.status_code
        if attempt >= DiscordMaxAttempts or response.status_code not in DiscordRetryStatuses:
            break
        delay = _RetryDelaySeconds(response)
        logger.warning(
            "Discord webhook returned %s, retrying in %ss", response.status_code, delay
        )
        time.sleep(delay)

    raise RuntimeError(f"Discord webhook returned {last_status}")
