from datetime import date

from app.modules.kids.models import PocketMoneyRule
from app.modules.kids.services.pocket_money_service import ComputePocketMoneyDates


def _BuildRule(**overrides) -> PocketMoneyRule:
    data = {
        "KidUserId": 1,
        "Amount": 5,
        "Frequency": "weekly",
        "DayOfWeek": 0,
        "DayOfMonth": None,
        "StartDate": date(2024, 1, 1),
        "IsActive": True,
        "CreatedByUserId": 1,
    }
    data.update(overrides)
    return PocketMoneyRule(**data)


def test_weekly_schedule_includes_start_date():
    rule = _BuildRule(Frequency="weekly", DayOfWeek=4, StartDate=date(2024, 3, 1))
    dates = ComputePocketMoneyDates(rule, date(2024, 3, 15))
    assert dates == [date(2024, 3, 1), date(2024, 3, 8), date(2024, 3, 15)]


def test_fortnightly_schedule_across_year():
    rule = _BuildRule(Frequency="fortnightly", DayOfWeek=4, StartDate=date(2024, 12, 20))
    dates = ComputePocketMoneyDates(rule, date(2025, 1, 10))
    assert dates == [date(2024, 12, 20), date(2025, 1, 3)]


def test_monthly_schedule_respects_start_date():
    rule = _BuildRule(
        Frequency="monthly",
        DayOfWeek=None,
        DayOfMonth=1,
        StartDate=date(2024, 1, 15),
    )
    dates = ComputePocketMoneyDates(rule, date(2024, 3, 2))
    assert dates == [date(2024, 2, 1), date(2024, 3, 1)]


def test_monthly_schedule_clamps_day_of_month():
    rule = _BuildRule(
        Frequency="monthly",
        DayOfWeek=None,
        DayOfMonth=31,
        StartDate=date(2024, 1, 10),
    )
    dates = ComputePocketMoneyDates(rule, date(2024, 3, 1))
    assert dates == [date(2024, 1, 31), date(2024, 2, 29)]
