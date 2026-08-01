from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.auth.models import User
from app.modules.health.models import DailyLog, HealthReminderRun, MealEntry
from app.modules.health.services.settings_service import EnsureSettingsForUser
from app.modules.tasks.models import TaskSettings
from app.modules.health.utils.defaults import (
    DefaultFoodReminderSlots,
    DefaultFoodReminderTimes,
    DefaultReminderTimeZone,
    DefaultWeightReminderTime,
)
from app.modules.notifications.services import CreateNotification
from app.modules.health.services.discord_service import ResolveWebhookUrl, SendDiscordMessage

logger = logging.getLogger(__name__)

MealTypeLabels = {
    "Breakfast": "Breakfast",
    "Snack1": "Snack 1",
    "Lunch": "Lunch",
    "Snack2": "Snack 2",
    "Dinner": "Dinner",
    "Snack3": "Snack 3",
}
DefaultReminderZone = ZoneInfo(DefaultReminderTimeZone)

MainMealTypes = ("Breakfast", "Lunch", "Dinner")
YesterdayReminderType = "YesterdayIncomplete"
DefaultYesterdayWeekdayTime = "07:00"
DefaultYesterdayWeekendTime = "09:00"
DefaultHealthDashboardBaseUrl = "https://health.bunella.au"


def _IsValidTime(value: str | None) -> bool:
    if not value:
        return False
    if not re.fullmatch(r"\d{2}:\d{2}", value):
        return False
    try:
        datetime.strptime(value, "%H:%M")
        return True
    except ValueError:
        return False


def _NormalizeTime(value: str | None) -> str | None:
    if not _IsValidTime(value):
        return None
    return datetime.strptime(value, "%H:%M").strftime("%H:%M")


def _TimeMatches(run_time: str, target_time: str | None) -> bool:
    normalized_run = _NormalizeTime(run_time)
    normalized_target = _NormalizeTime(target_time)
    if not normalized_run or not normalized_target:
        return False
    return normalized_run == normalized_target


def _ResolveEffectiveRunDateTime(
    now_utc: datetime,
    run_date: date | None,
    run_time: str | None,
    run_zone: ZoneInfo | None = None,
) -> tuple[date, str]:
    if run_time is not None and not _IsValidTime(run_time):
        raise ValueError("Run time must be in HH:MM format.")
    now_local = now_utc.astimezone(run_zone or DefaultReminderZone)
    effective_date = run_date or now_local.date()
    effective_time = _NormalizeTime(run_time) if run_time else now_local.strftime("%H:%M")
    if not _IsValidTime(effective_time):
        raise ValueError("Run time must be in HH:MM format.")
    return effective_date, effective_time


def _ResolveRunZone(value: str | None) -> ZoneInfo:
    candidate = (value or "").strip() or DefaultReminderTimeZone
    try:
        return ZoneInfo(candidate)
    except Exception:  # noqa: BLE001
        return DefaultReminderZone


def _ParseFoodReminderTimes(value: str | None) -> dict[str, str]:
    normalized = dict(DefaultFoodReminderTimes)
    if not value:
        return normalized
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return normalized
    if not isinstance(parsed, dict):
        return normalized
    for meal_type, time_value in parsed.items():
        meal_key = str(meal_type)
        time_text = str(time_value)
        if meal_key not in normalized:
            continue
        if _IsValidTime(time_text):
            normalized[meal_key] = _NormalizeTime(time_text) or normalized[meal_key]
    return normalized


def _ParseFoodReminderSlots(
    slots_value: str | None,
    legacy_enabled: bool,
    legacy_times: dict[str, str],
) -> dict[str, dict[str, object]]:
    normalized = {
        meal_type: {"Enabled": bool(slot["Enabled"]), "Time": str(slot["Time"])}
        for meal_type, slot in DefaultFoodReminderSlots.items()
    }
    for meal_type, time_value in legacy_times.items():
        if meal_type in normalized and _IsValidTime(time_value):
            normalized_time = _NormalizeTime(time_value)
            if normalized_time:
                normalized[meal_type]["Time"] = normalized_time
    if legacy_enabled:
        for meal_type in normalized:
            normalized[meal_type]["Enabled"] = True
    if not slots_value:
        return normalized
    try:
        parsed = json.loads(slots_value)
    except json.JSONDecodeError:
        return normalized
    if not isinstance(parsed, dict):
        return normalized
    for meal_type, slot_value in parsed.items():
        meal_key = str(meal_type)
        if meal_key not in normalized:
            continue
        if isinstance(slot_value, dict):
            enabled_value = slot_value.get("Enabled", slot_value.get("enabled"))
            time_value = slot_value.get("Time", slot_value.get("time"))
            if enabled_value is not None:
                normalized[meal_key]["Enabled"] = bool(enabled_value)
            if _IsValidTime(str(time_value) if time_value is not None else None):
                normalized[meal_key]["Time"] = (
                    _NormalizeTime(str(time_value)) or normalized[meal_key]["Time"]
                )
            continue
        if _IsValidTime(str(slot_value)):
            normalized_time = _NormalizeTime(str(slot_value))
            if normalized_time:
                normalized[meal_key]["Time"] = normalized_time
    return normalized


def _GetDailyLog(db: Session, user_id: int, run_date: date) -> DailyLog | None:
    return (
        db.query(DailyLog)
        .filter(
            DailyLog.UserId == user_id,
            DailyLog.LogDate == run_date,
        )
        .first()
    )


def _HasMealEntry(db: Session, user_id: int, run_date: date, meal_type: str) -> bool:
    log = _GetDailyLog(db, user_id, run_date)
    if not log:
        return False
    count = (
        db.query(MealEntry)
        .filter(
            MealEntry.DailyLogId == log.DailyLogId,
            MealEntry.MealType == meal_type,
        )
        .count()
    )
    return count > 0


def _HasWeightEntry(db: Session, user_id: int, run_date: date) -> bool:
    log = _GetDailyLog(db, user_id, run_date)
    if not log:
        return False
    return log.WeightKg is not None


def _AlreadyRan(
    db: Session,
    user_id: int,
    run_date: date,
    run_time: str,
    reminder_type: str,
    meal_type: str,
) -> bool:
    existing = (
        db.query(HealthReminderRun)
        .filter(
            HealthReminderRun.UserId == user_id,
            HealthReminderRun.RunDate == run_date,
            HealthReminderRun.RunTime == run_time,
            HealthReminderRun.ReminderType == reminder_type,
            HealthReminderRun.MealType == meal_type,
        )
        .first()
    )
    return existing is not None


def _RecordRun(
    db: Session,
    user_id: int,
    run_date: date,
    run_time: str,
    reminder_type: str,
    meal_type: str,
    result: str,
    notification_sent: bool,
    error_message: str | None = None,
) -> HealthReminderRun:
    record = HealthReminderRun(
        UserId=user_id,
        RunDate=run_date,
        RunTime=run_time,
        ReminderType=reminder_type,
        MealType=meal_type,
        Result=result,
        NotificationSent=notification_sent,
        ErrorMessage=(error_message or "")[:500] or None,
        CreatedAt=NowUtc(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _FormatMealLabel(meal_type: str) -> str:
    return MealTypeLabels.get(meal_type, meal_type)


def _SendMealReminder(
    db: Session,
    admin_user_id: int,
    user_id: int,
    run_date: date,
    run_time: str,
    meal_type: str,
) -> None:
    meal_label = _FormatMealLabel(meal_type)
    CreateNotification(
        db,
        user_id=user_id,
        created_by_user_id=admin_user_id,
        title=f"Log {meal_label}",
        body=f"Reminder to log your {meal_label.lower()}.",
        notification_type="HealthReminder",
        link_url=f"/health/log?date={run_date.isoformat()}&meal={meal_type}&add=1",
        action_label="Log meal",
        source_module="health",
        source_id=f"reminder:{run_date.isoformat()}:{run_time}:meal:{meal_type}",
    )


def _SendWeightReminder(
    db: Session,
    admin_user_id: int,
    user_id: int,
    run_date: date,
    run_time: str,
) -> None:
    CreateNotification(
        db,
        user_id=user_id,
        created_by_user_id=admin_user_id,
        title="Log weight",
        body="Reminder to log your weight today.",
        notification_type="HealthReminder",
        link_url=f"/health/log?date={run_date.isoformat()}",
        action_label="Open log",
        source_module="health",
        source_id=f"reminder:{run_date.isoformat()}:{run_time}:weight",
    )


def RunDailyHealthReminders(
    db: Session,
    admin_user_id: int,
    run_date: date | None = None,
    run_time: str | None = None,
) -> dict:
    now = NowUtc()
    parent_users = db.query(User).filter(User.Role == "Parent").all()
    parent_ids = [user.Id for user in parent_users]
    settings_rows = (
        db.query(TaskSettings)
        .filter(TaskSettings.UserId.in_(parent_ids))
        .all()
        if parent_ids
        else []
    )
    timezone_by_user_id = {
        row.UserId: row.OverdueReminderTimeZone for row in settings_rows if row.OverdueReminderTimeZone
    }

    eligible_users = 0
    processed_users = 0
    notifications_sent = 0
    skipped = 0
    errors = 0

    for user in parent_users:
        settings = EnsureSettingsForUser(db, user.Id)
        effective_zone = _ResolveRunZone(
            timezone_by_user_id.get(user.Id) or settings.ReminderTimeZone
        )
        effective_date, effective_time = _ResolveEffectiveRunDateTime(
            now_utc=now,
            run_date=run_date,
            run_time=run_time,
            run_zone=effective_zone,
        )
        legacy_times = _ParseFoodReminderTimes(settings.FoodReminderTimes)
        food_slots = _ParseFoodReminderSlots(
            settings.FoodReminderSlots,
            legacy_enabled=bool(settings.FoodRemindersEnabled),
            legacy_times=legacy_times,
        )
        weight_time = settings.WeightReminderTime or DefaultWeightReminderTime

        user_eligible = False
        user_processed = False

        try:
            for meal_type, slot in food_slots.items():
                if not bool(slot.get("Enabled")):
                    continue
                reminder_time = str(slot.get("Time") or "")
                if not _TimeMatches(effective_time, reminder_time):
                    continue
                user_eligible = True
                user_processed = True
                reminder_type = "Meal"
                if _AlreadyRan(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    reminder_type,
                    meal_type,
                ):
                    skipped += 1
                    continue
                if _HasMealEntry(db, user.Id, effective_date, meal_type):
                    _RecordRun(
                        db,
                        user.Id,
                        effective_date,
                        effective_time,
                        reminder_type,
                        meal_type,
                        result="skipped",
                        notification_sent=False,
                    )
                    skipped += 1
                    continue
                _SendMealReminder(
                    db,
                    admin_user_id,
                    user.Id,
                    effective_date,
                    effective_time,
                    meal_type,
                )
                _RecordRun(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    reminder_type,
                    meal_type,
                    result="sent",
                    notification_sent=True,
                )
                notifications_sent += 1

            if settings.WeightRemindersEnabled and _TimeMatches(effective_time, weight_time):
                user_eligible = True
                user_processed = True
                reminder_type = "Weight"
                meal_type = ""
                if _AlreadyRan(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    reminder_type,
                    meal_type,
                ):
                    skipped += 1
                    continue
                if _HasWeightEntry(db, user.Id, effective_date):
                    _RecordRun(
                        db,
                        user.Id,
                        effective_date,
                        effective_time,
                        reminder_type,
                        meal_type,
                        result="skipped",
                        notification_sent=False,
                    )
                    skipped += 1
                    continue
                _SendWeightReminder(
                    db,
                    admin_user_id,
                    user.Id,
                    effective_date,
                    effective_time,
                )
                _RecordRun(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    reminder_type,
                    meal_type,
                    result="sent",
                    notification_sent=True,
                )
                notifications_sent += 1

        except Exception as exc:  # noqa: BLE001
            logger.exception("Health reminder run failed for user %s", user.Id)
            errors += 1
            if user_processed:
                _RecordRun(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    reminder_type="Error",
                    meal_type="",
                    result="error",
                    notification_sent=False,
                    error_message=str(exc),
                )

        if user_eligible:
            eligible_users += 1
        if user_processed:
            processed_users += 1

    return {
        "EligibleUsers": eligible_users,
        "ProcessedUsers": processed_users,
        "NotificationsSent": notifications_sent,
        "Skipped": skipped,
        "Errors": errors,
    }


def _EnvBool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return default


def _EnvTime(name: str, default: str) -> str:
    normalized = _NormalizeTime(os.getenv(name, "").strip() or None)
    return normalized or default


def YesterdayReminderTimeForDate(run_date: date) -> str:
    """Return the local send time for the day the reminder fires."""
    if run_date.weekday() >= 5:
        return _EnvTime("HEALTH_YESTERDAY_REMINDER_WEEKEND_TIME", DefaultYesterdayWeekendTime)
    return _EnvTime("HEALTH_YESTERDAY_REMINDER_WEEKDAY_TIME", DefaultYesterdayWeekdayTime)


def _MissingMainMeals(db: Session, user_id: int, log_date: date) -> list[str]:
    log = _GetDailyLog(db, user_id, log_date)
    if not log:
        return list(MainMealTypes)
    logged = {
        row[0]
        for row in db.query(MealEntry.MealType)
        .filter(MealEntry.DailyLogId == log.DailyLogId)
        .distinct()
        .all()
    }
    return [meal_type for meal_type in MainMealTypes if meal_type not in logged]


def _FormatMissingMealList(missing: list[str]) -> str:
    labels = [_FormatMealLabel(meal_type) for meal_type in missing]
    if len(labels) == 1:
        return labels[0]
    return f"{', '.join(labels[:-1])} and {labels[-1]}"


def FormatYesterdayReminderMessage(log_date: date, missing: list[str]) -> str:
    """Build the Discord message body for an incomplete previous day."""
    day_text = f"{log_date.strftime('%A')} {log_date.day} {log_date.strftime('%B')}"
    base_url = (
        os.getenv("HEALTH_DASHBOARD_BASE_URL", "").strip() or DefaultHealthDashboardBaseUrl
    ).rstrip("/")
    return (
        f"**Yesterday's log is incomplete** ({day_text})\n"
        f"Not logged: {_FormatMissingMealList(missing)}\n"
        f"{base_url}/log?date={log_date.isoformat()}"
    )


def RunYesterdayLogReminders(
    db: Session,
    run_date: date | None = None,
    run_time: str | None = None,
) -> dict:
    """Send each parent a Discord reminder when their previous day is missing main meals.

    Fires once per user per day, at 07:00 local on weekdays and 09:00 local at weekends.
    Only Breakfast, Lunch, and Dinner are considered; snacks are ignored.
    """
    if not _EnvBool("HEALTH_YESTERDAY_REMINDER_ENABLED", True):
        return {
            "EligibleUsers": 0,
            "ProcessedUsers": 0,
            "NotificationsSent": 0,
            "Skipped": 0,
            "Errors": 0,
        }

    now = NowUtc()
    parent_users = db.query(User).filter(User.Role == "Parent").all()
    parent_ids = [user.Id for user in parent_users]
    settings_rows = (
        db.query(TaskSettings).filter(TaskSettings.UserId.in_(parent_ids)).all()
        if parent_ids
        else []
    )
    timezone_by_user_id = {
        row.UserId: row.OverdueReminderTimeZone
        for row in settings_rows
        if row.OverdueReminderTimeZone
    }

    eligible_users = 0
    processed_users = 0
    notifications_sent = 0
    skipped = 0
    errors = 0

    for user in parent_users:
        settings = EnsureSettingsForUser(db, user.Id)
        effective_zone = _ResolveRunZone(
            timezone_by_user_id.get(user.Id) or settings.ReminderTimeZone
        )
        effective_date, effective_time = _ResolveEffectiveRunDateTime(
            now_utc=now,
            run_date=run_date,
            run_time=run_time,
            run_zone=effective_zone,
        )
        if not _TimeMatches(effective_time, YesterdayReminderTimeForDate(effective_date)):
            continue

        eligible_users += 1
        processed_users += 1
        log_date = effective_date - timedelta(days=1)

        if _AlreadyRan(db, user.Id, effective_date, effective_time, YesterdayReminderType, ""):
            skipped += 1
            continue

        try:
            webhook_url = ResolveWebhookUrl(user.Id, user.Username)
            if not webhook_url:
                logger.warning(
                    "No Discord webhook configured for user %s, skipping yesterday reminder",
                    user.Id,
                )
                _RecordRun(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    YesterdayReminderType,
                    "",
                    result="unconfigured",
                    notification_sent=False,
                    error_message="No Discord webhook configured for this user.",
                )
                skipped += 1
                continue

            missing = _MissingMainMeals(db, user.Id, log_date)
            if not missing:
                _RecordRun(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    YesterdayReminderType,
                    "",
                    result="skipped",
                    notification_sent=False,
                )
                skipped += 1
                continue

            SendDiscordMessage(webhook_url, FormatYesterdayReminderMessage(log_date, missing))
            _RecordRun(
                db,
                user.Id,
                effective_date,
                effective_time,
                YesterdayReminderType,
                "",
                result="sent",
                notification_sent=True,
            )
            notifications_sent += 1

        except Exception as exc:  # noqa: BLE001
            logger.exception("Yesterday log reminder failed for user %s", user.Id)
            errors += 1
            # Record under "Error" rather than the reminder type, so a transient
            # Discord failure does not consume this user's slot for the day and
            # a later scheduler tick can still deliver the reminder. Retrying
            # within the same minute would collide on the run's unique key, so
            # only the first failure of that minute is recorded.
            if not _AlreadyRan(db, user.Id, effective_date, effective_time, "Error", ""):
                _RecordRun(
                    db,
                    user.Id,
                    effective_date,
                    effective_time,
                    reminder_type="Error",
                    meal_type="",
                    result="error",
                    notification_sent=False,
                    error_message=str(exc),
                )

    return {
        "EligibleUsers": eligible_users,
        "ProcessedUsers": processed_users,
        "NotificationsSent": notifications_sent,
        "Skipped": skipped,
        "Errors": errors,
    }
