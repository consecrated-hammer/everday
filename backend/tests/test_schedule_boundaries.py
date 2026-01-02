from datetime import date

from app.services.schedules import AddMonths, AddYears, FinancialYearRange


def test_add_months_leap_year():
    assert AddMonths(date(2024, 1, 31), 1) == date(2024, 2, 29)


def test_add_months_year_boundary():
    assert AddMonths(date(2023, 12, 31), 1) == date(2024, 1, 31)


def test_add_years_handles_february():
    assert AddYears(date(2020, 2, 29), 1) == date(2021, 2, 28)


def test_financial_year_range():
    start, end = FinancialYearRange(date(2024, 1, 15), 1, 1)
    assert start == date(2024, 1, 1)
    assert end == date(2024, 12, 31)
