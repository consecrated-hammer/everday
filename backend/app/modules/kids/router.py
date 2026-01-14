import json
import logging
from datetime import date, datetime
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import create_engine, func, inspect, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.core.migrations import RunMigrations
from app.db import BuildAdminConnectionUrl, GetDb
from app.modules.auth.deps import UserContext
from app.modules.auth.models import User
from app.modules.kids.models import (
    Chore,
    ChoreAssignment,
    ChoreEntry,
    ChoreEntryAudit,
    KidLink,
    LedgerEntry,
    PocketMoneyRule,
)
from app.modules.kids.schemas import (
    ChoreAssignmentRequest,
    ChoreCreate,
    ChoreEntryAuditOut,
    ChoreEntryCreate,
    ChoreEntryOut,
    ChoreEntryUpdate,
    ChoreOut,
    ChoreUpdate,
    KidsApprovalOut,
    KidsLedgerResponse,
    KidsMonthSummaryResponse,
    KidsOverviewResponse,
    KidsSummaryResponse,
    KidLinkCreate,
    KidLinkOut,
    LedgerEntryCreate,
    LedgerEntryOut,
    PocketMoneyRuleOut,
    PocketMoneyRuleUpsert,
)
from app.modules.kids.services.chores_v2_service import (
    AllowedDateRange,
    BuildMonthProjection,
    CHORE_TYPE_BONUS,
    CHORE_TYPE_DAILY,
    CHORE_TYPE_HABIT,
    CentsToAmount,
    IsAssignmentActiveOnDate,
    IsChoreActiveOnDate,
    MonthRange,
    MonthlyAllowanceCents,
    RoundDailySlice,
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    TodayAdelaide,
)
from app.modules.kids.services.pocket_money_service import EnsurePocketMoneyCredits
from app.modules.kids.utils.rbac import RequireKidsManager, RequireKidsMember

_kids_storage_lock = Lock()
_kids_storage_ready = False
logger = logging.getLogger("kids")

_KIDS_TABLES = [
    KidLink,
    Chore,
    ChoreAssignment,
    ChoreEntry,
    ChoreEntryAudit,
    LedgerEntry,
    PocketMoneyRule,
]


def _handle_db_error(exc: Exception) -> None:
    logger.exception("kids database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Kids storage not initialized. Run alembic upgrade head.",
    ) from exc


def EnsureKidsStorageReady(db: Session = Depends(GetDb)) -> None:
    global _kids_storage_ready
    if _kids_storage_ready:
        return

    with _kids_storage_lock:
        if _kids_storage_ready:
            return
        inspector = inspect(db.get_bind())
        missing = [
            table.__tablename__
            for table in _KIDS_TABLES
            if not inspector.has_table(table.__tablename__, schema="kids")
        ]
        if not missing:
            _kids_storage_ready = True
            return

        logger.info("kids storage missing tables=%s", ",".join(missing))
        try:
            RunMigrations()
        except Exception:
            logger.exception("kids storage migration failed")

        inspector = inspect(db.get_bind())
        missing = [
            table.__tablename__
            for table in _KIDS_TABLES
            if not inspector.has_table(table.__tablename__, schema="kids")
        ]
        if not missing:
            _kids_storage_ready = True
            return

        logger.warning("kids storage still missing tables=%s, attempting repair", ",".join(missing))
        try:
            engine = create_engine(BuildAdminConnectionUrl(), pool_pre_ping=True)
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'kids') EXEC('CREATE SCHEMA kids')"
                    )
                )
                for table in _KIDS_TABLES:
                    table.__table__.create(bind=connection, checkfirst=True)
        except Exception as exc:
            logger.exception("kids storage repair failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Kids storage migration failed. Check server logs.",
            ) from exc

        inspector = inspect(db.get_bind())
        missing = [
            table.__tablename__
            for table in _KIDS_TABLES
            if not inspector.has_table(table.__tablename__, schema="kids")
        ]
        if missing:
            logger.exception("kids storage still missing tables=%s", ",".join(missing))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Kids storage migration failed. Check server logs.",
            )
        _kids_storage_ready = True


router = APIRouter(
    prefix="/api/kids",
    tags=["kids"],
    dependencies=[Depends(EnsureKidsStorageReady)],
)


def _EnsureParentKidAccess(db: Session, _parent_id: int, kid_id: int) -> None:
    link = db.query(KidLink).filter(KidLink.KidUserId == kid_id).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kid not linked")


def _DisplayName(user: User) -> str:
    parts = [user.FirstName, user.LastName]
    name = " ".join([part for part in parts if part])
    return name or user.Username


def _LoadUserNames(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    users = db.query(User).filter(User.Id.in_(user_ids)).all()
    return {user.Id: _DisplayName(user) for user in users}


def _BuildLedgerOut(entry: LedgerEntry, created_by_name: str | None = None) -> LedgerEntryOut:
    return LedgerEntryOut(
        Id=entry.Id,
        KidUserId=entry.KidUserId,
        EntryType=entry.EntryType,
        Amount=float(entry.Amount),
        EntryDate=entry.EntryDate,
        Narrative=entry.Narrative,
        Notes=entry.Notes,
        CreatedByUserId=entry.CreatedByUserId,
        CreatedByName=created_by_name,
        IsDeleted=entry.IsDeleted,
        CreatedAt=entry.CreatedAt,
        UpdatedAt=entry.UpdatedAt,
    )


def _BuildChoreOut(chore: Chore, assigned_kid_ids: list[int] | None = None) -> ChoreOut:
    return ChoreOut(
        Id=chore.Id,
        Label=chore.Label,
        Type=chore.Type,
        Amount=float(chore.Amount),
        IsActive=chore.IsActive,
        SortOrder=chore.SortOrder,
        AssignedKidIds=assigned_kid_ids,
    )


def _BuildChoreEntryOut(entry: ChoreEntry, chore: Chore) -> ChoreEntryOut:
    return ChoreEntryOut(
        Id=entry.Id,
        KidUserId=entry.KidUserId,
        ChoreId=entry.ChoreId,
        ChoreLabel=chore.Label,
        ChoreType=entry.ChoreType or chore.Type,
        Status=entry.Status,
        Amount=float(entry.Amount),
        EntryDate=entry.EntryDate,
        Notes=entry.Notes,
        IsDeleted=entry.IsDeleted,
        CreatedByUserId=entry.CreatedByUserId,
        UpdatedByUserId=entry.UpdatedByUserId,
        ReviewedByUserId=entry.ReviewedByUserId,
        ReviewedAt=entry.ReviewedAt,
        CreatedAt=entry.CreatedAt,
        UpdatedAt=entry.UpdatedAt,
    )


def _LoadAssignedChoresForDate(db: Session, kid_id: int, on_date: date) -> list[Chore]:
    assignments = (
        db.query(ChoreAssignment)
        .filter(ChoreAssignment.KidUserId == kid_id)
        .order_by(ChoreAssignment.CreatedAt.asc())
        .all()
    )
    chore_ids = [assignment.ChoreId for assignment in assignments]
    chores = (
        db.query(Chore).filter(Chore.Id.in_(chore_ids)).all()
        if chore_ids
        else []
    )
    chore_map = {chore.Id: chore for chore in chores}
    active = []
    for assignment in assignments:
        chore = chore_map.get(assignment.ChoreId)
        if not chore:
            continue
        if not IsChoreActiveOnDate(chore, on_date):
            continue
        if not IsAssignmentActiveOnDate(assignment, on_date):
            continue
        active.append(chore)
    active.sort(key=lambda chore: (chore.SortOrder, chore.Label.lower()))
    return active


def _SerializeEntry(entry: ChoreEntry, chore: Chore) -> dict:
    return {
        "Id": entry.Id,
        "KidUserId": entry.KidUserId,
        "ChoreId": entry.ChoreId,
        "ChoreLabel": chore.Label,
        "ChoreType": entry.ChoreType or chore.Type,
        "Status": entry.Status,
        "Amount": float(entry.Amount),
        "EntryDate": entry.EntryDate.isoformat(),
        "Notes": entry.Notes,
        "IsDeleted": entry.IsDeleted,
    }


def _BuildApprovalOut(entry: ChoreEntry, chore: Chore, kid_name: str) -> KidsApprovalOut:
    return KidsApprovalOut(
        Id=entry.Id,
        KidUserId=entry.KidUserId,
        KidName=kid_name,
        ChoreId=entry.ChoreId,
        ChoreLabel=chore.Label,
        ChoreType=entry.ChoreType or chore.Type,
        EntryDate=entry.EntryDate,
        Amount=float(entry.Amount),
        Notes=entry.Notes,
        Status=entry.Status,
        CreatedAt=entry.CreatedAt,
    )


def _LogAuditEvent(
    db: Session,
    entry: ChoreEntry,
    chore: Chore,
    action: str,
    actor_user_id: int,
    before: dict | None,
    after: dict | None,
    summary: str,
) -> None:
    audit = ChoreEntryAudit(
        ChoreEntryId=entry.Id,
        Action=action,
        ActorUserId=actor_user_id,
        Summary=summary,
        BeforeJson=json.dumps(before) if before else None,
        AfterJson=json.dumps(after) if after else None,
        CreatedAt=datetime.utcnow(),
    )
    db.add(audit)


def _EnsureKidHasChore(
    db: Session, kid_id: int, chore_id: int, entry_date: date
) -> tuple[Chore, ChoreAssignment]:
    chore = db.query(Chore).filter(Chore.Id == chore_id).first()
    if not chore:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

    assignment = (
        db.query(ChoreAssignment)
        .filter(ChoreAssignment.ChoreId == chore_id, ChoreAssignment.KidUserId == kid_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chore not assigned")

    if not IsChoreActiveOnDate(chore, entry_date) or not IsAssignmentActiveOnDate(assignment, entry_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chore not available for selected date",
        )
    return chore, assignment


def _KidBalance(db: Session, kid_user_id: int) -> float:
    total = (
        db.query(func.coalesce(func.sum(LedgerEntry.Amount), 0))
        .filter(LedgerEntry.KidUserId == kid_user_id, LedgerEntry.IsDeleted == False)
        .scalar()
    )
    return float(total or 0)


@router.get("/me/summary", response_model=KidsSummaryResponse)
def GetKidsSummary(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> KidsSummaryResponse:
    try:
        EnsurePocketMoneyCredits(db, user.Id, date.today())
        balance = _KidBalance(db, user.Id)
        entries = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.KidUserId == user.Id, LedgerEntry.IsDeleted == False)
            .order_by(LedgerEntry.CreatedAt.desc(), LedgerEntry.EntryDate.desc())
            .limit(8)
            .all()
        )
        creator_map = _LoadUserNames(db, {entry.CreatedByUserId for entry in entries})
        chores = _LoadAssignedChoresForDate(db, user.Id, TodayAdelaide())
        return KidsSummaryResponse(
            Balance=balance,
            RecentLedger=[
                _BuildLedgerOut(entry, creator_map.get(entry.CreatedByUserId)) for entry in entries
            ],
            AssignedChores=[_BuildChoreOut(chore) for chore in chores],
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/me/ledger", response_model=KidsLedgerResponse)
def GetKidsLedger(
    limit: int = 50,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> KidsLedgerResponse:
    try:
        EnsurePocketMoneyCredits(db, user.Id, date.today())
        entries = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.KidUserId == user.Id, LedgerEntry.IsDeleted == False)
            .order_by(LedgerEntry.EntryDate.desc(), LedgerEntry.CreatedAt.desc())
            .limit(limit)
            .all()
        )
        creator_map = _LoadUserNames(db, {entry.CreatedByUserId for entry in entries})
        return KidsLedgerResponse(
            Balance=_KidBalance(db, user.Id),
            Entries=[_BuildLedgerOut(entry, creator_map.get(entry.CreatedByUserId)) for entry in entries],
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/me/chores", response_model=list[ChoreOut])
def GetAssignedChores(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> list[ChoreOut]:
    try:
        chores = _LoadAssignedChoresForDate(db, user.Id, TodayAdelaide())
        return [_BuildChoreOut(chore) for chore in chores]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/me/overview", response_model=KidsOverviewResponse)
def GetKidsOverview(
    selected_date: date | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> KidsOverviewResponse:
    try:
        today = TodayAdelaide()
        allowed_start, allowed_end = AllowedDateRange(today)
        if selected_date is None:
            selected_date = today
        if selected_date < allowed_start or selected_date > allowed_end:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date is out of range")

        assignments = (
            db.query(ChoreAssignment)
            .filter(ChoreAssignment.KidUserId == user.Id)
            .order_by(ChoreAssignment.CreatedAt.asc())
            .all()
        )
        chore_ids = [assignment.ChoreId for assignment in assignments]
        chores = db.query(Chore).filter(Chore.Id.in_(chore_ids)).all() if chore_ids else []
        chore_map = {chore.Id: chore for chore in chores}

        chores_for_date = []
        for assignment in assignments:
            chore = chore_map.get(assignment.ChoreId)
            if not chore:
                continue
            if not IsChoreActiveOnDate(chore, selected_date):
                continue
            if not IsAssignmentActiveOnDate(assignment, selected_date):
                continue
            chores_for_date.append(chore)
        chores_for_date.sort(key=lambda chore: (chore.SortOrder, chore.Label.lower()))

        entries_for_date = (
            db.query(ChoreEntry)
            .filter(
                ChoreEntry.KidUserId == user.Id,
                ChoreEntry.EntryDate == selected_date,
                ChoreEntry.IsDeleted == False,
            )
            .order_by(ChoreEntry.CreatedAt.desc())
            .all()
        )

        month_start, month_end = MonthRange(today)
        month_entries = (
            db.query(ChoreEntry)
            .filter(
                ChoreEntry.KidUserId == user.Id,
                ChoreEntry.EntryDate >= month_start,
                ChoreEntry.EntryDate <= month_end,
                ChoreEntry.IsDeleted == False,
            )
            .all()
        )

        rule = db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == user.Id).first()
        monthly_allowance_cents = MonthlyAllowanceCents(rule.Amount if rule and rule.IsActive else None)
        days_in_month = (month_end - month_start).days + 1
        daily_slice_cents = RoundDailySlice(monthly_allowance_cents, days_in_month)

        projection_points, _summary, protected_by_date = BuildMonthProjection(
            today=today,
            month_start=month_start,
            month_end=month_end,
            daily_slice_cents=daily_slice_cents,
            chores=chores,
            assignments=assignments,
            entries=month_entries,
        )

        if selected_date in protected_by_date:
            day_protected = protected_by_date[selected_date]
        else:
            required_daily = {chore.Id for chore in chores_for_date if chore.Type == CHORE_TYPE_DAILY}
            approved_ids = {
                entry.ChoreId for entry in entries_for_date if entry.Status == STATUS_APPROVED
            }
            day_protected = required_daily.issubset(approved_ids) if required_daily else True

        entries_out = [
            _BuildChoreEntryOut(entry, chore_map.get(entry.ChoreId))
            for entry in entries_for_date
            if entry.ChoreId in chore_map
        ]
        projection_out = [
            {"Date": point.Date, "Amount": CentsToAmount(point.AmountCents)}
            for point in projection_points
        ]

        return KidsOverviewResponse(
            Today=today,
            SelectedDate=selected_date,
            AllowedStartDate=allowed_start,
            AllowedEndDate=allowed_end,
            MonthStart=month_start,
            MonthEnd=month_end,
            MonthlyAllowance=CentsToAmount(monthly_allowance_cents),
            DailySlice=CentsToAmount(daily_slice_cents),
            DayProtected=day_protected,
            Chores=[_BuildChoreOut(chore) for chore in chores_for_date],
            Entries=entries_out,
            Projection=projection_out,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/me/chore-entries", response_model=list[ChoreEntryOut])
def GetChoreEntries(
    limit: int = 50,
    include_deleted: bool = False,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> list[ChoreEntryOut]:
    try:
        query = db.query(ChoreEntry).filter(ChoreEntry.KidUserId == user.Id)
        if not include_deleted:
            query = query.filter(ChoreEntry.IsDeleted == False)
        entries = (
            query.order_by(ChoreEntry.EntryDate.desc(), ChoreEntry.CreatedAt.desc())
            .limit(limit)
            .all()
        )
        chores = {chore.Id: chore for chore in db.query(Chore).all()}
        return [
            _BuildChoreEntryOut(entry, chores.get(entry.ChoreId))
            for entry in entries
            if entry.ChoreId in chores
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/me/chore-entries", response_model=ChoreEntryOut, status_code=status.HTTP_201_CREATED)
def CreateChoreEntry(
    payload: ChoreEntryCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> ChoreEntryOut:
    try:
        today = TodayAdelaide()
        allowed_start, allowed_end = AllowedDateRange(today)
        if payload.EntryDate < allowed_start or payload.EntryDate > allowed_end:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date is out of range")

        chore, _assignment = _EnsureKidHasChore(db, user.Id, payload.ChoreId, payload.EntryDate)
        status_value = STATUS_PENDING if payload.EntryDate < today else STATUS_APPROVED
        amount_value = chore.Amount if chore.Type == CHORE_TYPE_BONUS else 0

        entry = (
            db.query(ChoreEntry)
            .filter(
                ChoreEntry.KidUserId == user.Id,
                ChoreEntry.ChoreId == chore.Id,
                ChoreEntry.EntryDate == payload.EntryDate,
            )
            .order_by(ChoreEntry.CreatedAt.desc())
            .first()
        )

        now = datetime.utcnow()
        if entry and not entry.IsDeleted:
            return _BuildChoreEntryOut(entry, chore)

        if entry:
            entry.Amount = amount_value
            entry.Notes = payload.Notes
            entry.Status = status_value
            entry.ChoreType = chore.Type
            entry.IsDeleted = False
            entry.UpdatedByUserId = user.Id
            entry.UpdatedAt = now
        else:
            entry = ChoreEntry(
                KidUserId=user.Id,
                ChoreId=chore.Id,
                EntryDate=payload.EntryDate,
                Amount=amount_value,
                Notes=payload.Notes,
                Status=status_value,
                ChoreType=chore.Type,
                IsDeleted=False,
                CreatedByUserId=user.Id,
                UpdatedByUserId=user.Id,
                CreatedAt=now,
                UpdatedAt=now,
            )
        db.add(entry)
        db.flush()

        _LogAuditEvent(
            db,
            entry,
            chore,
            action="Created",
            actor_user_id=user.Id,
            before=None,
            after=_SerializeEntry(entry, chore),
            summary="Added chore entry",
        )
        db.commit()
        db.refresh(entry)
        return _BuildChoreEntryOut(entry, chore)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.patch("/me/chore-entries/{entry_id}", response_model=ChoreEntryOut)
def UpdateChoreEntry(
    entry_id: int,
    payload: ChoreEntryUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> ChoreEntryOut:
    try:
        entry = (
            db.query(ChoreEntry)
            .filter(ChoreEntry.Id == entry_id, ChoreEntry.KidUserId == user.Id)
            .first()
        )
        if not entry or entry.IsDeleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore entry not found")

        next_date = payload.EntryDate or entry.EntryDate
        today = TodayAdelaide()
        allowed_start, allowed_end = AllowedDateRange(today)
        if next_date < allowed_start or next_date > allowed_end:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date is out of range")

        chore, _assignment = _EnsureKidHasChore(db, user.Id, payload.ChoreId or entry.ChoreId, next_date)
        before = _SerializeEntry(entry, chore)
        entry.ChoreId = chore.Id
        entry.EntryDate = next_date
        entry.Notes = payload.Notes
        entry.Amount = chore.Amount if chore.Type == CHORE_TYPE_BONUS else 0
        entry.Status = STATUS_PENDING if next_date < today else STATUS_APPROVED
        entry.ChoreType = chore.Type
        entry.UpdatedByUserId = user.Id
        entry.UpdatedAt = datetime.utcnow()
        db.add(entry)

        _LogAuditEvent(
            db,
            entry,
            chore,
            action="Updated",
            actor_user_id=user.Id,
            before=before,
            after=_SerializeEntry(entry, chore),
            summary="Updated chore entry",
        )
        db.commit()
        db.refresh(entry)
        return _BuildChoreEntryOut(entry, chore)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/me/chore-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteChoreEntry(
    entry_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> None:
    try:
        entry = (
            db.query(ChoreEntry)
            .filter(ChoreEntry.Id == entry_id, ChoreEntry.KidUserId == user.Id)
            .first()
        )
        if not entry or entry.IsDeleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore entry not found")

        chore = db.query(Chore).filter(Chore.Id == entry.ChoreId).first()
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        before = _SerializeEntry(entry, chore)
        entry.IsDeleted = True
        entry.UpdatedByUserId = user.Id
        entry.UpdatedAt = datetime.utcnow()
        db.add(entry)

        _LogAuditEvent(
            db,
            entry,
            chore,
            action="Deleted",
            actor_user_id=user.Id,
            before=before,
            after=_SerializeEntry(entry, chore),
            summary="Deleted chore entry",
        )
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/me/chore-entries/{entry_id}/audit", response_model=list[ChoreEntryAuditOut])
def GetChoreEntryAudit(
    entry_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsMember()),
) -> list[ChoreEntryAuditOut]:
    try:
        entry = (
            db.query(ChoreEntry)
            .filter(ChoreEntry.Id == entry_id, ChoreEntry.KidUserId == user.Id)
            .first()
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore entry not found")
        audits = (
            db.query(ChoreEntryAudit)
            .filter(ChoreEntryAudit.ChoreEntryId == entry_id)
            .order_by(ChoreEntryAudit.CreatedAt.desc())
            .all()
        )
        return [
            ChoreEntryAuditOut(
                Id=audit.Id,
                ChoreEntryId=audit.ChoreEntryId,
                Action=audit.Action,
                ActorUserId=audit.ActorUserId,
                Summary=audit.Summary,
                CreatedAt=audit.CreatedAt,
                BeforeJson=audit.BeforeJson,
                AfterJson=audit.AfterJson,
            )
            for audit in audits
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/children", response_model=list[KidLinkOut])
def ListKids(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> list[KidLinkOut]:
    try:
        kid_ids = [
            entry[0]
            for entry in db.query(KidLink.KidUserId)
            .order_by(KidLink.KidUserId.asc())
            .distinct()
            .all()
        ]
        kids = {kid.Id: kid for kid in db.query(User).filter(User.Id.in_(kid_ids)).all()}
        return [
            KidLinkOut(
                KidUserId=kid_id,
                Username=kids.get(kid_id).Username if kids.get(kid_id) else "",
                FirstName=kids.get(kid_id).FirstName if kids.get(kid_id) else None,
                LastName=kids.get(kid_id).LastName if kids.get(kid_id) else None,
            )
            for kid_id in kid_ids
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/children", response_model=KidLinkOut, status_code=status.HTTP_201_CREATED)
def AddKidLink(
    payload: KidLinkCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> KidLinkOut:
    try:
        kid = db.query(User).filter(User.Id == payload.KidUserId).first()
        if not kid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kid not found")

        existing = (
            db.query(KidLink)
            .filter(KidLink.ParentUserId == user.Id, KidLink.KidUserId == payload.KidUserId)
            .first()
        )
        if existing:
            return KidLinkOut(
                KidUserId=existing.KidUserId,
                Username=kid.Username,
                FirstName=kid.FirstName,
                LastName=kid.LastName,
            )

        link = KidLink(ParentUserId=user.Id, KidUserId=payload.KidUserId)
        db.add(link)
        db.commit()
        db.refresh(link)
        return KidLinkOut(
            KidUserId=link.KidUserId,
            Username=kid.Username,
            FirstName=kid.FirstName,
            LastName=kid.LastName,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/children/{kid_id}/ledger", response_model=KidsLedgerResponse)
def GetKidLedger(
    kid_id: int,
    limit: int = 100,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> KidsLedgerResponse:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        EnsurePocketMoneyCredits(db, kid_id, date.today())
        entries = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.KidUserId == kid_id, LedgerEntry.IsDeleted == False)
            .order_by(LedgerEntry.EntryDate.desc(), LedgerEntry.CreatedAt.desc())
            .limit(limit)
            .all()
        )
        creator_map = _LoadUserNames(db, {entry.CreatedByUserId for entry in entries})
        return KidsLedgerResponse(
            Balance=_KidBalance(db, kid_id),
            Entries=[_BuildLedgerOut(entry, creator_map.get(entry.CreatedByUserId)) for entry in entries],
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/children/{kid_id}/chore-entries", response_model=list[ChoreEntryOut])
def GetKidChoreEntries(
    kid_id: int,
    limit: int = 200,
    include_deleted: bool = True,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> list[ChoreEntryOut]:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        query = db.query(ChoreEntry).filter(ChoreEntry.KidUserId == kid_id)
        if not include_deleted:
            query = query.filter(ChoreEntry.IsDeleted == False)
        entries = (
            query.order_by(ChoreEntry.EntryDate.desc(), ChoreEntry.CreatedAt.desc())
            .limit(limit)
            .all()
        )
        chores = {chore.Id: chore for chore in db.query(Chore).all()}
        return [
            _BuildChoreEntryOut(entry, chores.get(entry.ChoreId))
            for entry in entries
            if entry.ChoreId in chores
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/children/{kid_id}/chore-entries/{entry_id}/audit", response_model=list[ChoreEntryAuditOut])
def GetKidChoreEntryAudit(
    kid_id: int,
    entry_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> list[ChoreEntryAuditOut]:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        entry = (
            db.query(ChoreEntry)
            .filter(ChoreEntry.Id == entry_id, ChoreEntry.KidUserId == kid_id)
            .first()
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore entry not found")
        audits = (
            db.query(ChoreEntryAudit)
            .filter(ChoreEntryAudit.ChoreEntryId == entry_id)
            .order_by(ChoreEntryAudit.CreatedAt.desc())
            .all()
        )
        return [
            ChoreEntryAuditOut(
                Id=audit.Id,
                ChoreEntryId=audit.ChoreEntryId,
                Action=audit.Action,
                ActorUserId=audit.ActorUserId,
                Summary=audit.Summary,
                CreatedAt=audit.CreatedAt,
                BeforeJson=audit.BeforeJson,
                AfterJson=audit.AfterJson,
            )
            for audit in audits
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/approvals", response_model=list[KidsApprovalOut])
def ListPendingApprovals(
    kid_id: int | None = None,
    chore_type: str | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> list[KidsApprovalOut]:
    try:
        if chore_type and chore_type not in {CHORE_TYPE_DAILY, CHORE_TYPE_HABIT, CHORE_TYPE_BONUS}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chore type")
        kid_ids = [
            entry[0]
            for entry in db.query(KidLink.KidUserId)
            .order_by(KidLink.KidUserId.asc())
            .distinct()
            .all()
        ]
        if kid_id is not None:
            if kid_id not in kid_ids:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kid not linked")
            kid_ids = [kid_id]
        if not kid_ids:
            return []

        entries = (
            db.query(ChoreEntry)
            .filter(
                ChoreEntry.KidUserId.in_(kid_ids),
                ChoreEntry.IsDeleted == False,
                ChoreEntry.Status == STATUS_PENDING,
            )
            .order_by(ChoreEntry.EntryDate.desc(), ChoreEntry.CreatedAt.desc())
            .all()
        )
        chore_ids = {entry.ChoreId for entry in entries}
        chore_map = (
            {chore.Id: chore for chore in db.query(Chore).filter(Chore.Id.in_(chore_ids)).all()}
            if chore_ids
            else {}
        )
        kid_name_map = _LoadUserNames(db, set(kid_ids))
        results = []
        for entry in entries:
            chore = chore_map.get(entry.ChoreId)
            if not chore:
                continue
            effective_type = entry.ChoreType or chore.Type
            if chore_type and chore_type != effective_type:
                continue
            kid_name = kid_name_map.get(entry.KidUserId, f"Kid {entry.KidUserId}")
            results.append(_BuildApprovalOut(entry, chore, kid_name))
        return results
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/approvals/{entry_id}/approve", response_model=ChoreEntryOut)
def ApproveChoreEntry(
    entry_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> ChoreEntryOut:
    try:
        entry = (
            db.query(ChoreEntry)
            .filter(ChoreEntry.Id == entry_id, ChoreEntry.IsDeleted == False)
            .first()
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore entry not found")
        _EnsureParentKidAccess(db, user.Id, entry.KidUserId)
        if entry.Status != STATUS_PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entry is not pending")

        chore = db.query(Chore).filter(Chore.Id == entry.ChoreId).first()
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        entry.Status = STATUS_APPROVED
        entry.ReviewedByUserId = user.Id
        entry.ReviewedAt = datetime.utcnow()
        entry.UpdatedByUserId = user.Id
        entry.UpdatedAt = datetime.utcnow()
        db.add(entry)
        _LogAuditEvent(
            db,
            entry,
            chore,
            action="Approved",
            actor_user_id=user.Id,
            before=None,
            after=_SerializeEntry(entry, chore),
            summary="Approved chore entry",
        )
        db.commit()
        db.refresh(entry)
        return _BuildChoreEntryOut(entry, chore)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/approvals/{entry_id}/reject", response_model=ChoreEntryOut)
def RejectChoreEntry(
    entry_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> ChoreEntryOut:
    try:
        entry = (
            db.query(ChoreEntry)
            .filter(ChoreEntry.Id == entry_id, ChoreEntry.IsDeleted == False)
            .first()
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore entry not found")
        _EnsureParentKidAccess(db, user.Id, entry.KidUserId)
        if entry.Status != STATUS_PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entry is not pending")

        chore = db.query(Chore).filter(Chore.Id == entry.ChoreId).first()
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        entry.Status = STATUS_REJECTED
        entry.ReviewedByUserId = user.Id
        entry.ReviewedAt = datetime.utcnow()
        entry.UpdatedByUserId = user.Id
        entry.UpdatedAt = datetime.utcnow()
        db.add(entry)
        _LogAuditEvent(
            db,
            entry,
            chore,
            action="Rejected",
            actor_user_id=user.Id,
            before=None,
            after=_SerializeEntry(entry, chore),
            summary="Rejected chore entry",
        )
        db.commit()
        db.refresh(entry)
        return _BuildChoreEntryOut(entry, chore)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/children/{kid_id}/month-summary", response_model=KidsMonthSummaryResponse)
def GetKidMonthSummary(
    kid_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> KidsMonthSummaryResponse:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        today = TodayAdelaide()
        month_start, month_end = MonthRange(today)

        assignments = (
            db.query(ChoreAssignment)
            .filter(ChoreAssignment.KidUserId == kid_id)
            .order_by(ChoreAssignment.CreatedAt.asc())
            .all()
        )
        chore_ids = [assignment.ChoreId for assignment in assignments]
        chores = db.query(Chore).filter(Chore.Id.in_(chore_ids)).all() if chore_ids else []

        entries = (
            db.query(ChoreEntry)
            .filter(
                ChoreEntry.KidUserId == kid_id,
                ChoreEntry.EntryDate >= month_start,
                ChoreEntry.EntryDate <= month_end,
                ChoreEntry.IsDeleted == False,
            )
            .all()
        )

        rule = db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == kid_id).first()
        monthly_allowance_cents = MonthlyAllowanceCents(rule.Amount if rule and rule.IsActive else None)
        days_in_month = (month_end - month_start).days + 1
        daily_slice_cents = RoundDailySlice(monthly_allowance_cents, days_in_month)

        _projection, summary, _protected_by_date = BuildMonthProjection(
            today=today,
            month_start=month_start,
            month_end=month_end,
            daily_slice_cents=daily_slice_cents,
            chores=chores,
            assignments=assignments,
            entries=entries,
        )

        missed_deduction_cents = summary.MissedDays * daily_slice_cents

        return KidsMonthSummaryResponse(
            MonthStart=month_start,
            MonthEnd=month_end,
            MonthlyAllowance=CentsToAmount(monthly_allowance_cents),
            DailySlice=CentsToAmount(daily_slice_cents),
            MissedDays=summary.MissedDays,
            MissedDeduction=CentsToAmount(missed_deduction_cents),
            ApprovedBonusTotal=CentsToAmount(summary.ApprovedBonusCents),
            PendingBonusTotal=CentsToAmount(summary.PendingBonusCents),
            ProjectedPayout=CentsToAmount(summary.ProjectedPayoutCents),
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/children/{kid_id}/ledger/deposit", response_model=LedgerEntryOut)
def AddDeposit(
    kid_id: int,
    payload: LedgerEntryCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> LedgerEntryOut:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        entry = LedgerEntry(
            KidUserId=kid_id,
            EntryType="Deposit",
            Amount=payload.Amount,
            EntryDate=payload.EntryDate,
            Narrative=payload.Narrative,
            Notes=payload.Notes,
            CreatedByUserId=user.Id,
            SourceType=None,
            SourceId=None,
            IsDeleted=False,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        creator_map = _LoadUserNames(db, {entry.CreatedByUserId})
        return _BuildLedgerOut(entry, creator_map.get(entry.CreatedByUserId))
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/children/{kid_id}/ledger/withdrawal", response_model=LedgerEntryOut)
def AddWithdrawal(
    kid_id: int,
    payload: LedgerEntryCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> LedgerEntryOut:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        amount = -abs(payload.Amount)
        entry = LedgerEntry(
            KidUserId=kid_id,
            EntryType="Withdrawal",
            Amount=amount,
            EntryDate=payload.EntryDate,
            Narrative=payload.Narrative,
            Notes=payload.Notes,
            CreatedByUserId=user.Id,
            SourceType=None,
            SourceId=None,
            IsDeleted=False,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        creator_map = _LoadUserNames(db, {entry.CreatedByUserId})
        return _BuildLedgerOut(entry, creator_map.get(entry.CreatedByUserId))
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/children/{kid_id}/ledger/starting-balance", response_model=LedgerEntryOut)
def AddStartingBalance(
    kid_id: int,
    payload: LedgerEntryCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> LedgerEntryOut:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        EnsurePocketMoneyCredits(db, kid_id, date.today())
        current_balance = _KidBalance(db, kid_id)
        adjustment = payload.Amount - current_balance
        entry = LedgerEntry(
            KidUserId=kid_id,
            EntryType="StartingBalance",
            Amount=adjustment,
            EntryDate=payload.EntryDate,
            Narrative=payload.Narrative,
            Notes=payload.Notes,
            CreatedByUserId=user.Id,
            SourceType=None,
            SourceId=None,
            IsDeleted=False,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        creator_map = _LoadUserNames(db, {entry.CreatedByUserId})
        return _BuildLedgerOut(entry, creator_map.get(entry.CreatedByUserId))
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/children/{kid_id}/pocket-money", response_model=PocketMoneyRuleOut | None)
def GetPocketMoneyRule(
    kid_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> PocketMoneyRuleOut | None:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        rule = db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == kid_id).first()
        if not rule:
            return None
        return PocketMoneyRuleOut(
            Id=rule.Id,
            KidUserId=rule.KidUserId,
            Amount=float(rule.Amount),
            Frequency=rule.Frequency,
            DayOfWeek=rule.DayOfWeek,
            DayOfMonth=rule.DayOfMonth,
            StartDate=rule.StartDate,
            LastPostedOn=rule.LastPostedOn,
            IsActive=rule.IsActive,
            CreatedByUserId=rule.CreatedByUserId,
            CreatedAt=rule.CreatedAt,
            UpdatedAt=rule.UpdatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/parents/children/{kid_id}/pocket-money", response_model=PocketMoneyRuleOut)
def UpsertPocketMoneyRule(
    kid_id: int,
    payload: PocketMoneyRuleUpsert,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> PocketMoneyRuleOut:
    try:
        _EnsureParentKidAccess(db, user.Id, kid_id)
        if payload.Frequency not in {"weekly", "fortnightly", "monthly"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid frequency")
        if payload.Frequency in {"weekly", "fortnightly"} and payload.DayOfWeek is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Day of week required")
        if payload.Frequency == "monthly" and payload.DayOfMonth is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Day of month required")

        rule = db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == kid_id).first()
        now = datetime.utcnow()
        if rule:
            rule.Amount = payload.Amount
            rule.Frequency = payload.Frequency
            rule.DayOfWeek = payload.DayOfWeek
            rule.DayOfMonth = payload.DayOfMonth
            rule.StartDate = payload.StartDate
            rule.IsActive = payload.IsActive
            rule.UpdatedAt = now
        else:
            rule = PocketMoneyRule(
                KidUserId=kid_id,
                Amount=payload.Amount,
                Frequency=payload.Frequency,
                DayOfWeek=payload.DayOfWeek,
                DayOfMonth=payload.DayOfMonth,
                StartDate=payload.StartDate,
                IsActive=payload.IsActive,
                CreatedByUserId=user.Id,
                CreatedAt=now,
                UpdatedAt=now,
            )
            db.add(rule)
        db.commit()
        db.refresh(rule)
        return PocketMoneyRuleOut(
            Id=rule.Id,
            KidUserId=rule.KidUserId,
            Amount=float(rule.Amount),
            Frequency=rule.Frequency,
            DayOfWeek=rule.DayOfWeek,
            DayOfMonth=rule.DayOfMonth,
            StartDate=rule.StartDate,
            LastPostedOn=rule.LastPostedOn,
            IsActive=rule.IsActive,
            CreatedByUserId=rule.CreatedByUserId,
            CreatedAt=rule.CreatedAt,
            UpdatedAt=rule.UpdatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/parents/chores", response_model=list[ChoreOut])
def ListChores(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> list[ChoreOut]:
    try:
        chores = (
            db.query(Chore)
            .filter(Chore.OwnerUserId == user.Id)
            .order_by(Chore.SortOrder.asc(), Chore.Label.asc())
            .all()
        )
        chore_ids = [chore.Id for chore in chores]
        assignments = (
            db.query(ChoreAssignment)
            .filter(ChoreAssignment.ChoreId.in_(chore_ids))
            .all()
            if chore_ids
            else []
        )
        assigned_map: dict[int, list[int]] = {}
        for assignment in assignments:
            assigned_map.setdefault(assignment.ChoreId, []).append(assignment.KidUserId)
        return [
            _BuildChoreOut(chore, assigned_map.get(chore.Id, []))
            for chore in chores
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/chores", response_model=ChoreOut, status_code=status.HTTP_201_CREATED)
def CreateChore(
    payload: ChoreCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> ChoreOut:
    try:
        if payload.Type not in {CHORE_TYPE_DAILY, CHORE_TYPE_HABIT, CHORE_TYPE_BONUS}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chore type")

        amount_value = payload.Amount or 0
        if payload.Type != CHORE_TYPE_BONUS:
            amount_value = 0
        if payload.Type == CHORE_TYPE_BONUS and amount_value <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bonus amount required")

        now = datetime.utcnow()
        today = TodayAdelaide()
        chore = Chore(
            OwnerUserId=user.Id,
            Label=payload.Label,
            Type=payload.Type,
            Amount=amount_value,
            IsActive=payload.IsActive,
            SortOrder=payload.SortOrder,
            StartsOn=today,
            DisabledOn=None,
            CreatedAt=now,
            UpdatedAt=now,
        )
        db.add(chore)
        db.commit()
        db.refresh(chore)
        return _BuildChoreOut(chore)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.patch("/parents/chores/{chore_id}", response_model=ChoreOut)
def UpdateChore(
    chore_id: int,
    payload: ChoreUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> ChoreOut:
    try:
        chore = (
            db.query(Chore)
            .filter(Chore.Id == chore_id, Chore.OwnerUserId == user.Id)
            .first()
        )
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        if payload.Label is not None:
            chore.Label = payload.Label
        if payload.Type is not None:
            if payload.Type not in {CHORE_TYPE_DAILY, CHORE_TYPE_HABIT, CHORE_TYPE_BONUS}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chore type")
            chore.Type = payload.Type
        if payload.Amount is not None:
            chore.Amount = payload.Amount
        if payload.IsActive is not None:
            if payload.IsActive and not chore.IsActive:
                chore.StartsOn = TodayAdelaide()
                chore.DisabledOn = None
            if not payload.IsActive and chore.IsActive:
                chore.DisabledOn = TodayAdelaide()
            chore.IsActive = payload.IsActive
        if payload.SortOrder is not None:
            chore.SortOrder = payload.SortOrder

        if chore.Type != CHORE_TYPE_BONUS:
            chore.Amount = 0
        if chore.Type == CHORE_TYPE_BONUS and chore.Amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bonus amount required")
        chore.UpdatedAt = datetime.utcnow()
        db.commit()
        db.refresh(chore)
        return _BuildChoreOut(chore)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/parents/chores/{chore_id}", status_code=status.HTTP_204_NO_CONTENT)
def ArchiveChore(
    chore_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> None:
    try:
        chore = (
            db.query(Chore)
            .filter(Chore.Id == chore_id, Chore.OwnerUserId == user.Id)
            .first()
        )
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        chore.IsActive = False
        chore.DisabledOn = TodayAdelaide()
        chore.UpdatedAt = datetime.utcnow()
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/parents/chores/{chore_id}/assign", status_code=status.HTTP_204_NO_CONTENT)
def AssignChore(
    chore_id: int,
    payload: ChoreAssignmentRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> None:
    try:
        chore = (
            db.query(Chore)
            .filter(Chore.Id == chore_id, Chore.OwnerUserId == user.Id)
            .first()
        )
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        kid_ids = payload.KidUserIds or []
        if not kid_ids:
            return

        today = TodayAdelaide()
        now = datetime.utcnow()

        links = (
            db.query(KidLink)
            .filter(KidLink.KidUserId.in_(kid_ids))
            .all()
        )
        linked_ids = {link.KidUserId for link in links}
        for kid_id in kid_ids:
            if kid_id not in linked_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Kid not linked",
                )

        existing = (
            db.query(ChoreAssignment)
            .filter(ChoreAssignment.ChoreId == chore_id, ChoreAssignment.KidUserId.in_(kid_ids))
            .all()
        )
        existing_map = {entry.KidUserId: entry for entry in existing}
        for kid_id in kid_ids:
            if kid_id in existing_map:
                assignment = existing_map[kid_id]
                if not assignment.IsEnabled:
                    assignment.IsEnabled = True
                    assignment.StartsOn = today
                    assignment.DisabledOn = None
                assignment.UpdatedAt = now
                db.add(assignment)
                continue
            db.add(
                ChoreAssignment(
                    ChoreId=chore_id,
                    KidUserId=kid_id,
                    IsEnabled=True,
                    StartsOn=today,
                    DisabledOn=None,
                    CreatedAt=now,
                    UpdatedAt=now,
                )
            )
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/parents/chores/{chore_id}/assignments", status_code=status.HTTP_204_NO_CONTENT)
def SetChoreAssignments(
    chore_id: int,
    payload: ChoreAssignmentRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireKidsManager()),
) -> None:
    try:
        chore = (
            db.query(Chore)
            .filter(Chore.Id == chore_id, Chore.OwnerUserId == user.Id)
            .first()
        )
        if not chore:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found")

        kid_ids = payload.KidUserIds or []
        if kid_ids:
            links = (
                db.query(KidLink)
                .filter(KidLink.KidUserId.in_(kid_ids))
                .all()
            )
            linked_ids = {link.KidUserId for link in links}
            for kid_id in kid_ids:
                if kid_id not in linked_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Kid not linked",
                    )

        existing = (
            db.query(ChoreAssignment)
            .filter(ChoreAssignment.ChoreId == chore_id)
            .all()
        )
        existing_ids = {entry.KidUserId for entry in existing}
        existing_map = {entry.KidUserId: entry for entry in existing}
        today = TodayAdelaide()
        now = datetime.utcnow()

        for entry in existing:
            if entry.KidUserId not in kid_ids:
                if entry.IsEnabled:
                    entry.IsEnabled = False
                    entry.DisabledOn = today
                entry.UpdatedAt = now
                db.add(entry)

        for kid_id in kid_ids:
            if kid_id in existing_ids:
                assignment = existing_map[kid_id]
                if not assignment.IsEnabled:
                    assignment.IsEnabled = True
                    assignment.StartsOn = today
                    assignment.DisabledOn = None
                assignment.UpdatedAt = now
                db.add(assignment)
                continue
            db.add(
                ChoreAssignment(
                    ChoreId=chore_id,
                    KidUserId=kid_id,
                    IsEnabled=True,
                    StartsOn=today,
                    DisabledOn=None,
                    CreatedAt=now,
                    UpdatedAt=now,
                )
            )
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)
