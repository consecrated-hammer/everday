from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import calendar
import re
from typing import Iterable
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc, UserContext
from app.modules.auth.models import User
from app.modules.notifications.services import CreateNotificationsForUsers
from app.modules.auth.models import User
from app.modules.tasks.models import Task, TaskAssignee, TaskList, TaskSettings, TaskTag, TaskTagLink
from app.modules.tasks.utils.rbac import CanAccessTask, CanReassignTask, IsAdmin
from app.services.schedules import AddMonths, AddYears


DEFAULT_TIMEZONE = "UTC"
DEFAULT_OVERDUE_REMINDER_TIME = "08:00"
DEFAULT_OVERDUE_REMINDER_TIMEZONE = "UTC"


class TaskAccessError(ValueError):
    pass


class TaskNotFoundError(ValueError):
    pass


@dataclass
class TaskCompletionResult:
    Task: Task
    NextTask: Task | None = None


@dataclass
class TaskNotificationResult:
    RemindersSent: int
    OverdueSent: int


@dataclass
class TaskDecorated:
    Task: Task
    OwnerName: str | None
    CreatedByName: str | None
    ListName: str | None
    TagNames: list[str]
    Assignees: list[dict]


_WEEKDAY_PATTERN = re.compile(r"^\d$")


def _DisplayName(user: User | None) -> str | None:
    if not user:
        return None
    if user.FirstName:
        return user.FirstName.strip()
    if user.LastName:
        return user.LastName.strip()
    return user.Username


def _NormalizeName(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _BuildDefaultListName(user: User | None) -> str:
    base = _DisplayName(user) or "My"
    return f"{base}'s list"


def _NormalizeSlug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or "tag"


def _EnsureUniqueTagSlug(db: Session, owner_user_id: int, base_slug: str) -> str:
    slug = base_slug
    suffix = 2
    while True:
        exists = (
            db.query(TaskTag)
            .filter(TaskTag.OwnerUserId == owner_user_id, func.lower(TaskTag.Slug) == slug.lower())
            .first()
        )
        if not exists:
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


def _ParseWeekdays(value: str | None) -> list[int]:
    if not value:
        return []
    parts = [part.strip() for part in value.split(",") if part.strip()]
    values = []
    for part in parts:
        if not _WEEKDAY_PATTERN.match(part):
            continue
        number = int(part)
        if 0 <= number <= 6:
            values.append(number)
    return sorted({*values})


def _SerializeWeekdays(values: Iterable[int] | None) -> str | None:
    if not values:
        return None
    cleaned = []
    for value in values:
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if 0 <= number <= 6:
            cleaned.append(number)
    if not cleaned:
        return None
    return ",".join(str(value) for value in sorted(set(cleaned)))


def _DaysInMonth(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _ResolveTimezone(value: str | None) -> ZoneInfo:
    if not value:
        return ZoneInfo(DEFAULT_TIMEZONE)
    try:
        return ZoneInfo(value)
    except Exception:  # noqa: BLE001
        return ZoneInfo(DEFAULT_TIMEZONE)


def _ParseTime(value: str | None) -> time:
    if not value:
        return time(0, 0)
    parts = value.split(":")
    if len(parts) < 2:
        return time(0, 0)
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError:
        return time(0, 0)
    hour = max(0, min(hour, 23))
    minute = max(0, min(minute, 59))
    return time(hour, minute)


def _NormalizeReminderTime(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    parts = cleaned.split(":")
    if len(parts) != 2:
        raise ValueError("Reminder time must be in HH:MM format.")
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError as exc:
        raise ValueError("Reminder time must be in HH:MM format.") from exc
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Reminder time must be between 00:00 and 23:59.")
    return f"{hour:02d}:{minute:02d}"


def _ResolveReminderTime(value: str | None) -> time:
    normalized = value or DEFAULT_OVERDUE_REMINDER_TIME
    try:
        return _ParseTime(normalized)
    except Exception:  # noqa: BLE001
        return _ParseTime(DEFAULT_OVERDUE_REMINDER_TIME)


def _NormalizeReminderTimeZone(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    try:
        ZoneInfo(cleaned)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Reminder time zone is invalid.") from exc
    return cleaned


def _ResolveReminderTimeZone(value: str | None) -> ZoneInfo:
    candidate = value or DEFAULT_OVERDUE_REMINDER_TIMEZONE
    try:
        return ZoneInfo(candidate)
    except Exception:  # noqa: BLE001
        return ZoneInfo(DEFAULT_OVERDUE_REMINDER_TIMEZONE)


def _BuildLocalDatetime(date_value: date | None, time_value: str | None, tz_name: str | None) -> datetime | None:
    if not date_value:
        return None
    tz = _ResolveTimezone(tz_name)
    local_time = _ParseTime(time_value)
    return datetime.combine(date_value, local_time, tzinfo=tz)


def _ComputeReminderOffsetMinutes(start_at: datetime | None, reminder_at: datetime | None) -> int | None:
    if not start_at or not reminder_at:
        return None
    delta = start_at - reminder_at
    return int(delta.total_seconds() // 60)


def _ComputeNextWeeklyDate(
    start_date: date,
    interval: int,
    weekdays: list[int],
) -> date:
    if interval < 1:
        interval = 1
    if not weekdays:
        return start_date + timedelta(days=interval * 7)
    ordered = sorted(set(weekdays))
    current_weekday = start_date.weekday()
    for weekday in ordered:
        if weekday > current_weekday:
            return start_date + timedelta(days=weekday - current_weekday)
    start_of_week = start_date - timedelta(days=current_weekday)
    next_week_start = start_of_week + timedelta(days=interval * 7)
    return next_week_start + timedelta(days=ordered[0])


def _ComputeNextMonthlyDate(start_date: date, interval: int, month_day: int | None) -> date:
    if interval < 1:
        interval = 1
    target_day = month_day or start_date.day
    candidate = AddMonths(start_date, interval)
    days_in_month = _DaysInMonth(candidate.year, candidate.month)
    day = min(target_day, days_in_month)
    return date(candidate.year, candidate.month, day)


def _ComputeNextYearlyDate(start_date: date, interval: int, month_day: int | None) -> date:
    if interval < 1:
        interval = 1
    target_day = month_day or start_date.day
    candidate = AddYears(start_date, interval)
    days_in_month = _DaysInMonth(candidate.year, candidate.month)
    day = min(target_day, days_in_month)
    return date(candidate.year, candidate.month, day)


def ComputeNextOccurrenceDate(
    start_date: date,
    repeat_type: str,
    interval: int,
    weekdays: list[int],
    month_day: int | None,
) -> date | None:
    normalized = (repeat_type or "none").lower()
    if normalized == "none":
        return None
    if normalized == "daily":
        return start_date + timedelta(days=max(interval, 1))
    if normalized == "weekly":
        return _ComputeNextWeeklyDate(start_date, interval, weekdays)
    if normalized == "monthly":
        return _ComputeNextMonthlyDate(start_date, interval, month_day)
    if normalized == "yearly":
        return _ComputeNextYearlyDate(start_date, interval, month_day)
    return None


def _ResolveList(db: Session, owner_user_id: int, name: str | None) -> TaskList | None:
    if not name:
        return None
    cleaned = _NormalizeName(name)
    if not cleaned:
        return None
    existing = (
        db.query(TaskList)
        .filter(TaskList.OwnerUserId == owner_user_id, func.lower(TaskList.Name) == cleaned.lower())
        .first()
    )
    if existing:
        return existing
    now = NowUtc()
    record = TaskList(
        OwnerUserId=owner_user_id,
        Name=cleaned,
        IsShared=False,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.flush()
    return record


def _ResolveTags(db: Session, owner_user_id: int, tag_names: Iterable[str]) -> list[TaskTag]:
    unique = []
    seen = set()
    for name in tag_names:
        if not name:
            continue
        for part in str(name).split(","):
            cleaned = _NormalizeName(part)
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(cleaned)
    if not unique:
        return []
    existing = (
        db.query(TaskTag)
        .filter(TaskTag.OwnerUserId == owner_user_id, func.lower(TaskTag.Name).in_([n.lower() for n in unique]))
        .all()
    )
    existing_map = {tag.Name.lower(): tag for tag in existing}
    records = []
    now = NowUtc()
    for name in unique:
        existing_tag = existing_map.get(name.lower())
        if existing_tag:
            records.append(existing_tag)
            continue
        slug_base = _NormalizeSlug(name)
        slug = _EnsureUniqueTagSlug(db, owner_user_id, slug_base)
        record = TaskTag(
            OwnerUserId=owner_user_id,
            Name=name,
            Slug=slug,
            CreatedAt=now,
            UpdatedAt=now,
        )
        db.add(record)
        db.flush()
        records.append(record)
    return records


def _ResolveAssigneeIds(db: Session, user_ids: Iterable[int]) -> list[int]:
    unique_ids = sorted({int(value) for value in user_ids if value})
    if not unique_ids:
        return []
    found = db.query(User.Id).filter(User.Id.in_(unique_ids)).all()
    found_ids = {row.Id for row in found}
    if found_ids != set(unique_ids):
        raise ValueError("User not found")
    return unique_ids


def _FetchTaskAssigneeIds(db: Session, task_id: int) -> list[int]:
    rows = db.query(TaskAssignee.UserId).filter(TaskAssignee.TaskId == task_id).all()
    return [row.UserId for row in rows]


def _ValidateRepeatWeekdays(values: Iterable[int]) -> list[int]:
    cleaned = []
    for value in values:
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if 0 <= number <= 6:
            cleaned.append(number)
    return sorted(set(cleaned))


def _ValidateDateRange(start_date: date, end_date: date | None) -> None:
    if end_date and end_date < start_date:
        raise ValueError("End date must be on or after start date")


def _EnsureCanAccessTask(user: UserContext, task: Task, assignee_ids: set[int]) -> None:
    if not CanAccessTask(user, task.OwnerUserId, assignee_ids):
        raise TaskAccessError("Access denied")


def _EnsureCanReassign(user: UserContext, task: Task) -> None:
    if not CanReassignTask(user, task.OwnerUserId):
        raise TaskAccessError("Access denied")


def _EnsureCanManageList(user: UserContext, list_record: TaskList) -> None:
    if not IsAdmin(user) and list_record.OwnerUserId != user.Id:
        raise TaskAccessError("Access denied")


def _ApplyReminderFields(
    record: Task,
    start_date: date | None,
    start_time: str | None,
    time_zone: str | None,
    reminder_at: datetime | None,
    reminder_offset: int | None,
) -> None:
    start_at = _BuildLocalDatetime(start_date, start_time, time_zone)
    if reminder_offset is not None and start_at:
        reminder_at = start_at.astimezone(timezone.utc) - timedelta(minutes=reminder_offset)
    record.ReminderAt = reminder_at
    record.ReminderOffsetMinutes = reminder_offset
    if reminder_at and reminder_offset is None and start_at:
        record.ReminderOffsetMinutes = _ComputeReminderOffsetMinutes(
            start_at.astimezone(timezone.utc),
            reminder_at,
        )


def CreateTask(
    db: Session,
    user: UserContext,
    payload: dict,
) -> Task:
    title = _NormalizeName(payload.get("Title", ""))
    if not title:
        raise ValueError("Title required")
    start_date = payload.get("StartDate")
    if not start_date:
        raise ValueError("Start date required")
    end_date = payload.get("EndDate")
    _ValidateDateRange(start_date, end_date)

    repeat_interval = payload.get("RepeatInterval") or 1
    if repeat_interval < 1:
        raise ValueError("Repeat interval must be at least 1")
    repeat_weekdays = _ValidateRepeatWeekdays(payload.get("RepeatWeekdays") or [])

    list_record = _ResolveList(db, user.Id, payload.get("ListName"))
    tags = _ResolveTags(db, user.Id, payload.get("TagNames") or [])
    assignee_ids = _ResolveAssigneeIds(db, payload.get("AssigneeUserIds") or [])

    now = NowUtc()
    record = Task(
        Title=title,
        Description=payload.get("Description"),
        OwnerUserId=user.Id,
        CreatedByUserId=user.Id,
        ListId=list_record.Id if list_record else None,
        RelatedModule=payload.get("RelatedModule"),
        RelatedRecordId=payload.get("RelatedRecordId"),
        IsStarred=bool(payload.get("IsStarred")),
        IsCompleted=False,
        StartDate=start_date,
        StartTime=payload.get("StartTime"),
        EndDate=end_date,
        EndTime=payload.get("EndTime"),
        IsAllDay=bool(payload.get("IsAllDay")),
        TimeZone=payload.get("TimeZone"),
        RepeatType=(payload.get("RepeatType") or "none").value
        if hasattr(payload.get("RepeatType"), "value")
        else str(payload.get("RepeatType") or "none"),
        RepeatInterval=repeat_interval,
        RepeatWeekdays=_SerializeWeekdays(repeat_weekdays),
        RepeatMonthday=payload.get("RepeatMonthday"),
        RepeatUntilDate=payload.get("RepeatUntilDate"),
        CreatedAt=now,
        UpdatedAt=now,
    )
    _ApplyReminderFields(
        record,
        start_date,
        payload.get("StartTime"),
        payload.get("TimeZone"),
        payload.get("ReminderAt"),
        payload.get("ReminderOffsetMinutes"),
    )

    db.add(record)
    db.flush()

    if tags:
        db.add_all([TaskTagLink(TaskId=record.Id, TagId=tag.Id) for tag in tags])

    for assignee_id in assignee_ids:
        db.add(
            TaskAssignee(
                TaskId=record.Id,
                UserId=assignee_id,
                AssignedByUserId=user.Id,
                AssignedAt=now,
            )
        )

    db.commit()
    db.refresh(record)
    return record


def UpdateTask(
    db: Session,
    user: UserContext,
    task_id: int,
    payload: dict,
) -> Task:
    record = db.query(Task).filter(Task.Id == task_id).first()
    if not record:
        raise TaskNotFoundError("Task not found")
    _EnsureCanReassign(user, record)

    data = payload
    now = NowUtc()

    if "Title" in data and data["Title"] is not None:
        title = _NormalizeName(data["Title"])
        if not title:
            raise ValueError("Title required")
        record.Title = title
    if "Description" in data:
        record.Description = data.get("Description")
    if "StartDate" in data and data["StartDate"] is not None:
        record.StartDate = data["StartDate"]
    if "StartTime" in data:
        record.StartTime = data.get("StartTime")
    if "EndDate" in data:
        record.EndDate = data.get("EndDate")
    if "EndTime" in data:
        record.EndTime = data.get("EndTime")
    if "IsAllDay" in data and data["IsAllDay"] is not None:
        record.IsAllDay = bool(data["IsAllDay"])
    if "TimeZone" in data:
        record.TimeZone = data.get("TimeZone")
    if "IsStarred" in data and data["IsStarred"] is not None:
        record.IsStarred = bool(data["IsStarred"])
    if "IsCompleted" in data and data["IsCompleted"] is not None:
        if data["IsCompleted"] and not record.IsCompleted:
            raise ValueError("Use complete endpoint to finish tasks")
        if not data["IsCompleted"] and record.IsCompleted:
            record.IsCompleted = False
            record.CompletedAt = None
            record.CompletedByUserId = None
    if "RelatedModule" in data:
        record.RelatedModule = data.get("RelatedModule")
    if "RelatedRecordId" in data:
        record.RelatedRecordId = data.get("RelatedRecordId")

    if "RepeatType" in data and data["RepeatType"] is not None:
        value = data["RepeatType"]
        record.RepeatType = value.value if hasattr(value, "value") else str(value)
    if "RepeatInterval" in data and data["RepeatInterval"] is not None:
        if data["RepeatInterval"] < 1:
            raise ValueError("Repeat interval must be at least 1")
        record.RepeatInterval = data["RepeatInterval"]
    if "RepeatWeekdays" in data:
        record.RepeatWeekdays = _SerializeWeekdays(_ValidateRepeatWeekdays(data.get("RepeatWeekdays") or []))
    if "RepeatMonthday" in data:
        record.RepeatMonthday = data.get("RepeatMonthday")
    if "RepeatUntilDate" in data:
        record.RepeatUntilDate = data.get("RepeatUntilDate")

    _ValidateDateRange(record.StartDate, record.EndDate)

    if "ListName" in data:
        list_record = _ResolveList(db, record.OwnerUserId, data.get("ListName"))
        record.ListId = list_record.Id if list_record else None

    if "TagNames" in data:
        tags = _ResolveTags(db, record.OwnerUserId, data.get("TagNames") or [])
        db.query(TaskTagLink).filter(TaskTagLink.TaskId == record.Id).delete()
        db.flush()
        if tags:
            db.add_all([TaskTagLink(TaskId=record.Id, TagId=tag.Id) for tag in tags])

    if "AssigneeUserIds" in data:
        assignee_ids = _ResolveAssigneeIds(db, data.get("AssigneeUserIds") or [])
        db.query(TaskAssignee).filter(TaskAssignee.TaskId == record.Id).delete()
        db.flush()
        for assignee_id in assignee_ids:
            db.add(
                TaskAssignee(
                    TaskId=record.Id,
                    UserId=assignee_id,
                    AssignedByUserId=user.Id,
                    AssignedAt=now,
                )
            )

    if "ReminderAt" in data or "ReminderOffsetMinutes" in data:
        _ApplyReminderFields(
            record,
            record.StartDate,
            record.StartTime,
            record.TimeZone,
            data.get("ReminderAt"),
            data.get("ReminderOffsetMinutes"),
        )
        record.ReminderSentAt = None
        record.SnoozedUntil = None

    record.UpdatedAt = now
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _BuildNextTask(
    db: Session,
    record: Task,
    completed_by_user_id: int,
) -> Task | None:
    repeat_weekdays = _ParseWeekdays(record.RepeatWeekdays)
    next_date = ComputeNextOccurrenceDate(
        record.StartDate,
        record.RepeatType,
        record.RepeatInterval,
        repeat_weekdays,
        record.RepeatMonthday,
    )
    if not next_date:
        return None
    if record.RepeatUntilDate and next_date > record.RepeatUntilDate:
        return None

    duration_days = 0
    if record.EndDate:
        duration_days = (record.EndDate - record.StartDate).days
    next_end_date = next_date + timedelta(days=duration_days) if record.EndDate else None

    now = NowUtc()
    series_id = record.SeriesId or str(uuid4())
    record.SeriesId = series_id

    next_task = Task(
        SeriesId=series_id,
        Title=record.Title,
        Description=record.Description,
        OwnerUserId=record.OwnerUserId,
        CreatedByUserId=record.CreatedByUserId,
        ListId=record.ListId,
        RelatedModule=record.RelatedModule,
        RelatedRecordId=record.RelatedRecordId,
        IsStarred=record.IsStarred,
        IsCompleted=False,
        StartDate=next_date,
        StartTime=record.StartTime,
        EndDate=next_end_date,
        EndTime=record.EndTime,
        IsAllDay=record.IsAllDay,
        TimeZone=record.TimeZone,
        RepeatType=record.RepeatType,
        RepeatInterval=record.RepeatInterval,
        RepeatWeekdays=record.RepeatWeekdays,
        RepeatMonthday=record.RepeatMonthday,
        RepeatUntilDate=record.RepeatUntilDate,
        ReminderOffsetMinutes=record.ReminderOffsetMinutes,
        CreatedAt=now,
        UpdatedAt=now,
    )

    _ApplyReminderFields(
        next_task,
        next_task.StartDate,
        next_task.StartTime,
        next_task.TimeZone,
        None,
        record.ReminderOffsetMinutes,
    )

    db.add(next_task)
    db.flush()

    tag_links = db.query(TaskTagLink).filter(TaskTagLink.TaskId == record.Id).all()
    if tag_links:
        db.add_all([TaskTagLink(TaskId=next_task.Id, TagId=link.TagId) for link in tag_links])

    assignees = db.query(TaskAssignee).filter(TaskAssignee.TaskId == record.Id).all()
    for assignee in assignees:
        db.add(
            TaskAssignee(
                TaskId=next_task.Id,
                UserId=assignee.UserId,
                AssignedByUserId=completed_by_user_id,
                AssignedAt=now,
            )
        )

    return next_task


def CompleteTask(db: Session, user: UserContext, task_id: int) -> TaskCompletionResult:
    record = db.query(Task).filter(Task.Id == task_id).first()
    if not record:
        raise TaskNotFoundError("Task not found")
    assignee_ids = set(_FetchTaskAssigneeIds(db, task_id))
    _EnsureCanAccessTask(user, record, assignee_ids)
    if record.IsCompleted:
        return TaskCompletionResult(Task=record)
    now = NowUtc()
    record.IsCompleted = True
    record.CompletedAt = now
    record.CompletedByUserId = user.Id
    record.UpdatedAt = now

    next_task = _BuildNextTask(db, record, user.Id)
    db.add(record)
    db.commit()
    db.refresh(record)
    if next_task:
        db.refresh(next_task)
    return TaskCompletionResult(Task=record, NextTask=next_task)


def SnoozeTask(db: Session, user: UserContext, task_id: int, minutes: int | None, until: datetime | None) -> Task:
    record = db.query(Task).filter(Task.Id == task_id).first()
    if not record:
        raise TaskNotFoundError("Task not found")
    assignee_ids = set(_FetchTaskAssigneeIds(db, task_id))
    _EnsureCanAccessTask(user, record, assignee_ids)
    now = NowUtc()
    if until:
        record.SnoozedUntil = until
    elif minutes is not None:
        record.SnoozedUntil = now + timedelta(minutes=minutes)
    else:
        raise ValueError("Snooze time required")
    record.UpdatedAt = now
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteTask(db: Session, user: UserContext, task_id: int) -> None:
    record = db.query(Task).filter(Task.Id == task_id).first()
    if not record:
        raise TaskNotFoundError("Task not found")
    _EnsureCanReassign(user, record)
    db.query(TaskTagLink).filter(TaskTagLink.TaskId == record.Id).delete()
    db.query(TaskAssignee).filter(TaskAssignee.TaskId == record.Id).delete()
    db.delete(record)
    db.commit()


def ListTaskLists(db: Session, user: UserContext) -> list[TaskList]:
    query = db.query(TaskList)
    if not IsAdmin(user):
        query = query.filter(TaskList.OwnerUserId == user.Id)
    return query.order_by(TaskList.Name.asc()).all()


def CreateTaskList(db: Session, user: UserContext, name: str, is_shared: bool) -> TaskList:
    record = _ResolveList(db, user.Id, name)
    if not record:
        raise ValueError("List name required")
    record.IsShared = bool(is_shared)
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateTaskList(db: Session, user: UserContext, list_id: int, name: str) -> TaskList:
    record = db.query(TaskList).filter(TaskList.Id == list_id).first()
    if not record:
        raise TaskNotFoundError("List not found")
    _EnsureCanManageList(user, record)
    cleaned = _NormalizeName(name)
    if not cleaned:
        raise ValueError("List name required")
    existing = (
        db.query(TaskList)
        .filter(
            TaskList.OwnerUserId == record.OwnerUserId,
            func.lower(TaskList.Name) == cleaned.lower(),
            TaskList.Id != record.Id,
        )
        .first()
    )
    if existing:
        raise ValueError("List name already exists")
    record.Name = cleaned
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteTaskList(db: Session, user: UserContext, list_id: int) -> tuple[int, TaskList | None]:
    record = db.query(TaskList).filter(TaskList.Id == list_id).first()
    if not record:
        raise TaskNotFoundError("List not found")
    _EnsureCanManageList(user, record)

    tasks_query = db.query(Task).filter(Task.ListId == record.Id)
    reassigned_count = tasks_query.count()
    destination = None
    if reassigned_count:
        destination = (
            db.query(TaskList)
            .filter(TaskList.OwnerUserId == record.OwnerUserId, TaskList.Id != record.Id)
            .order_by(TaskList.Name.asc())
            .first()
        )
        if not destination:
            owner = db.query(User).filter(User.Id == record.OwnerUserId).first()
            default_name = _BuildDefaultListName(owner)
            if default_name.lower() == record.Name.lower():
                default_name = "My list"
            destination = _ResolveList(db, record.OwnerUserId, default_name)
        tasks_query.update({Task.ListId: destination.Id}, synchronize_session=False)

    db.delete(record)
    db.commit()
    return reassigned_count, destination


def ListTaskTags(db: Session, user: UserContext) -> list[TaskTag]:
    query = db.query(TaskTag)
    if not IsAdmin(user):
        query = query.filter(TaskTag.OwnerUserId == user.Id)
    return query.order_by(TaskTag.Name.asc()).all()


def CreateTaskTag(db: Session, user: UserContext, name: str) -> TaskTag:
    tags = _ResolveTags(db, user.Id, [name])
    if not tags:
        raise ValueError("Tag name required")
    record = tags[0]
    db.commit()
    db.refresh(record)
    return record


def _BuildTaskQuery(db: Session, user: UserContext):
    query = db.query(Task)
    if IsAdmin(user):
        return query
    return (
        query.join(
            TaskAssignee,
            TaskAssignee.TaskId == Task.Id,
            isouter=True,
        )
        .filter(or_(Task.OwnerUserId == user.Id, TaskAssignee.UserId == user.Id))
        .distinct()
    )


def _IsTaskInTodayWindow(task: Task, now_utc: datetime) -> bool:
    tz = _ResolveTimezone(task.TimeZone)
    local_today = now_utc.astimezone(tz).date()
    if task.StartDate > local_today:
        return False
    if task.EndDate and task.EndDate < local_today:
        return False
    return True


def _IsTaskOverdue(task: Task, now_utc: datetime) -> bool:
    if not task.EndDate:
        return False
    tz = _ResolveTimezone(task.TimeZone)
    local_today = now_utc.astimezone(tz).date()
    return task.EndDate < local_today


def ListTasks(db: Session, user: UserContext, view: str) -> list[Task]:
    query = _BuildTaskQuery(db, user)
    now_utc = NowUtc()
    today = now_utc.date()
    normalized = (view or "today").lower()
    if normalized == "completed":
        query = query.filter(Task.IsCompleted == True)  # noqa: E712
        query = query.order_by(Task.CompletedAt.desc())
    elif normalized == "upcoming":
        query = query.filter(Task.IsCompleted == False, Task.StartDate > today)  # noqa: E712
        query = query.order_by(Task.StartDate.asc())
    elif normalized == "open":
        query = query.filter(Task.IsCompleted == False)  # noqa: E712
        query = query.order_by(Task.StartDate.asc())
    elif normalized == "starred":
        query = query.filter(Task.IsCompleted == False, Task.IsStarred == True)  # noqa: E712
        query = query.order_by(Task.StartDate.asc())
    elif normalized == "overdue":
        query = query.filter(Task.IsCompleted == False, Task.EndDate != None)  # noqa: E712,E711
        query = query.order_by(Task.EndDate.asc())
    else:
        query = query.filter(Task.IsCompleted == False)  # noqa: E712
        query = query.order_by(Task.StartDate.asc())
    records = query.all()
    if normalized == "today":
        return [task for task in records if _IsTaskInTodayWindow(task, now_utc)]
    if normalized == "overdue":
        return [task for task in records if _IsTaskOverdue(task, now_utc)]
    return records


def DecorateTasks(db: Session, tasks: list[Task]) -> list[TaskDecorated]:
    if not tasks:
        return []
    task_ids = [task.Id for task in tasks]
    user_ids = {task.OwnerUserId for task in tasks} | {task.CreatedByUserId for task in tasks}

    assignee_rows = db.query(TaskAssignee).filter(TaskAssignee.TaskId.in_(task_ids)).all()
    assignee_user_ids = {row.UserId for row in assignee_rows}
    user_ids |= assignee_user_ids
    users = db.query(User).filter(User.Id.in_(user_ids)).all()
    name_map = {user.Id: _DisplayName(user) for user in users}

    list_ids = {task.ListId for task in tasks if task.ListId}
    lists = db.query(TaskList).filter(TaskList.Id.in_(list_ids)).all() if list_ids else []
    list_map = {entry.Id: entry.Name for entry in lists}

    tag_links = db.query(TaskTagLink).filter(TaskTagLink.TaskId.in_(task_ids)).all()
    tag_ids = {link.TagId for link in tag_links}
    tags = db.query(TaskTag).filter(TaskTag.Id.in_(tag_ids)).all() if tag_ids else []
    tag_map = {tag.Id: tag.Name for tag in tags}

    tag_by_task: dict[int, list[str]] = {}
    for link in tag_links:
        tag_by_task.setdefault(link.TaskId, []).append(tag_map.get(link.TagId, ""))

    assignees_by_task: dict[int, list[dict]] = {}
    for row in assignee_rows:
        assignees_by_task.setdefault(row.TaskId, []).append(
            {"UserId": row.UserId, "Name": name_map.get(row.UserId)}
        )

    decorated = []
    for task in tasks:
        decorated.append(
            TaskDecorated(
                Task=task,
                OwnerName=name_map.get(task.OwnerUserId),
                CreatedByName=name_map.get(task.CreatedByUserId),
                ListName=list_map.get(task.ListId),
                TagNames=[name for name in tag_by_task.get(task.Id, []) if name],
                Assignees=assignees_by_task.get(task.Id, []),
            )
        )
    return decorated


def RunTaskNotifications(db: Session, user: UserContext, limit: int = 200) -> TaskNotificationResult:
    if not IsAdmin(user):
        raise TaskAccessError("Access denied")
    now = NowUtc()
    reminders = (
        db.query(Task)
        .filter(
            Task.IsCompleted == False,  # noqa: E712
            Task.ReminderAt != None,  # noqa: E711
            Task.ReminderSentAt == None,  # noqa: E711
            or_(Task.SnoozedUntil == None, Task.SnoozedUntil <= now),  # noqa: E711
            Task.ReminderAt <= now,
        )
        .order_by(Task.ReminderAt.asc())
        .limit(limit)
        .all()
    )

    reminders_sent = 0
    for task in reminders:
        assignee_ids = _FetchTaskAssigneeIds(db, task.Id)
        target_ids = set(assignee_ids) or {task.OwnerUserId}
        if task.OwnerUserId not in target_ids:
            target_ids.add(task.OwnerUserId)
        CreateNotificationsForUsers(
            db,
            user_ids=sorted(target_ids),
            created_by_user_id=user.Id,
            title="Task reminder",
            body=f"{task.Title} is due soon.",
            notification_type="TaskReminder",
            link_url="/tasks",
            source_module="tasks",
            source_id=str(task.Id),
        )
        task.ReminderSentAt = now
        task.UpdatedAt = now
        db.add(task)
        reminders_sent += 1

    overdue_tasks = (
        db.query(Task)
        .filter(
            Task.IsCompleted == False,  # noqa: E712
            Task.EndDate != None,  # noqa: E711
            Task.OverdueNotifiedAt == None,  # noqa: E711
            Task.EndDate < now.date(),
        )
        .order_by(Task.EndDate.asc())
        .limit(limit)
        .all()
    )

    overdue_sent = 0
    for task in overdue_tasks:
        assignee_ids = _FetchTaskAssigneeIds(db, task.Id)
        target_ids = set(assignee_ids) or {task.OwnerUserId}
        if task.OwnerUserId not in target_ids:
            target_ids.add(task.OwnerUserId)
        CreateNotificationsForUsers(
            db,
            user_ids=sorted(target_ids),
            created_by_user_id=user.Id,
            title="Task overdue",
            body=f"{task.Title} is overdue.",
            notification_type="TaskOverdue",
            link_url="/tasks",
            source_module="tasks",
            source_id=str(task.Id),
        )
        task.OverdueNotifiedAt = now
        task.UpdatedAt = now
        db.add(task)
        overdue_sent += 1

    db.commit()
    return TaskNotificationResult(RemindersSent=reminders_sent, OverdueSent=overdue_sent)


def GetTaskSettings(db: Session, user_id: int) -> TaskSettings | None:
    return db.query(TaskSettings).filter(TaskSettings.UserId == user_id).first()


def EnsureTaskSettings(db: Session, user_id: int, now: datetime) -> TaskSettings:
    record = GetTaskSettings(db, user_id)
    if record:
        return record
    record = TaskSettings(UserId=user_id, CreatedAt=now, UpdatedAt=now)
    db.add(record)
    return record


def ResolveTaskSettingsOutput(record: TaskSettings | None) -> dict:
    return {
        "OverdueReminderTime": (record.OverdueReminderTime if record else None) or DEFAULT_OVERDUE_REMINDER_TIME,
        "OverdueReminderTimeZone": (
            record.OverdueReminderTimeZone if record else None
        )
        or DEFAULT_OVERDUE_REMINDER_TIMEZONE,
        "OverdueLastNotifiedDate": record.OverdueLastNotifiedDate if record else None,
    }


def UpdateTaskSettings(db: Session, user_id: int, payload: dict) -> TaskSettings:
    now = NowUtc()
    record = GetTaskSettings(db, user_id)
    if not record:
        record = TaskSettings(UserId=user_id, CreatedAt=now, UpdatedAt=now)
    if "OverdueReminderTime" in payload:
        record.OverdueReminderTime = _NormalizeReminderTime(payload.get("OverdueReminderTime"))
    if "OverdueReminderTimeZone" in payload:
        record.OverdueReminderTimeZone = _NormalizeReminderTimeZone(
            payload.get("OverdueReminderTimeZone")
        )
    record.UpdatedAt = now
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def ResolveOverdueReminderTime(value: str | None) -> time:
    return _ResolveReminderTime(value)


def ResolveOverdueReminderTimeZone(value: str | None) -> ZoneInfo:
    return _ResolveReminderTimeZone(value)
