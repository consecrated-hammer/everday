from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.modules.kids.models import Chore, ChoreAssignment, ChoreEntry

ADL_TZ = ZoneInfo("Australia/Adelaide")
DEFAULT_MONTHLY_ALLOWANCE_CENTS = 4000

CHORE_TYPE_DAILY = "Daily"
CHORE_TYPE_HABIT = "Habit"
CHORE_TYPE_BONUS = "Bonus"

STATUS_PENDING = "Pending"
STATUS_APPROVED = "Approved"
STATUS_REJECTED = "Rejected"


@dataclass(frozen=True)
class ProjectionPoint:
    Date: date
    AmountCents: int


@dataclass(frozen=True)
class MonthSummary:
    MissedDays: int
    ApprovedBonusCents: int
    PendingBonusCents: int
    ProjectedPayoutCents: int


def TodayAdelaide() -> date:
    return datetime.now(tz=ADL_TZ).date()


def DaysInMonth(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def MonthRange(today: date) -> tuple[date, date]:
    start = date(today.year, today.month, 1)
    end = date(today.year, today.month, DaysInMonth(today.year, today.month))
    return start, end


def AllowedDateRange(today: date) -> tuple[date, date]:
    start = date(1970, 1, 1)
    return start, today


def RoundDailySlice(monthly_allowance_cents: int, days_in_month: int) -> int:
    if days_in_month <= 0:
        return 0
    return (monthly_allowance_cents + days_in_month // 2) // days_in_month


def AmountToCents(value: Decimal | float | int | None) -> int:
    if value is None:
        return 0
    return int(Decimal(str(value)) * 100)


def CentsToAmount(value: int) -> float:
    return float(Decimal(value) / Decimal(100))


def IsActiveOnDate(is_enabled: bool, starts_on: date | None, disabled_on: date | None, on_date: date) -> bool:
    if starts_on and on_date < starts_on:
        return False
    if disabled_on and on_date > disabled_on:
        return False
    if not is_enabled and disabled_on is None:
        return False
    return True


def IsChoreActiveOnDate(chore: Chore, on_date: date) -> bool:
    return IsActiveOnDate(chore.IsActive, chore.StartsOn, chore.DisabledOn, on_date)


def IsAssignmentActiveOnDate(assignment: ChoreAssignment, on_date: date) -> bool:
    return IsActiveOnDate(assignment.IsEnabled, assignment.StartsOn, assignment.DisabledOn, on_date)


def MonthlyAllowanceCents(rule_amount: Decimal | float | int | None) -> int:
    if rule_amount is None:
        return DEFAULT_MONTHLY_ALLOWANCE_CENTS
    cents = AmountToCents(rule_amount)
    return cents if cents > 0 else DEFAULT_MONTHLY_ALLOWANCE_CENTS


def BuildMonthProjection(
    today: date,
    month_start: date,
    month_end: date,
    daily_slice_cents: int,
    chores: list[Chore],
    assignments: list[ChoreAssignment],
    entries: list[ChoreEntry],
) -> tuple[list[ProjectionPoint], MonthSummary, dict[date, bool]]:
    chore_by_id = {chore.Id: chore for chore in chores}
    assignment_by_chore: dict[int, list[ChoreAssignment]] = {}
    for assignment in assignments:
        assignment_by_chore.setdefault(assignment.ChoreId, []).append(assignment)

    approved_by_date: dict[date, set[int]] = {}
    approved_bonus_by_date: dict[date, int] = {}
    pending_bonus_total = 0
    approved_bonus_total = 0

    for entry in entries:
        if entry.IsDeleted:
            continue
        entry_date = entry.EntryDate
        chore = chore_by_id.get(entry.ChoreId)
        chore_type = entry.ChoreType or (chore.Type if chore else None)
        status = entry.Status
        amount_cents = AmountToCents(entry.Amount)
        if status == STATUS_APPROVED:
            approved_by_date.setdefault(entry_date, set()).add(entry.ChoreId)
            if chore_type == CHORE_TYPE_BONUS and amount_cents:
                approved_bonus_by_date[entry_date] = approved_bonus_by_date.get(entry_date, 0) + amount_cents
                approved_bonus_total += amount_cents
        elif status == STATUS_PENDING and chore_type == CHORE_TYPE_BONUS and amount_cents:
            pending_bonus_total += amount_cents

    def _RequiredDailyChores(on_date: date) -> set[int]:
        required: set[int] = set()
        for chore in chores:
            if chore.Type != CHORE_TYPE_DAILY:
                continue
            if not IsChoreActiveOnDate(chore, on_date):
                continue
            assignments_for_chore = assignment_by_chore.get(chore.Id, [])
            if not assignments_for_chore:
                continue
            if not any(IsAssignmentActiveOnDate(assignment, on_date) for assignment in assignments_for_chore):
                continue
            required.add(chore.Id)
        return required

    def _IsProtected(on_date: date) -> bool:
        required = _RequiredDailyChores(on_date)
        if not required:
            return True
        approved = approved_by_date.get(on_date, set())
        return required.issubset(approved)

    today_protected = _IsProtected(today)
    missed_days = 0
    running = 0
    projection: list[ProjectionPoint] = []
    protected_by_date: dict[date, bool] = {}

    cursor = month_start
    while cursor <= month_end:
        protected = _IsProtected(cursor)
        protected_by_date[cursor] = protected
        if cursor < today:
            if protected:
                running += daily_slice_cents
            else:
                missed_days += 1
        elif cursor == today:
            if protected:
                running += daily_slice_cents
        else:
            if today_protected:
                running += daily_slice_cents
        running += approved_bonus_by_date.get(cursor, 0)
        projection.append(ProjectionPoint(Date=cursor, AmountCents=running))
        cursor = cursor + timedelta(days=1)

    projected_payout = projection[-1].AmountCents if projection else 0
    summary = MonthSummary(
        MissedDays=missed_days,
        ApprovedBonusCents=approved_bonus_total,
        PendingBonusCents=pending_bonus_total,
        ProjectedPayoutCents=max(projected_payout, 0),
    )
    return projection, summary, protected_by_date
