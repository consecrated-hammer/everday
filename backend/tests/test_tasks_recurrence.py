from datetime import date

from app.modules.tasks.services import ComputeNextOccurrenceDate


def test_next_monthly_handles_month_end():
    start = date(2024, 1, 31)
    next_date = ComputeNextOccurrenceDate(start, "monthly", 1, [], None)
    assert next_date == date(2024, 2, 29)


def test_next_yearly_handles_leap_day():
    start = date(2024, 2, 29)
    next_date = ComputeNextOccurrenceDate(start, "yearly", 1, [], None)
    assert next_date == date(2025, 2, 28)


def test_next_weekly_with_weekdays():
    start = date(2026, 1, 5)  # Monday
    next_date = ComputeNextOccurrenceDate(start, "weekly", 1, [2, 4], None)
    assert next_date == date(2026, 1, 7)
