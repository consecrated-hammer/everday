from __future__ import annotations

import json
import logging
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.auth.models import User
from app.modules.health.models import DailyLog, HealthReminderRun, MealEntry
from app.modules.health.services.settings_service import EnsureSettingsForUser
from app.modules.health.utils.defaults import (
    DefaultFoodReminderTimes,
    DefaultWeightReminderTime,
)
from app.modules.notifications.services import CreateNotification

logger = logging.getLogger(__name__)

MealTypeLabels = {
    "Breakfast": "Breakfast",
    "Snack1": "Snack 1",
    "Lunch": "Lunch",
    "Snack2": "Snack 2",
    "Dinner": "Dinner",
    "Snack3": "Snack 3",
}


def _IsValidTime(value: str | None) -> bool:
    if not value:
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
    effective_date = run_date or now.date()
    if run_time is not None and not _IsValidTime(run_time):
        raise ValueError("Run time must be in HH:MM format.")
    effective_time = _NormalizeTime(run_time) if run_time else now.strftime("%H:%M")

    if not _IsValidTime(effective_time):
        raise ValueError("Run time must be in HH:MM format.")

    parent_users = db.query(User).filter(User.Role == "Parent").all()

    eligible_users = 0
    processed_users = 0
    notifications_sent = 0
    skipped = 0
    errors = 0

    for user in parent_users:
        settings = EnsureSettingsForUser(db, user.Id)
        food_times = _ParseFoodReminderTimes(settings.FoodReminderTimes)
        weight_time = settings.WeightReminderTime or DefaultWeightReminderTime

        user_eligible = False
        user_processed = False

        try:
            if settings.FoodRemindersEnabled:
                for meal_type, reminder_time in food_times.items():
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
