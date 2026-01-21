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
from app.modules.health.models import ImportLog as ImportLogModel
from app.modules.health.models import MetricEntry as MetricEntryModel
from app.modules.health.services.metric_entries_service import ApplyMetricToDailyLog
from app.modules.health.services.daily_logs_service import UpdateUserWeightFromLatestLog

logger = logging.getLogger("health.hae_import")


@dataclass
class HaeImportSummary:
    ImportId: str
    MetricsCount: int
    WorkoutsCount: int
    StepsUpdated: int
    WeightUpdated: int


@dataclass
class ParsedMetricEntry:
    MetricType: str
    Value: float
    LogDate: date
    OccurredAt: datetime


def ImportHealthAutoExportPayload(
    db: Session, UserId: int, Payload: dict[str, Any]
) -> HaeImportSummary:
    metrics = _ExtractMetrics(Payload)
    workouts_count = _CountWorkouts(Payload)
    logger.debug(
        "health import payload parsed user_id=%s metrics=%s workouts=%s",
        UserId,
        len(metrics),
        workouts_count,
    )
    entries, latest_steps, latest_weight = _ParseMetrics(metrics)

    updates = {entry.LogDate for entry in entries} | set(latest_steps.keys()) | set(latest_weight.keys())
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

    logger.debug(
        "health import applied user_id=%s steps_updated=%s weight_updated=%s",
        UserId,
        steps_updated,
        weight_updated,
    )
    return HaeImportSummary(
        ImportId=import_id,
        MetricsCount=len(metrics),
        WorkoutsCount=workouts_count,
        StepsUpdated=steps_updated,
        WeightUpdated=weight_updated,
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
    if not isinstance(payload, dict):
        return 0
    data = payload.get("data")
    workouts = None
    if isinstance(data, dict):
        workouts = data.get("workouts")
    if workouts is None:
        workouts = payload.get("workouts")
    if isinstance(workouts, list):
        return len(workouts)
    if isinstance(workouts, dict):
        items = workouts.get("data")
        if isinstance(items, list):
            return len(items)
    return 0


def _ParseMetrics(
    metrics: list[dict[str, Any]]
) -> tuple[list[ParsedMetricEntry], dict[date, ParsedMetricEntry], dict[date, ParsedMetricEntry]]:
    entries: list[ParsedMetricEntry] = []
    latest_steps: dict[date, ParsedMetricEntry] = {}
    latest_weight: dict[date, ParsedMetricEntry] = {}

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
                _MergeLatestEntry(latest_steps, entry)
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

    return entries, latest_steps, latest_weight


def _NormalizeMetricName(name: Any) -> str:
    if not isinstance(name, str):
        return ""
    return re.sub(r"\s+", " ", name.strip().lower())


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


def _NormalizeSteps(value: float) -> int | None:
    if value < 0:
        return None
    return int(round(value))


def _NormalizeWeight(value: float, units: str) -> float | None:
    if value <= 0:
        return None
    normalized = value
    if "lb" in units or "pound" in units:
        normalized = value / 2.2046226218
    if normalized < 20 or normalized > 500:
        return None
    return round(normalized, 2)
