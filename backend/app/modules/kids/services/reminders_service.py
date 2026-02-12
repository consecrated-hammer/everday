from __future__ import annotations

import logging
import random
import re
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.auth.models import User
from app.modules.kids.models import Chore, ChoreAssignment, ChoreEntry, ReminderRun, ReminderSettings
from app.modules.kids.services.chores_v2_service import (
    ADL_TZ,
    CHORE_TYPE_DAILY,
    CHORE_TYPE_HABIT,
    IsAssignmentActiveOnDate,
    IsChoreActiveOnDate,
    STATUS_APPROVED,
    TodayAdelaide,
)
from app.modules.notifications.services import CreateNotification

logger = logging.getLogger("app.kids_reminders")

DEFAULT_REMINDER_TIME = "19:00"
DEFAULT_REMINDER_TIMEZONE = "Australia/Adelaide"

REMINDER_TYPE_DAILY = "DailyJobs"
REMINDER_TYPE_HABITS = "Habits"

REMINDER_EMOJIS = [
    "⭐️",
    "⚡️",
    "☀️",
    "☘️",
    "✈️",
    "⚽️",
    "⏰",
    "⌛️",
    "✅",
    "✨",
]


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


def EnsureReminderSettings(db: Session, kid_user_id: int) -> ReminderSettings:
    existing = db.query(ReminderSettings).filter(ReminderSettings.KidUserId == kid_user_id).first()
    if existing:
        return existing

    now = NowUtc()
    created = ReminderSettings(
        KidUserId=kid_user_id,
        DailyJobsRemindersEnabled=True,
        DailyJobsReminderTime=DEFAULT_REMINDER_TIME,
        HabitsRemindersEnabled=True,
        HabitsReminderTime=DEFAULT_REMINDER_TIME,
        ReminderTimeZone=DEFAULT_REMINDER_TIMEZONE,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return created


def UpdateReminderSettings(db: Session, kid_user_id: int, payload: dict) -> ReminderSettings:
    record = EnsureReminderSettings(db, kid_user_id)
    now = NowUtc()

    if "DailyJobsRemindersEnabled" in payload and payload.get("DailyJobsRemindersEnabled") is not None:
        record.DailyJobsRemindersEnabled = bool(payload.get("DailyJobsRemindersEnabled"))

    if "DailyJobsReminderTime" in payload and payload.get("DailyJobsReminderTime") is not None:
        normalized = _NormalizeTime(str(payload.get("DailyJobsReminderTime")))
        if not normalized:
            raise ValueError("Daily jobs reminder time must be in HH:MM format.")
        record.DailyJobsReminderTime = normalized

    if "HabitsRemindersEnabled" in payload and payload.get("HabitsRemindersEnabled") is not None:
        record.HabitsRemindersEnabled = bool(payload.get("HabitsRemindersEnabled"))

    if "HabitsReminderTime" in payload and payload.get("HabitsReminderTime") is not None:
        normalized = _NormalizeTime(str(payload.get("HabitsReminderTime")))
        if not normalized:
            raise ValueError("Habits reminder time must be in HH:MM format.")
        record.HabitsReminderTime = normalized

    record.UpdatedAt = now
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _AlreadyRan(
    db: Session,
    kid_user_id: int,
    run_date: date,
    run_time: str,
    reminder_type: str,
) -> bool:
    return (
        db.query(ReminderRun)
        .filter(
            ReminderRun.KidUserId == kid_user_id,
            ReminderRun.RunDate == run_date,
            ReminderRun.RunTime == run_time,
            ReminderRun.ReminderType == reminder_type,
        )
        .first()
        is not None
    )


def _RecordRun(
    db: Session,
    kid_user_id: int,
    run_date: date,
    run_time: str,
    reminder_type: str,
    result: str,
    notification_sent: bool,
    error_message: str | None = None,
) -> ReminderRun:
    record = ReminderRun(
        KidUserId=kid_user_id,
        RunDate=run_date,
        RunTime=run_time,
        ReminderType=reminder_type,
        Result=result,
        NotificationSent=notification_sent,
        ErrorMessage=(error_message or "")[:500] or None,
        CreatedAt=NowUtc(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _LoadActiveChoreIdsForType(
    db: Session,
    kid_user_id: int,
    on_date: date,
    chore_type: str,
) -> set[int]:
    assignments = db.query(ChoreAssignment).filter(ChoreAssignment.KidUserId == kid_user_id).all()
    chore_ids = {assignment.ChoreId for assignment in assignments}
    if not chore_ids:
        return set()
    chores = db.query(Chore).filter(Chore.Id.in_(chore_ids)).all()
    chore_map = {chore.Id: chore for chore in chores}

    active_ids: set[int] = set()
    for assignment in assignments:
        chore = chore_map.get(assignment.ChoreId)
        if not chore:
            continue
        if chore.Type != chore_type:
            continue
        if not IsChoreActiveOnDate(chore, on_date):
            continue
        if not IsAssignmentActiveOnDate(assignment, on_date):
            continue
        active_ids.add(chore.Id)
    return active_ids


def _LoadCompletedChoreIds(db: Session, kid_user_id: int, on_date: date) -> set[int]:
    entries = (
        db.query(ChoreEntry)
        .filter(
            ChoreEntry.KidUserId == kid_user_id,
            ChoreEntry.EntryDate == on_date,
            ChoreEntry.IsDeleted == False,  # noqa: E712
            ChoreEntry.Status == STATUS_APPROVED,
        )
        .all()
    )
    return {entry.ChoreId for entry in entries}


def _SendReminderNotification(
    db: Session,
    *,
    actor_user_id: int,
    kid_user_id: int,
    reminder_type: str,
    remaining_count: int,
    run_date: date,
    run_time: str,
) -> None:
    emoji = random.choice(REMINDER_EMOJIS)
    if reminder_type == REMINDER_TYPE_DAILY:
        title = f"{emoji} Daily jobs time!"
        body = f"You have {remaining_count} daily job{'s' if remaining_count != 1 else ''} left today. You can do this!"
        action_label = "Open daily jobs"
    else:
        title = f"{emoji} Habit check-in!"
        body = f"You have {remaining_count} habit{'s' if remaining_count != 1 else ''} left today. Keep your streak going!"
        action_label = "Open habits"

    CreateNotification(
        db,
        user_id=kid_user_id,
        created_by_user_id=actor_user_id,
        title=title,
        body=body,
        notification_type="KidsReminder",
        link_url="/kids",
        action_label=action_label,
        source_module="kids",
        source_id=f"kids-reminder:{run_date.isoformat()}:{run_time}:{reminder_type}",
    )


def RunDailyKidsReminders(
    db: Session,
    *,
    actor_user_id: int,
    run_date: date | None = None,
    run_time: str | None = None,
) -> dict:
    today = run_date or TodayAdelaide()
    if run_time is not None and not _IsValidTime(run_time):
        raise ValueError("Run time must be in HH:MM format.")
    current_adelaide_time = datetime.now(tz=ADL_TZ).strftime("%H:%M")
    effective_time = _NormalizeTime(run_time) if run_time else current_adelaide_time
    if not _IsValidTime(effective_time):
        raise ValueError("Run time must be in HH:MM format.")

    kids = db.query(User).filter(User.Role == "Kid").all()

    eligible_kids = 0
    processed_kids = 0
    notifications_sent = 0
    skipped = 0
    errors = 0

    for kid in kids:
        settings = EnsureReminderSettings(db, kid.Id)
        completed_ids = _LoadCompletedChoreIds(db, kid.Id, today)

        kid_eligible = False
        kid_processed = False

        jobs = [
            (
                REMINDER_TYPE_DAILY,
                CHORE_TYPE_DAILY,
                bool(settings.DailyJobsRemindersEnabled),
                settings.DailyJobsReminderTime,
            ),
            (
                REMINDER_TYPE_HABITS,
                CHORE_TYPE_HABIT,
                bool(settings.HabitsRemindersEnabled),
                settings.HabitsReminderTime,
            ),
        ]
        try:
            for reminder_type, chore_type, enabled, reminder_time in jobs:
                if not enabled:
                    continue
                time_matches = _TimeMatches(effective_time, reminder_time)
                if not time_matches:
                    continue
                kid_eligible = True
                kid_processed = True

                if _AlreadyRan(db, kid.Id, today, effective_time, reminder_type):
                    skipped += 1
                    continue

                active_ids = _LoadActiveChoreIdsForType(db, kid.Id, today, chore_type)
                if not active_ids:
                    _RecordRun(
                        db,
                        kid_user_id=kid.Id,
                        run_date=today,
                        run_time=effective_time,
                        reminder_type=reminder_type,
                        result="skipped",
                        notification_sent=False,
                    )
                    skipped += 1
                    continue

                remaining_count = len([chore_id for chore_id in active_ids if chore_id not in completed_ids])
                if remaining_count <= 0:
                    _RecordRun(
                        db,
                        kid_user_id=kid.Id,
                        run_date=today,
                        run_time=effective_time,
                        reminder_type=reminder_type,
                        result="skipped",
                        notification_sent=False,
                    )
                    skipped += 1
                    continue

                _SendReminderNotification(
                    db,
                    actor_user_id=actor_user_id,
                    kid_user_id=kid.Id,
                    reminder_type=reminder_type,
                    remaining_count=remaining_count,
                    run_date=today,
                    run_time=effective_time,
                )
                _RecordRun(
                    db,
                    kid_user_id=kid.Id,
                    run_date=today,
                    run_time=effective_time,
                    reminder_type=reminder_type,
                    result="sent",
                    notification_sent=True,
                )
                notifications_sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.exception("Kids reminder run failed for kid_user_id=%s", kid.Id)
            errors += 1
            if kid_processed:
                _RecordRun(
                    db,
                    kid_user_id=kid.Id,
                    run_date=today,
                    run_time=effective_time,
                    reminder_type="Error",
                    result="error",
                    notification_sent=False,
                    error_message=str(exc),
                )

        if kid_eligible:
            eligible_kids += 1
        if kid_processed:
            processed_kids += 1

    return {
        "EligibleKids": eligible_kids,
        "ProcessedKids": processed_kids,
        "NotificationsSent": notifications_sent,
        "Skipped": skipped,
        "Errors": errors,
    }
