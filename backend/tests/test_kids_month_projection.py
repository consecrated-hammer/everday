from datetime import date
from types import SimpleNamespace

from app.modules.kids.services.chores_v2_service import (
    BuildMonthProjection,
    CHORE_TYPE_DAILY,
    RoundDailySlice,
    STATUS_APPROVED,
)


def _DailyChore() -> SimpleNamespace:
    return SimpleNamespace(
        Id=1,
        Type=CHORE_TYPE_DAILY,
        IsActive=True,
        StartsOn=None,
        DisabledOn=None,
    )


def _Assignment() -> SimpleNamespace:
    return SimpleNamespace(
        ChoreId=1,
        IsEnabled=True,
        StartsOn=None,
        DisabledOn=None,
    )


def _ApprovedEntry(entry_date: date) -> SimpleNamespace:
    return SimpleNamespace(
        IsDeleted=False,
        EntryDate=entry_date,
        ChoreId=1,
        ChoreType=CHORE_TYPE_DAILY,
        Status=STATUS_APPROVED,
        Amount=0,
    )


def test_closed_month_missed_days_reduce_payout_exactly() -> None:
    month_start = date(2026, 4, 1)
    month_end = date(2026, 4, 30)
    monthly_allowance_cents = 3000  # $30
    daily_slice_cents = RoundDailySlice(monthly_allowance_cents, 30)

    # 20 completed days, 10 missed days.
    entries = [_ApprovedEntry(date(2026, 4, day)) for day in range(1, 21)]

    _projection, summary, _protected = BuildMonthProjection(
        today=month_end,
        month_start=month_start,
        month_end=month_end,
        daily_slice_cents=daily_slice_cents,
        monthly_allowance_cents=monthly_allowance_cents,
        chores=[_DailyChore()],
        assignments=[_Assignment()],
        entries=entries,
    )

    assert summary.MissedDays == 10
    assert summary.MissedDeductionCents == 1000
    assert summary.ProjectedPayoutCents == 2000


def test_closed_month_cap_never_exceeds_monthly_allowance() -> None:
    month_start = date(2026, 5, 1)
    month_end = date(2026, 5, 31)
    monthly_allowance_cents = 3000  # $30
    daily_slice_cents = RoundDailySlice(monthly_allowance_cents, 31)  # rounds to 97c

    # All days completed.
    entries = [_ApprovedEntry(date(2026, 5, day)) for day in range(1, 32)]

    _projection, summary, _protected = BuildMonthProjection(
        today=month_end,
        month_start=month_start,
        month_end=month_end,
        daily_slice_cents=daily_slice_cents,
        monthly_allowance_cents=monthly_allowance_cents,
        chores=[_DailyChore()],
        assignments=[_Assignment()],
        entries=entries,
    )

    assert summary.MissedDays == 0
    assert summary.MissedDeductionCents == 0
    assert summary.ProjectedPayoutCents == 3000


def test_current_month_projection_keeps_future_earning_potential() -> None:
    month_start = date(2026, 6, 1)
    month_end = date(2026, 6, 30)
    today = date(2026, 6, 10)
    monthly_allowance_cents = 3000
    daily_slice_cents = RoundDailySlice(monthly_allowance_cents, 30)

    # Nothing completed yet.
    entries: list[SimpleNamespace] = []

    _projection, summary, _protected = BuildMonthProjection(
        today=today,
        month_start=month_start,
        month_end=month_end,
        daily_slice_cents=daily_slice_cents,
        monthly_allowance_cents=monthly_allowance_cents,
        chores=[_DailyChore()],
        assignments=[_Assignment()],
        entries=entries,
    )

    # Days 1..9 are missed (9). Days 11..30 remain potential (20 days).
    assert summary.MissedDays == 9
    assert summary.MissedDeductionCents == 900
    assert summary.ProjectedPayoutCents == 2000
