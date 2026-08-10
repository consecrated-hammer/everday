import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.health.models import HeadacheEvent, MedicationDose
from app.modules.health.schemas import (
    HeadacheEvent as HeadacheSchema,
    MedicationDose as DoseSchema,
    UpsertHeadacheEventInput,
    UpsertMedicationDoseInput,
)
from app.modules.health.utils.dates import ParseIsoDate


def _RecoverIdempotentInsert(
    db: Session,
    model: Any,
    id_column: Any,
    record_id: str,
    user_id: int,
    response_schema: Any,
    field_name: str,
):
    existing = db.query(model).filter(id_column == record_id, model.UserId == user_id).first()
    if existing is not None:
        return response_schema.model_validate(existing, from_attributes=True)
    collision = db.query(model).filter(id_column == record_id).first()
    if collision is not None:
        raise ValueError(f"{field_name} is already in use.")
    return None


def UpsertHeadache(db: Session, user_id: int, payload: UpsertHeadacheEventInput) -> HeadacheSchema:
    row = (
        db.query(HeadacheEvent)
        .filter(HeadacheEvent.HeadacheEventId == payload.HeadacheEventId, HeadacheEvent.UserId == user_id)
        .first()
        if payload.HeadacheEventId
        else None
    )
    created = row is None
    if created:
        row = HeadacheEvent(
            HeadacheEventId=payload.HeadacheEventId or str(uuid.uuid4()),
            UserId=user_id,
            LogDate=ParseIsoDate(payload.LogDate),
        )
        db.add(row)
    for key, value in payload.model_dump(exclude={"HeadacheEventId", "LogDate"}).items():
        setattr(row, key, value)
    row.LogDate = ParseIsoDate(payload.LogDate)
    row.UpdatedAt = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if not created or not payload.HeadacheEventId:
            raise
        recovered = _RecoverIdempotentInsert(
            db,
            HeadacheEvent,
            HeadacheEvent.HeadacheEventId,
            payload.HeadacheEventId,
            user_id,
            HeadacheSchema,
            "HeadacheEventId",
        )
        if recovered is not None:
            return recovered
        raise
    db.refresh(row)
    return HeadacheSchema.model_validate(row, from_attributes=True)


def GetHeadaches(db: Session, user_id: int, log_date: str | None = None):
    query = db.query(HeadacheEvent).filter(HeadacheEvent.UserId == user_id)
    if log_date:
        query = query.filter(HeadacheEvent.LogDate == ParseIsoDate(log_date))
    return [
        HeadacheSchema.model_validate(x, from_attributes=True)
        for x in query.order_by(HeadacheEvent.OnsetAt.desc()).all()
    ]


def UpsertDose(db: Session, user_id: int, payload: UpsertMedicationDoseInput) -> DoseSchema:
    row = (
        db.query(MedicationDose)
        .filter(MedicationDose.MedicationDoseId == payload.MedicationDoseId, MedicationDose.UserId == user_id)
        .first()
        if payload.MedicationDoseId
        else None
    )
    created = row is None
    if created:
        row = MedicationDose(
            MedicationDoseId=payload.MedicationDoseId or str(uuid.uuid4()),
            UserId=user_id,
            LogDate=ParseIsoDate(payload.LogDate),
        )
        db.add(row)
    for key, value in payload.model_dump(exclude={"MedicationDoseId", "LogDate"}).items():
        setattr(row, key, value)
    row.LogDate = ParseIsoDate(payload.LogDate)
    row.UpdatedAt = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if not created or not payload.MedicationDoseId:
            raise
        recovered = _RecoverIdempotentInsert(
            db,
            MedicationDose,
            MedicationDose.MedicationDoseId,
            payload.MedicationDoseId,
            user_id,
            DoseSchema,
            "MedicationDoseId",
        )
        if recovered is not None:
            return recovered
        raise
    db.refresh(row)
    return DoseSchema.model_validate(row, from_attributes=True)


def GetDoses(db: Session, user_id: int, log_date: str | None = None):
    query = db.query(MedicationDose).filter(MedicationDose.UserId == user_id)
    if log_date:
        query = query.filter(MedicationDose.LogDate == ParseIsoDate(log_date))
    return [
        DoseSchema.model_validate(x, from_attributes=True)
        for x in query.order_by(MedicationDose.TakenAt.desc()).all()
    ]
