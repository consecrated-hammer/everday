from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy.orm import Session

from app.modules.health.models import DailyLog as DailyLogModel
from app.modules.health.models import MetricEntry as MetricEntryModel

MetricType = Literal["steps", "weight"]
MetricSource = Literal["user", "automation"]


def ApplyMetricToDailyLog(
    record: DailyLogModel,
    MetricTypeValue: MetricType,
    Value: float,
    OccurredAt: datetime,
    Source: MetricSource,
) -> bool:
    if MetricTypeValue == "steps":
        existing = record.StepsUpdatedAt
        if existing is not None and OccurredAt <= existing:
            return False
        record.Steps = int(round(Value))
        record.StepsUpdatedAt = OccurredAt
        record.StepsSource = Source
        return True
    if MetricTypeValue == "weight":
        existing = record.WeightUpdatedAt
        if existing is not None and OccurredAt <= existing:
            return False
        record.WeightKg = Value
        record.WeightUpdatedAt = OccurredAt
        record.WeightSource = Source
        return True
    return False


def RecordMetricEntry(
    db: Session,
    record: DailyLogModel,
    UserId: int,
    LogDate,
    MetricTypeValue: MetricType,
    Value: float,
    OccurredAt: datetime,
    Source: MetricSource,
) -> bool:
    entry = MetricEntryModel(
        MetricEntryId=str(uuid.uuid4()),
        UserId=UserId,
        LogDate=LogDate,
        MetricType=MetricTypeValue,
        Value=Value,
        OccurredAt=OccurredAt,
        Source=Source,
    )
    db.add(entry)
    return ApplyMetricToDailyLog(record, MetricTypeValue, Value, OccurredAt, Source)
