import re
import uuid

from sqlalchemy.orm import Session

from app.modules.health.models import DailyLog as DailyLogModel
from app.modules.health.models import MealEntry as MealEntryModel
from app.modules.health.models import ScheduleSlot as ScheduleSlotModel
from app.modules.health.schemas import ScheduleSlot, ScheduleSlotInput

TimePattern = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def NormalizeSlotTime(SlotTime: str) -> str:
    Match = TimePattern.match(SlotTime.strip())
    if not Match:
        raise ValueError("Invalid slot time.")
    return f"{Match.group(1)}:{Match.group(2)}"


def GetScheduleSlots(db: Session, UserId: int) -> list[ScheduleSlot]:
    rows = (
        db.query(ScheduleSlotModel)
        .filter(ScheduleSlotModel.UserId == UserId)
        .order_by(ScheduleSlotModel.SortOrder, ScheduleSlotModel.SlotTime, ScheduleSlotModel.CreatedAt)
        .all()
    )
    return [
        ScheduleSlot(
            ScheduleSlotId=row.ScheduleSlotId,
            SlotName=row.SlotName,
            SlotTime=row.SlotTime,
            MealType=row.MealType,
            SortOrder=row.SortOrder,
        )
        for row in rows
    ]


def UpdateScheduleSlots(db: Session, UserId: int, Slots: list[ScheduleSlotInput]) -> list[ScheduleSlot]:
    ExistingRows = (
        db.query(ScheduleSlotModel.ScheduleSlotId)
        .filter(ScheduleSlotModel.UserId == UserId)
        .all()
    )
    ExistingIds = {Row[0] for Row in ExistingRows}
    KeepIds: list[str] = []

    for Slot in Slots:
        SlotTime = NormalizeSlotTime(Slot.SlotTime)
        SlotName = Slot.SlotName.strip()
        if not SlotName:
            raise ValueError("Slot name required.")
        SortOrder = max(0, int(Slot.SortOrder))

        if Slot.ScheduleSlotId and Slot.ScheduleSlotId in ExistingIds:
            record = (
                db.query(ScheduleSlotModel)
                .filter(
                    ScheduleSlotModel.ScheduleSlotId == Slot.ScheduleSlotId,
                    ScheduleSlotModel.UserId == UserId,
                )
                .first()
            )
            if record:
                record.SlotName = SlotName
                record.SlotTime = SlotTime
                record.MealType = Slot.MealType
                record.SortOrder = SortOrder
                db.add(record)
                KeepIds.append(record.ScheduleSlotId)
        else:
            record = ScheduleSlotModel(
                ScheduleSlotId=str(uuid.uuid4()),
                UserId=UserId,
                SlotName=SlotName,
                SlotTime=SlotTime,
                MealType=Slot.MealType,
                SortOrder=SortOrder,
            )
            db.add(record)
            KeepIds.append(record.ScheduleSlotId)

    RemovedIds = [SlotId for SlotId in ExistingIds if SlotId not in KeepIds]
    if RemovedIds:
        logs = (
            db.query(DailyLogModel.DailyLogId)
            .filter(DailyLogModel.UserId == UserId)
            .all()
        )
        log_ids = [row[0] for row in logs]
        if log_ids:
            db.query(MealEntryModel).filter(
                MealEntryModel.ScheduleSlotId.in_(RemovedIds),
                MealEntryModel.DailyLogId.in_(log_ids),
            ).update({MealEntryModel.ScheduleSlotId: None}, synchronize_session=False)
        db.query(ScheduleSlotModel).filter(
            ScheduleSlotModel.UserId == UserId,
            ScheduleSlotModel.ScheduleSlotId.in_(RemovedIds),
        ).delete(synchronize_session=False)

    db.commit()
    return GetScheduleSlots(db, UserId)
