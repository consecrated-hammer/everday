from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import calendar


def _DaysInMonth(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _NormalizeFrequency(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in {"annual", "annually"}:
        return "yearly"
    if normalized in {"biweekly", "bi-weekly"}:
        return "fortnightly"
    return normalized


def AddMonths(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, _DaysInMonth(year, month))
    return date(year, month, day)


def AddYears(value: date, years: int) -> date:
    return AddMonths(value, years * 12)


def FinancialYearRange(today: date, start_month: int, start_day: int) -> tuple[date, date]:
    start = date(today.year, start_month, start_day)
    if today < start:
        start = date(today.year - 1, start_month, start_day)
    end = AddYears(start, 1) - timedelta(days=1)
    return start, end


def _Advance(current: date, frequency: str) -> date:
    freq = _NormalizeFrequency(frequency)
    if freq == "weekly":
        return current + timedelta(days=7)
    if freq == "fortnightly":
        return current + timedelta(days=14)
    if freq == "monthly":
        return AddMonths(current, 1)
    if freq == "quarterly":
        return AddMonths(current, 3)
    if freq == "yearly":
        return AddYears(current, 1)
    raise ValueError(f"Unsupported frequency: {frequency}")


def LastNextOccurrence(
    first_date: date,
    frequency: str,
    today: date,
    end_date: date | None,
) -> tuple[date | None, date | None]:
    if end_date and end_date < first_date:
        return None, None
    current = first_date
    last = None
    safety = 0
    while current < today:
        if end_date and current > end_date:
            return last, None
        last = current
        current = _Advance(current, frequency)
        safety += 1
        if safety > 10000:
            break

    if end_date and current > end_date:
        return last, None
    return last if last else None, current


def AnnualizedBreakdown(
    amount: Decimal,
    frequency: str,
    range_start: date,
    range_end: date,
) -> dict[str, Decimal]:
    freq = _NormalizeFrequency(frequency)
    multiplier = {
        "weekly": Decimal(52),
        "fortnightly": Decimal(26),
        "monthly": Decimal(12),
        "quarterly": Decimal(4),
        "yearly": Decimal(1),
    }.get(freq, Decimal(0))
    per_year = amount * multiplier
    days = (range_end - range_start).days + 1
    if days <= 0:
        return {
            "PerDay": Decimal("0"),
            "PerWeek": Decimal("0"),
            "PerFortnight": Decimal("0"),
            "PerMonth": Decimal("0"),
            "PerYear": Decimal("0"),
        }

    per_day = per_year / Decimal(days)
    return {
        "PerDay": per_day,
        "PerWeek": per_day * Decimal(7),
        "PerFortnight": per_day * Decimal(14),
        "PerMonth": per_year / Decimal(12),
        "PerYear": per_year,
    }
