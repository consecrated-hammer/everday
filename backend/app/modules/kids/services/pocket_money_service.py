from __future__ import annotations

from datetime import date, timedelta
import calendar

from sqlalchemy.orm import Session

from app.modules.kids.models import LedgerEntry, PocketMoneyRule


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
    rule = db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == kid_user_id).first()
    if not rule or not rule.IsActive:
        return []

    due_dates = _IterScheduleDates(rule, today)
    if not due_dates:
        return []

    existing_rows = (
        db.query(LedgerEntry.EntryDate)
        .filter(
            LedgerEntry.KidUserId == kid_user_id,
            LedgerEntry.SourceType == "PocketMoneyRule",
            LedgerEntry.SourceId == rule.Id,
            LedgerEntry.EntryDate.in_(due_dates),
        )
        .all()
    )
    existing_dates = {row.EntryDate for row in existing_rows}
    created = []
    last_posted = rule.LastPostedOn
    for run_date in due_dates:
        if run_date in existing_dates:
            if not last_posted or run_date > last_posted:
                last_posted = run_date
            continue
        entry = LedgerEntry(
            KidUserId=kid_user_id,
            EntryType="PocketMoney",
            Amount=rule.Amount,
            EntryDate=run_date,
            Narrative="Pocket money",
            Notes=None,
            CreatedByUserId=rule.CreatedByUserId,
            SourceType="PocketMoneyRule",
            SourceId=rule.Id,
            IsDeleted=False,
        )
        db.add(entry)
        created.append(entry)
        if not last_posted or run_date > last_posted:
            last_posted = run_date

    if last_posted:
        rule.LastPostedOn = last_posted
        db.add(rule)
    db.commit()
    for entry in created:
        db.refresh(entry)
    return created
