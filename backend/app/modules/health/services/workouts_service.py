from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.modules.health.models import Workout as WorkoutModel
from app.modules.health.schemas import CreateWorkoutInput, Workout, WorkoutHistoryEntry
from app.modules.health.services.daily_logs_service import EnsureDailyLogForDate
from app.modules.health.utils.dates import ParseIsoDate


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _to_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric > 1_000_000_000_000:
            numeric /= 1000.0
        if numeric <= 0:
            return None
        return datetime.fromtimestamp(numeric, tz=timezone.utc)
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    normalized = cleaned[:-1] + "+00:00" if cleaned.endswith("Z") else cleaned
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def _SerializeWorkout(model: WorkoutModel) -> Workout:
    metadata = None
    if model.MetadataJson:
        try:
            metadata = json.loads(model.MetadataJson)
        except json.JSONDecodeError:
            metadata = None
    return Workout(
        WorkoutId=model.WorkoutId,
        LogDate=model.LogDate,
        WorkoutType=model.WorkoutType,
        WorkoutName=model.WorkoutName,
        DurationMinutes=_to_float(model.DurationMinutes),
        CaloriesBurned=int(model.CaloriesBurned or 0),
        DistanceKm=_to_float(model.DistanceKm),
        Source=model.Source,
        ExternalId=model.ExternalId,
        StartedAt=model.StartedAt,
        EndedAt=model.EndedAt,
        Notes=model.Notes,
        Metadata=metadata,
        CreatedAt=model.CreatedAt,
    )


def _FindImportWorkout(
    db: Session,
    user_id: int,
    source: str,
    external_id: str | None,
    workout_name: str,
    started_at: datetime | None,
    log_date: date,
) -> WorkoutModel | None:
    if external_id:
        existing = (
            db.query(WorkoutModel)
            .filter(
                WorkoutModel.UserId == user_id,
                WorkoutModel.Source == source,
                WorkoutModel.ExternalId == external_id,
            )
            .first()
        )
        if existing is not None:
            return existing
    if started_at is None:
        return None
    return (
        db.query(WorkoutModel)
        .filter(
            WorkoutModel.UserId == user_id,
            WorkoutModel.Source == source,
            WorkoutModel.LogDate == log_date,
            WorkoutModel.WorkoutName == workout_name,
            WorkoutModel.StartedAt == started_at,
        )
        .first()
    )


def CreateWorkout(
    db: Session,
    user_id: int,
    payload: CreateWorkoutInput,
    *,
    source: str = "user",
    external_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Workout:
    log_date = ParseIsoDate(payload.LogDate)
    if payload.EndedAt and payload.StartedAt and payload.EndedAt < payload.StartedAt:
        raise ValueError("EndedAt cannot be before StartedAt.")
    EnsureDailyLogForDate(db, user_id, log_date.isoformat())
    now = _utc_now()
    model = WorkoutModel(
        WorkoutId=str(uuid.uuid4()),
        UserId=user_id,
        LogDate=log_date,
        WorkoutType=payload.WorkoutType.strip(),
        WorkoutName=payload.WorkoutName.strip(),
        DurationMinutes=payload.DurationMinutes,
        CaloriesBurned=int(payload.CaloriesBurned or 0),
        DistanceKm=payload.DistanceKm,
        Source=source,
        ExternalId=external_id,
        StartedAt=payload.StartedAt,
        EndedAt=payload.EndedAt,
        Notes=payload.Notes,
        MetadataJson=json.dumps(metadata, separators=(",", ":"), ensure_ascii=True) if metadata else None,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _SerializeWorkout(model)


def UpsertImportedWorkout(
    db: Session,
    user_id: int,
    *,
    log_date: date,
    workout_type: str,
    workout_name: str,
    duration_minutes: float | None,
    calories_burned: int,
    distance_km: float | None,
    started_at: datetime | None,
    ended_at: datetime | None,
    notes: str | None,
    external_id: str | None,
    metadata: dict[str, Any] | None,
) -> Workout:
    source = "automation"
    EnsureDailyLogForDate(db, user_id, log_date.isoformat())
    existing = _FindImportWorkout(db, user_id, source, external_id, workout_name, started_at, log_date)
    now = _utc_now()
    if existing is None:
        existing = WorkoutModel(
            WorkoutId=str(uuid.uuid4()),
            UserId=user_id,
            LogDate=log_date,
            Source=source,
            ExternalId=external_id,
            CreatedAt=now,
        )
        db.add(existing)
    existing.WorkoutType = workout_type
    existing.WorkoutName = workout_name
    existing.DurationMinutes = duration_minutes
    existing.CaloriesBurned = int(calories_burned or 0)
    existing.DistanceKm = distance_km
    existing.StartedAt = started_at
    existing.EndedAt = ended_at
    existing.Notes = notes
    existing.MetadataJson = json.dumps(metadata, separators=(",", ":"), ensure_ascii=True) if metadata else None
    existing.UpdatedAt = now
    db.flush()
    return _SerializeWorkout(existing)


def GetWorkoutHistory(
    db: Session,
    user_id: int,
    start_date: str,
    end_date: str,
    limit: int = 200,
) -> list[WorkoutHistoryEntry]:
    start = ParseIsoDate(start_date)
    end = ParseIsoDate(end_date)
    if end < start:
        raise ValueError("end_date cannot be before start_date.")
    rows = (
        db.query(WorkoutModel)
        .filter(
            WorkoutModel.UserId == user_id,
            WorkoutModel.LogDate >= start,
            WorkoutModel.LogDate <= end,
        )
        .order_by(WorkoutModel.LogDate.desc(), WorkoutModel.StartedAt.desc(), WorkoutModel.CreatedAt.desc())
        .limit(limit)
        .all()
    )
    return [
        WorkoutHistoryEntry(
            WorkoutId=row.WorkoutId,
            LogDate=row.LogDate,
            WorkoutType=row.WorkoutType,
            WorkoutName=row.WorkoutName,
            DurationMinutes=_to_float(row.DurationMinutes),
            CaloriesBurned=int(row.CaloriesBurned or 0),
            DistanceKm=_to_float(row.DistanceKm),
            Source=row.Source,
            ExternalId=row.ExternalId,
            StartedAt=row.StartedAt,
            EndedAt=row.EndedAt,
            Notes=row.Notes,
        )
        for row in rows
    ]


def GetWorkoutsForDate(db: Session, user_id: int, log_date: date | str) -> list[Workout]:
    target = ParseIsoDate(log_date) if isinstance(log_date, str) else log_date
    rows = (
        db.query(WorkoutModel)
        .filter(WorkoutModel.UserId == user_id, WorkoutModel.LogDate == target)
        .order_by(WorkoutModel.StartedAt.asc(), WorkoutModel.CreatedAt.asc())
        .all()
    )
    return [_SerializeWorkout(row) for row in rows]


def GetWorkoutCaloriesForDate(db: Session, user_id: int, log_date: date | str) -> tuple[int, int]:
    workouts = GetWorkoutsForDate(db, user_id, log_date)
    return sum(int(item.CaloriesBurned or 0) for item in workouts), len(workouts)


def GetWorkoutById(db: Session, user_id: int, workout_id: str) -> Workout:
    row = (
        db.query(WorkoutModel)
        .filter(WorkoutModel.UserId == user_id, WorkoutModel.WorkoutId == workout_id)
        .first()
    )
    if row is None:
        raise ValueError("Workout not found.")
    return _SerializeWorkout(row)


def UpdateWorkout(
    db: Session,
    user_id: int,
    workout_id: str,
    *,
    log_date: str | None = None,
    workout_type: str | None = None,
    workout_name: str | None = None,
    duration_minutes: float | None = None,
    calories_burned: int | None = None,
    distance_km: float | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    notes: str | None = None,
) -> Workout:
    row = (
        db.query(WorkoutModel)
        .filter(WorkoutModel.UserId == user_id, WorkoutModel.WorkoutId == workout_id)
        .first()
    )
    if row is None:
        raise ValueError("Workout not found.")
    target_date = ParseIsoDate(log_date) if log_date else row.LogDate
    EnsureDailyLogForDate(db, user_id, target_date.isoformat())
    if workout_type is not None:
        row.WorkoutType = workout_type.strip()
    if workout_name is not None:
        row.WorkoutName = workout_name.strip()
    if duration_minutes is not None:
        row.DurationMinutes = duration_minutes
    if calories_burned is not None:
        row.CaloriesBurned = int(calories_burned)
    if distance_km is not None:
        row.DistanceKm = distance_km
    if started_at is not None:
        row.StartedAt = started_at
    if ended_at is not None:
        row.EndedAt = ended_at
    if row.EndedAt and row.StartedAt and row.EndedAt < row.StartedAt:
        raise ValueError("EndedAt cannot be before StartedAt.")
    if notes is not None:
        row.Notes = notes
    row.LogDate = target_date
    row.UpdatedAt = _utc_now()
    db.add(row)
    db.commit()
    db.refresh(row)
    return _SerializeWorkout(row)


def DeleteWorkout(db: Session, user_id: int, workout_id: str) -> date:
    row = (
        db.query(WorkoutModel)
        .filter(WorkoutModel.UserId == user_id, WorkoutModel.WorkoutId == workout_id)
        .first()
    )
    if row is None:
        raise ValueError("Workout not found.")
    log_date = row.LogDate
    db.delete(row)
    db.commit()
    return log_date
