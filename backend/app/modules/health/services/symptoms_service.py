import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.modules.health.models import HeadacheEvent, MedicationDose
from app.modules.health.schemas import HeadacheEvent as HeadacheSchema, MedicationDose as DoseSchema, UpsertHeadacheEventInput, UpsertMedicationDoseInput
from app.modules.health.utils.dates import ParseIsoDate

def UpsertHeadache(db: Session, user_id: int, payload: UpsertHeadacheEventInput) -> HeadacheSchema:
    row = db.query(HeadacheEvent).filter(HeadacheEvent.HeadacheEventId == payload.HeadacheEventId, HeadacheEvent.UserId == user_id).first() if payload.HeadacheEventId else None
    if row is None:
        row = HeadacheEvent(HeadacheEventId=str(uuid.uuid4()), UserId=user_id, LogDate=ParseIsoDate(payload.LogDate))
        db.add(row)
    for key, value in payload.model_dump(exclude={"HeadacheEventId", "LogDate"}).items(): setattr(row, key, value)
    row.LogDate = ParseIsoDate(payload.LogDate); row.UpdatedAt = datetime.utcnow(); db.commit(); db.refresh(row)
    return HeadacheSchema.model_validate(row, from_attributes=True)

def GetHeadaches(db: Session, user_id: int, log_date: str | None = None):
    query = db.query(HeadacheEvent).filter(HeadacheEvent.UserId == user_id)
    if log_date: query = query.filter(HeadacheEvent.LogDate == ParseIsoDate(log_date))
    return [HeadacheSchema.model_validate(x, from_attributes=True) for x in query.order_by(HeadacheEvent.OnsetAt.desc()).all()]

def UpsertDose(db: Session, user_id: int, payload: UpsertMedicationDoseInput) -> DoseSchema:
    row = db.query(MedicationDose).filter(MedicationDose.MedicationDoseId == payload.MedicationDoseId, MedicationDose.UserId == user_id).first() if payload.MedicationDoseId else None
    if row is None: row = MedicationDose(MedicationDoseId=str(uuid.uuid4()), UserId=user_id, LogDate=ParseIsoDate(payload.LogDate)); db.add(row)
    for key, value in payload.model_dump(exclude={"MedicationDoseId", "LogDate"}).items(): setattr(row, key, value)
    row.LogDate = ParseIsoDate(payload.LogDate); row.UpdatedAt = datetime.utcnow(); db.commit(); db.refresh(row)
    return DoseSchema.model_validate(row, from_attributes=True)

def GetDoses(db: Session, user_id: int, log_date: str | None = None):
    query = db.query(MedicationDose).filter(MedicationDose.UserId == user_id)
    if log_date: query = query.filter(MedicationDose.LogDate == ParseIsoDate(log_date))
    return [DoseSchema.model_validate(x, from_attributes=True) for x in query.order_by(MedicationDose.TakenAt.desc()).all()]
