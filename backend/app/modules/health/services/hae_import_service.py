from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.modules.health.models import DailyLog as DailyLogModel
from app.modules.health.models import BodyMeasurement as BodyMeasurementModel
from app.modules.health.models import ImportLog as ImportLogModel
from app.modules.health.models import MetricEntry as MetricEntryModel
from app.modules.health.services.daily_logs_service import UpdateUserWeightFromLatestLog
from app.modules.health.services.metric_entries_service import ApplyMetricToDailyLog
from app.modules.health.services.workouts_service import UpsertImportedWorkout

logger = logging.getLogger("health.hae_import")


@dataclass
class HaeImportSummary:
    ImportId: str
    MetricsCount: int
    WorkoutsCount: int
    StepsUpdated: int
    WeightUpdated: int
    SleepUpdated: int
    RestingHeartRateUpdated: int


@dataclass
class ParsedMetricEntry:
    MetricType: str
    Value: float
    LogDate: date
    OccurredAt: datetime


@dataclass
class ParsedWorkoutEntry:
    LogDate: date
    WorkoutType: str
    WorkoutName: str
    DurationMinutes: float | None
    CaloriesBurned: int
    DistanceKm: float | None
    StartedAt: datetime | None
    EndedAt: datetime | None
    Notes: str | None
    ExternalId: str | None
    Metadata: dict[str, Any] | None


def ImportHealthAutoExportPayload(
    db: Session, UserId: int, Payload: dict[str, Any]
) -> HaeImportSummary:
    metrics = _ExtractMetrics(Payload)
    workouts = _ParseWorkouts(_ExtractWorkouts(Payload))
    workouts_count = len(workouts)
    logger.debug(
        "health import payload parsed user_id=%s metrics=%s workouts=%s",
        UserId,
        len(metrics),
        workouts_count,
    )
    entries, latest_steps, latest_weight, latest_sleep, latest_resting_heart_rate = _ParseMetrics(metrics)

    updates = {entry.LogDate for entry in entries} | set(latest_steps.keys()) | set(latest_weight.keys())
    updates |= set(latest_sleep.keys())
    updates |= set(latest_resting_heart_rate.keys())
    updates |= {entry.LogDate for entry in workouts}
    existing_logs: dict[date, DailyLogModel] = {}
    if updates:
        rows = (
            db.query(DailyLogModel)
            .filter(DailyLogModel.UserId == UserId, DailyLogModel.LogDate.in_(updates))
            .all()
        )
        existing_logs = {row.LogDate: row for row in rows}

    for entry in entries:
        record = existing_logs.get(entry.LogDate)
        if record is None:
            record = DailyLogModel(
                DailyLogId=str(uuid.uuid4()),
                UserId=UserId,
                LogDate=entry.LogDate,
                Steps=0,
                StepKcalFactorOverride=None,
            )
            db.add(record)
            existing_logs[entry.LogDate] = record

        metric_entry = MetricEntryModel(
            MetricEntryId=str(uuid.uuid4()),
            UserId=UserId,
            LogDate=entry.LogDate,
            MetricType=entry.MetricType,
            Value=entry.Value,
            OccurredAt=entry.OccurredAt,
            Source="automation",
        )
        db.add(metric_entry)

    steps_updated = 0
    weight_updated = 0
    sleep_updated = 0
    resting_heart_rate_updated = 0

    measurements: dict[date, BodyMeasurementModel] = {}
    if latest_resting_heart_rate:
        rows = (
            db.query(BodyMeasurementModel)
            .filter(
                BodyMeasurementModel.UserId == UserId,
                BodyMeasurementModel.LogDate.in_(latest_resting_heart_rate.keys()),
            )
            .all()
        )
        measurements = {row.LogDate: row for row in rows}

    for log_date in updates:
        record = existing_logs.get(log_date)
        if record is None:
            record = DailyLogModel(
                DailyLogId=str(uuid.uuid4()),
                UserId=UserId,
                LogDate=log_date,
                Steps=0,
                StepKcalFactorOverride=None,
            )
            db.add(record)
            existing_logs[log_date] = record

        step_entry = latest_steps.get(log_date)
        if step_entry:
            if ApplyMetricToDailyLog(
                record,
                "steps",
                step_entry.Value,
                step_entry.OccurredAt,
                "automation",
            ):
                steps_updated += 1

        weight_entry = latest_weight.get(log_date)
        if weight_entry:
            if ApplyMetricToDailyLog(
                record,
                "weight",
                weight_entry.Value,
                weight_entry.OccurredAt,
                "automation",
            ):
                weight_updated += 1

        sleep_entry = latest_sleep.get(log_date)
        if sleep_entry:
            if ApplyMetricToDailyLog(
                record,
                "sleep",
                sleep_entry.Value,
                sleep_entry.OccurredAt,
                "automation",
            ):
                sleep_updated += 1

        resting_heart_rate_entry = latest_resting_heart_rate.get(log_date)
        if resting_heart_rate_entry:
            measurement = measurements.get(log_date)
            if measurement is None:
                measurement = BodyMeasurementModel(
                    BodyMeasurementId=str(uuid.uuid4()),
                    UserId=UserId,
                    LogDate=log_date,
                )
                db.add(measurement)
                measurements[log_date] = measurement
            should_apply = measurement.RestingHeartRateSource != "user"
            if should_apply and measurement.RestingHeartRateSource == "automation" and measurement.RestingHeartRateUpdatedAt:
                should_apply = resting_heart_rate_entry.OccurredAt > measurement.RestingHeartRateUpdatedAt
            if should_apply:
                measurement.RestingHeartRate = int(round(resting_heart_rate_entry.Value))
                measurement.RestingHeartRateUpdatedAt = resting_heart_rate_entry.OccurredAt
                measurement.RestingHeartRateSource = "automation"
                measurement.UpdatedAt = datetime.utcnow()
                resting_heart_rate_updated += 1

    for workout in workouts:
        UpsertImportedWorkout(
            db,
            UserId,
            log_date=workout.LogDate,
            workout_type=workout.WorkoutType,
            workout_name=workout.WorkoutName,
            duration_minutes=workout.DurationMinutes,
            calories_burned=workout.CaloriesBurned,
            distance_km=workout.DistanceKm,
            started_at=workout.StartedAt,
            ended_at=workout.EndedAt,
            notes=workout.Notes,
            external_id=workout.ExternalId,
            metadata=workout.Metadata,
        )

    import_id = str(uuid.uuid4())
    import_log = ImportLogModel(
        ImportLogId=import_id,
        UserId=UserId,
        Source="health-auto-export",
        Payload=json.dumps(Payload, separators=(",", ":"), ensure_ascii=True),
        MetricsCount=len(metrics),
        WorkoutsCount=workouts_count,
    )
    db.add(import_log)

    db.commit()

    if weight_updated:
        UpdateUserWeightFromLatestLog(db, UserId)

    logger.debug("health import applied")
    return HaeImportSummary(
        ImportId=import_id,
        MetricsCount=len(metrics),
        WorkoutsCount=workouts_count,
        StepsUpdated=steps_updated,
        WeightUpdated=weight_updated,
        SleepUpdated=sleep_updated,
        RestingHeartRateUpdated=resting_heart_rate_updated,
    )


def _ExtractMetrics(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if isinstance(data, dict):
        metrics = data.get("metrics")
        if isinstance(metrics, list):
            return metrics
    metrics = payload.get("metrics")
    if isinstance(metrics, list):
        return metrics
    return []


def _CountWorkouts(payload: dict[str, Any]) -> int:
    return len(_ExtractWorkouts(payload))


def _ExtractWorkouts(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    workouts = data.get("workouts") if isinstance(data, dict) else None
    if workouts is None:
        workouts = payload.get("workouts")
    if isinstance(workouts, list):
        return [item for item in workouts if isinstance(item, dict)]
    if isinstance(workouts, dict):
        items = workouts.get("data")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
    return []


def _ParseMetrics(
    metrics: list[dict[str, Any]]
) -> tuple[
    list[ParsedMetricEntry],
    dict[date, ParsedMetricEntry],
    dict[date, ParsedMetricEntry],
    dict[date, ParsedMetricEntry],
    dict[date, ParsedMetricEntry],
]:
    entries: list[ParsedMetricEntry] = []
    latest_steps: dict[date, ParsedMetricEntry] = {}
    latest_weight: dict[date, ParsedMetricEntry] = {}
    latest_sleep: dict[date, ParsedMetricEntry] = {}
    latest_resting_heart_rate: dict[date, ParsedMetricEntry] = {}
    resting_heart_rate_samples: dict[date, list[ParsedMetricEntry]] = {}
    step_totals: dict[date, float] = {}
    step_latest: dict[date, datetime] = {}

    for metric in metrics:
        if not isinstance(metric, dict):
            continue
        name = _NormalizeMetricName(metric.get("name"))
        if not name:
            continue
        units = _NormalizeUnits(metric.get("units") or metric.get("unit"))
        if _IsStepsMetric(name):
            parsed_entries = _ParseMetricEntries(metric)
            for log_date, timestamp, value in parsed_entries:
                normalized = _NormalizeSteps(value)
                if normalized is None:
                    continue
                entry = ParsedMetricEntry(
                    MetricType="steps",
                    Value=float(normalized),
                    LogDate=log_date,
                    OccurredAt=timestamp,
                )
                entries.append(entry)
                step_totals[log_date] = step_totals.get(log_date, 0.0) + normalized
                existing_timestamp = step_latest.get(log_date)
                if existing_timestamp is None or timestamp > existing_timestamp:
                    step_latest[log_date] = timestamp
        elif _IsWeightMetric(name):
            parsed_entries = _ParseMetricEntries(metric)
            for log_date, timestamp, value in parsed_entries:
                normalized = _NormalizeWeight(value, units)
                if normalized is None:
                    continue
                entry = ParsedMetricEntry(
                    MetricType="weight",
                    Value=float(normalized),
                    LogDate=log_date,
                    OccurredAt=timestamp,
                )
                entries.append(entry)
                _MergeLatestEntry(latest_weight, entry)
        elif _IsSleepMetric(name):
            parsed_entries = _ParseSleepMetricEntries(metric)
            for log_date, timestamp, value in parsed_entries:
                normalized = _NormalizeSleepHours(value)
                if normalized is None:
                    continue
                entry = ParsedMetricEntry(
                    MetricType="sleep",
                    Value=float(normalized),
                    LogDate=log_date,
                    OccurredAt=timestamp,
                )
                entries.append(entry)
                _MergeLatestEntry(latest_sleep, entry)
        elif _IsRestingHeartRateMetric(name):
            parsed_entries = _ParseMetricEntries(metric)
            for log_date, timestamp, value in parsed_entries:
                normalized = _NormalizeRestingHeartRate(value)
                if normalized is None:
                    continue
                entry = ParsedMetricEntry(
                    MetricType="resting_heart_rate",
                    Value=float(normalized),
                    LogDate=log_date,
                    OccurredAt=timestamp,
                )
                entries.append(entry)
                resting_heart_rate_samples.setdefault(log_date, []).append(entry)

    if step_totals:
        for log_date, total in step_totals.items():
            occurred_at = step_latest.get(log_date)
            if occurred_at is None:
                continue
            latest_steps[log_date] = ParsedMetricEntry(
                MetricType="steps",
                Value=float(total),
                LogDate=log_date,
                OccurredAt=occurred_at,
            )

    for log_date, samples in resting_heart_rate_samples.items():
        latest_resting_heart_rate[log_date] = ParsedMetricEntry(
            MetricType="resting_heart_rate",
            Value=float(round(sum(sample.Value for sample in samples) / len(samples))),
            LogDate=log_date,
            OccurredAt=max(sample.OccurredAt for sample in samples),
        )

    return entries, latest_steps, latest_weight, latest_sleep, latest_resting_heart_rate


def _ParseWorkouts(workouts: list[dict[str, Any]]) -> list[ParsedWorkoutEntry]:
    parsed: list[ParsedWorkoutEntry] = []
    for workout in workouts:
        parsed_workout = _ParseWorkout(workout)
        if parsed_workout is not None:
            parsed.append(parsed_workout)
    return parsed


def _NormalizeMetricName(name: Any) -> str:
    if not isinstance(name, str):
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[_-]+", " ", name.strip().lower()))


def _NormalizeUnits(units: Any) -> str:
    if not isinstance(units, str):
        return ""
    return units.strip().lower()


def _IsStepsMetric(name: str) -> bool:
    return "step" in name and "length" not in name


def _IsWeightMetric(name: str) -> bool:
    if "bmi" in name or "body mass index" in name:
        return False
    return "body mass" in name or name == "weight" or "weight" in name


def _IsSleepMetric(name: str) -> bool:
    return "sleep" in name


def _IsRestingHeartRateMetric(name: str) -> bool:
    return "resting" in name and "heart rate" in name


def _ParseMetricEntries(metric: dict[str, Any]) -> list[tuple[date, datetime, float]]:
    data = metric.get("data")
    if not isinstance(data, list):
        return []

    results: list[tuple[date, datetime, float]] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        quantity = entry.get("qty", entry.get("value", entry.get("count")))
        if quantity is None:
            continue
        try:
            value = float(quantity)
        except (TypeError, ValueError):
            continue

        date_value = _ExtractDateValue(entry)
        if not date_value:
            continue
        parsed = _ParseHaeDate(date_value)
        if not parsed:
            continue
        log_date, timestamp = parsed
        results.append((log_date, timestamp, value))

    return results


def _ParseSleepMetricEntries(metric: dict[str, Any]) -> list[tuple[date, datetime, float]]:
    data = metric.get("data")
    if not isinstance(data, list):
        return []

    results: list[tuple[date, datetime, float]] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        quantity = entry.get("totalSleep", entry.get("asleep", entry.get("qty", entry.get("value"))))
        if quantity is None:
            continue
        try:
            value = float(quantity)
        except (TypeError, ValueError):
            continue

        # Health Auto Export's own "date" field tags a sleep session by the day the
        # sleeper woke up. Users expect the opposite: sleep starting Friday night is
        # "Friday's sleep", even though the sleeper wakes up Saturday morning. Prefer
        # sleepStart's local calendar day for LogDate; fall back to the source "date"
        # field only when sleepStart is missing or unparseable.
        sleep_end = entry.get("sleepEnd")
        timestamp: datetime | None = None
        if isinstance(sleep_end, str) and sleep_end.strip():
            parsed_sleep_end = _ParseHaeDate(sleep_end)
            if parsed_sleep_end:
                timestamp = parsed_sleep_end[1]

        log_date: date | None = None
        sleep_start = entry.get("sleepStart")
        if isinstance(sleep_start, str) and sleep_start.strip():
            parsed_sleep_start = _ParseHaeDate(sleep_start)
            if parsed_sleep_start:
                log_date = parsed_sleep_start[0]
                if timestamp is None:
                    timestamp = parsed_sleep_start[1]

        if log_date is None:
            date_value = _ExtractDateValue(entry)
            if not date_value:
                continue
            parsed = _ParseHaeDate(date_value)
            if not parsed:
                continue
            log_date, fallback_timestamp = parsed
            if timestamp is None:
                timestamp = fallback_timestamp

        results.append((log_date, timestamp, value))

    return results


def _ExtractDateValue(entry: dict[str, Any]) -> str | None:
    for key in (
        "date",
        "dateFrom",
        "date_from",
        "startDate",
        "start_date",
        "timestamp",
        "datetime",
    ):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def _ParseHaeDate(value: str) -> tuple[date, datetime] | None:
    formats = (
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    )

    cleaned = value.strip()
    parsed: datetime | None = None

    try:
        parsed = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except ValueError:
        parsed = None

    if parsed is None:
        for fmt in formats:
            try:
                parsed = datetime.strptime(cleaned, fmt)
                break
            except ValueError:
                continue

    if parsed is None:
        logger.debug("HAE date parse failed", extra={"value": cleaned})
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.date(), parsed.astimezone(timezone.utc)


def _MergeLatestEntry(target: dict[date, ParsedMetricEntry], entry: ParsedMetricEntry) -> None:
    existing = target.get(entry.LogDate)
    if existing is None or entry.OccurredAt > existing.OccurredAt:
        target[entry.LogDate] = entry


def _NormalizeSteps(value: float) -> float | None:
    if value < 0:
        return None
    return float(value)


def _NormalizeWeight(value: float, units: str) -> float | None:
    if value <= 0:
        return None
    normalized = value
    if "lb" in units or "pound" in units:
        normalized = value / 2.2046226218
    if normalized < 20 or normalized > 500:
        return None
    return round(normalized, 2)


def _NormalizeSleepHours(value: float) -> float | None:
    if value < 0 or value > 24:
        return None
    return round(value, 2)


def _NormalizeRestingHeartRate(value: float) -> int | None:
    if value < 25 or value > 250:
        return None
    return int(round(value))


def _ParseWorkout(workout: dict[str, Any]) -> ParsedWorkoutEntry | None:
    started_at = _ExtractWorkoutTimestamp(workout, ("startDate", "start_date", "date", "timestamp", "startedAt"))
    ended_at = _ExtractWorkoutTimestamp(workout, ("endDate", "end_date", "endedAt", "finishDate"))
    log_date = (started_at or ended_at)
    if log_date is None:
        date_value = workout.get("date")
        if isinstance(date_value, str):
            parsed = _ParseHaeDate(date_value)
            if parsed is not None:
                log_date, parsed_timestamp = parsed
                if started_at is None:
                    started_at = parsed_timestamp
    if isinstance(log_date, datetime):
        workout_date = log_date.astimezone(timezone.utc).date()
    elif isinstance(log_date, date):
        workout_date = log_date
    else:
        return None

    workout_type = _FirstText(
        workout,
        "workoutActivityType",
        "activityType",
        "type",
        "sport",
        "category",
    ) or "Workout"
    workout_name = _FirstText(
        workout,
        "name",
        "workoutName",
        "activityName",
        "title",
        "displayName",
    ) or workout_type
    calories_burned = _NormalizeCalories(
        _FirstNumber(
            workout,
            "activeEnergyBurned",
            "energyBurned",
            "calories",
            "totalEnergyBurned",
            "caloriesBurned",
        )
    )
    duration_minutes = _NormalizeDurationMinutes(
        _FirstNumber(
            workout,
            "durationMinutes",
            "duration",
            "durationInMinutes",
            "duration_seconds",
            "durationSeconds",
        ),
        workout,
    )
    distance_km = _NormalizeDistanceKm(
        _FirstNumber(
            workout,
            "distanceKm",
            "distance_km",
            "distance",
            "totalDistance",
        ),
        workout,
    )
    notes = _FirstText(workout, "notes", "description", "sourceName")
    external_id = _FirstText(workout, "uuid", "id", "externalId", "sourceId")
    return ParsedWorkoutEntry(
        LogDate=workout_date,
        WorkoutType=workout_type[:80],
        WorkoutName=workout_name[:200],
        DurationMinutes=duration_minutes,
        CaloriesBurned=calories_burned,
        DistanceKm=distance_km,
        StartedAt=started_at,
        EndedAt=ended_at,
        Notes=notes,
        ExternalId=external_id,
        Metadata=workout,
    )


def _ExtractWorkoutTimestamp(workout: dict[str, Any], keys: tuple[str, ...]) -> datetime | None:
    for key in keys:
        value = workout.get(key)
        if isinstance(value, str):
            parsed = _ParseHaeDate(value)
            if parsed is not None:
                return parsed[1]
        if isinstance(value, (int, float)):
            numeric = float(value)
            if numeric > 1_000_000_000_000:
                numeric /= 1000.0
            if numeric > 0:
                return datetime.fromtimestamp(numeric, tz=timezone.utc)
    return None


def _FirstText(source: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _FirstNumber(source: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = source.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _NormalizeCalories(value: float | None) -> int:
    if value is None or value < 0:
        return 0
    return int(round(value))


def _NormalizeDurationMinutes(value: float | None, workout: dict[str, Any]) -> float | None:
    if value is None or value <= 0:
        return None
    unit_hint = _FirstText(workout, "durationUnit", "duration_unit", "unit") or ""
    normalized_hint = unit_hint.lower()
    if "second" in normalized_hint or normalized_hint == "s":
        return round(value / 60.0, 2)
    if "hour" in normalized_hint or normalized_hint == "h":
        return round(value * 60.0, 2)
    if value > 1440:
        return round(value / 60.0, 2)
    return round(value, 2)


def _NormalizeDistanceKm(value: float | None, workout: dict[str, Any]) -> float | None:
    if value is None or value < 0:
        return None
    unit_hint = (_FirstText(workout, "distanceUnit", "distance_unit", "unit") or "").lower()
    if "meter" in unit_hint and "kilo" not in unit_hint:
        return round(value / 1000.0, 2)
    if "mile" in unit_hint:
        return round(value * 1.60934, 2)
    return round(value, 2)
