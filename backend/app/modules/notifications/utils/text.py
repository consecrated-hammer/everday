from __future__ import annotations


def NormalizeNotificationTitle(title: str | None, notification_type: str | None) -> str | None:
    if not title:
        return title
    if (notification_type or "") != "KidsReminder":
        return title

    trimmed = title.lstrip()
    if not trimmed:
        return title
    if trimmed[0] not in {"?", "\ufffd"}:
        return title

    remainder = trimmed[1:].lstrip() or "Reminder"
    lowered = remainder.lower()
    if "daily" in lowered:
        emoji = "⭐️"
    elif "habit" in lowered:
        emoji = "✨"
    else:
        emoji = "⏰"
    return f"{emoji} {remainder}"
