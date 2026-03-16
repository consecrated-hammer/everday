from __future__ import annotations

from datetime import date, timedelta
import calendar

from sqlalchemy.orm import Session

from app.modules.kids.models import Chore, ChoreAssignment, ChoreEntry, LedgerEntry, PocketMoneyRule
from app.modules.kids.services.chores_v2_service import (
    BuildMonthProjection,
    CentsToAmount,
    MonthlyAllowanceCents,
    RoundDailySlice,
)

MONTHLY_PAYOUT_SOURCE_TYPE = "KidsMonthlyPayout"
MONTHLY_PAYOUT_ENTRY_TYPE = "PocketMoney"


def _DaysInMonth(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _NextWeekly(after_date: date, day_of_week: int) -> date:
    delta = (day_of_week - after_date.weekday()) % 7
    if delta == 0:
        delta = 7
    return after_date + timedelta(days=delta)


def _NextFortnightly(after_date: date, anchor_date: date) -> date:
    if after_date < anchor_date:
        return anchor_date
    delta_days = (after_date - anchor_date).days
    remainder = delta_days % 14
    if remainder == 0:
        return after_date + timedelta(days=14)
    return after_date + timedelta(days=(14 - remainder))


def _NextMonthly(after_date: date, day_of_month: int) -> date:
    year = after_date.year
    month = after_date.month + 1
    if month > 12:
        month = 1
        year += 1
    day = min(day_of_month, _DaysInMonth(year, month))
    return date(year, month, day)


def _FirstMonthly(start_date: date, day_of_month: int) -> date:
    day = min(day_of_month, _DaysInMonth(start_date.year, start_date.month))
    candidate = date(start_date.year, start_date.month, day)
    if candidate < start_date:
        return _NextMonthly(start_date, day_of_month)
    return candidate


def _IterScheduleDates(rule: PocketMoneyRule, through_date: date) -> list[date]:
    if not rule.IsActive:
        return []

    if rule.Frequency == "weekly":
        if rule.DayOfWeek is None:
            return []
        if rule.LastPostedOn:
            current = _NextWeekly(rule.LastPostedOn, rule.DayOfWeek)
        else:
            current = rule.StartDate
            if current.weekday() != rule.DayOfWeek:
                current = _NextWeekly(current - timedelta(days=1), rule.DayOfWeek)
    elif rule.Frequency == "fortnightly":
        if rule.DayOfWeek is None:
            return []
        anchor = rule.StartDate
        if anchor.weekday() != rule.DayOfWeek:
            anchor = _NextWeekly(anchor - timedelta(days=1), rule.DayOfWeek)
        if rule.LastPostedOn:
            current = _NextFortnightly(rule.LastPostedOn, anchor)
        else:
            current = anchor
    elif rule.Frequency == "monthly":
        if rule.DayOfMonth is None:
            return []
        if rule.LastPostedOn:
            current = _NextMonthly(rule.LastPostedOn, rule.DayOfMonth)
        else:
            current = _FirstMonthly(rule.StartDate, rule.DayOfMonth)
    else:
        return []

    dates = []
    while current <= through_date:
        dates.append(current)
        if rule.Frequency == "weekly":
            current = _NextWeekly(current, rule.DayOfWeek)
        elif rule.Frequency == "fortnightly":
            anchor = rule.StartDate
            if anchor.weekday() != rule.DayOfWeek:
                anchor = _NextWeekly(anchor - timedelta(days=1), rule.DayOfWeek)
            current = _NextFortnightly(current, anchor)
        else:
            current = _NextMonthly(current, rule.DayOfMonth)
    return dates


def ComputePocketMoneyDates(rule: PocketMoneyRule, through_date: date) -> list[date]:
    return _IterScheduleDates(rule, through_date)


def EnsurePocketMoneyCredits(
    db: Session,
    kid_user_id: int,
    today: date,
) -> list[LedgerEntry]:
    """Post month-close allowance payouts based on chore completion."""
    rule = db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == kid_user_id).first()
    if not rule or not rule.IsActive:
        return []

    payout_start = rule.StartDate
    if rule.LastPostedOn and rule.LastPostedOn >= payout_start:
        payout_start = rule.LastPostedOn + timedelta(days=1)

    current_month_start = date(today.year, today.month, 1)
    last_closed_day = current_month_start - timedelta(days=1)
    if payout_start > last_closed_day:
        return []

    chores, assignments = _LoadAssignedChores(db, kid_user_id)
    monthly_allowance_cents = MonthlyAllowanceCents(rule.Amount)
    month_starts = _ClosedMonthStarts(payout_start, last_closed_day)

    created = []
    last_posted = rule.LastPostedOn
    for month_start in month_starts:
        month_end = date(month_start.year, month_start.month, _DaysInMonth(month_start.year, month_start.month))
        source_id = _MonthSourceId(month_start)

        existing = (
            db.query(LedgerEntry.Id)
            .filter(
                LedgerEntry.KidUserId == kid_user_id,
                LedgerEntry.SourceType == MONTHLY_PAYOUT_SOURCE_TYPE,
                LedgerEntry.SourceId == source_id,
                LedgerEntry.EntryDate == month_end,
            )
            .first()
        )
        if existing:
            if not last_posted or month_end > last_posted:
                last_posted = month_end
            continue

        month_entries = (
            db.query(ChoreEntry)
            .filter(
                ChoreEntry.KidUserId == kid_user_id,
                ChoreEntry.EntryDate >= month_start,
                ChoreEntry.EntryDate <= month_end,
                ChoreEntry.IsDeleted == False,
            )
            .all()
        )
        days_in_month = _DaysInMonth(month_start.year, month_start.month)
        daily_slice_cents = RoundDailySlice(monthly_allowance_cents, days_in_month)
        _projection, summary, _protected = BuildMonthProjection(
            today=month_end,
            month_start=month_start,
            month_end=month_end,
            daily_slice_cents=daily_slice_cents,
            monthly_allowance_cents=monthly_allowance_cents,
            chores=chores,
            assignments=assignments,
            entries=month_entries,
        )

        payout_amount = CentsToAmount(summary.ProjectedPayoutCents)
        month_label = month_start.strftime("%b %Y")
        entry = LedgerEntry(
            KidUserId=kid_user_id,
            EntryType=MONTHLY_PAYOUT_ENTRY_TYPE,
            Amount=payout_amount,
            EntryDate=month_end,
            Narrative=f"Monthly chore allowance ({month_label})",
            Notes=None,
            CreatedByUserId=rule.CreatedByUserId,
            SourceType=MONTHLY_PAYOUT_SOURCE_TYPE,
            SourceId=source_id,
            IsDeleted=False,
        )
        db.add(entry)
        created.append(entry)
        if not last_posted or month_end > last_posted:
            last_posted = month_end

    if last_posted:
        rule.LastPostedOn = last_posted
        db.add(rule)
    db.commit()
    for entry in created:
        db.refresh(entry)
    return created


def _LoadAssignedChores(db: Session, kid_user_id: int) -> tuple[list[Chore], list[ChoreAssignment]]:
    assignments = (
        db.query(ChoreAssignment)
        .filter(ChoreAssignment.KidUserId == kid_user_id)
        .order_by(ChoreAssignment.CreatedAt.asc())
        .all()
    )
    chore_ids = [assignment.ChoreId for assignment in assignments]
    chores = db.query(Chore).filter(Chore.Id.in_(chore_ids)).all() if chore_ids else []
    return chores, assignments


def _ClosedMonthStarts(start_date: date, last_closed_day: date) -> list[date]:
    first = date(start_date.year, start_date.month, 1)
    last = date(last_closed_day.year, last_closed_day.month, 1)
    if first > last:
        return []

    values: list[date] = []
    cursor = first
    while cursor <= last:
        values.append(cursor)
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return values


def _MonthSourceId(value: date) -> int:
    return value.year * 100 + value.month
