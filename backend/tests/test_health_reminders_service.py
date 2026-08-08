import json
from datetime import date, datetime, timezone

import pytest

from app.modules.health.services.discord_service import ResolveWebhookUrl
from app.modules.health.services.reminders_service import (
    FormatYesterdayReminderMessage,
    YesterdayReminderTimeForDate,
    _FormatMissingMealList,
    _IsValidTime,
    _ParseFoodReminderSlots,
    _ParseFoodReminderTimes,
    _ResolveEffectiveRunDateTime,
    _TimeMatches,
)
from app.modules.health.utils.defaults import DefaultFoodReminderSlots, DefaultFoodReminderTimes


def test_time_validation_and_matching():
    assert _IsValidTime("08:00")
    assert not _IsValidTime("8:00")
    assert not _IsValidTime("25:00")

    assert _TimeMatches("08:00", "08:00")
    assert not _TimeMatches("08:00", "08:15")
    assert not _TimeMatches("08:00", "bad")


def test_parse_food_reminder_times_normalizes_and_falls_back():
    raw = json.dumps(
        {
            "Breakfast": "09:15",
            "Snack1": "bad-time",
            "Unknown": "10:00",
        }
    )
    parsed = _ParseFoodReminderTimes(raw)

    assert set(parsed.keys()) == set(DefaultFoodReminderTimes.keys())
    assert parsed["Breakfast"] == "09:15"
    assert parsed["Snack1"] == DefaultFoodReminderTimes["Snack1"]


def test_parse_food_reminder_slots_honors_per_slot_enabled_and_time():
    legacy_times = _ParseFoodReminderTimes(None)
    raw_slots = json.dumps(
        {
            "Breakfast": {"Enabled": True, "Time": "09:15"},
            "Snack1": {"Enabled": False, "Time": "bad-time"},
            "Unknown": {"Enabled": True, "Time": "10:00"},
        }
    )
    slots = _ParseFoodReminderSlots(raw_slots, legacy_enabled=False, legacy_times=legacy_times)

    assert set(slots.keys()) == set(DefaultFoodReminderSlots.keys())
    assert slots["Breakfast"]["Enabled"] is True
    assert slots["Breakfast"]["Time"] == "09:15"
    assert slots["Snack1"]["Enabled"] is False
    assert slots["Snack1"]["Time"] == DefaultFoodReminderSlots["Snack1"]["Time"]


def test_resolve_effective_run_date_time_uses_adelaide_for_scheduler_defaults():
    now_utc = datetime(2026, 3, 8, 16, 0, tzinfo=timezone.utc)

    effective_date, effective_time = _ResolveEffectiveRunDateTime(
        now_utc=now_utc,
        run_date=None,
        run_time=None,
    )

    assert effective_date == date(2026, 3, 9)
    assert effective_time == "02:30"


@pytest.mark.parametrize(
    ("run_date", "expected"),
    [
        (date(2026, 7, 27), "07:00"),  # Monday
        (date(2026, 7, 31), "07:00"),  # Friday
        (date(2026, 8, 1), "09:00"),  # Saturday
        (date(2026, 8, 2), "09:00"),  # Sunday
    ],
)
def test_yesterday_reminder_time_splits_weekdays_and_weekends(run_date, expected):
    assert YesterdayReminderTimeForDate(run_date) == expected


def test_yesterday_reminder_time_honors_env_overrides(monkeypatch):
    monkeypatch.setenv("HEALTH_YESTERDAY_REMINDER_WEEKDAY_TIME", "06:30")
    monkeypatch.setenv("HEALTH_YESTERDAY_REMINDER_WEEKEND_TIME", "bad-time")

    assert YesterdayReminderTimeForDate(date(2026, 7, 31)) == "06:30"
    assert YesterdayReminderTimeForDate(date(2026, 8, 1)) == "09:00"


def test_format_missing_meal_list_uses_readable_labels():
    assert _FormatMissingMealList(["Dinner"]) == "Dinner"
    assert _FormatMissingMealList(["Breakfast", "Dinner"]) == "Breakfast and Dinner"
    assert (
        _FormatMissingMealList(["Breakfast", "Lunch", "Dinner"])
        == "Breakfast, Lunch and Dinner"
    )


def test_format_yesterday_reminder_message_includes_day_meals_and_link(monkeypatch):
    monkeypatch.setenv("HEALTH_DASHBOARD_BASE_URL", "https://health.example.test/")

    message = FormatYesterdayReminderMessage(date(2026, 7, 31), ["Breakfast", "Dinner"])

    assert "Friday 31 July" in message
    assert "Not logged: Breakfast and Dinner" in message
    assert "https://health.example.test/log?date=2026-07-31" in message


def test_resolve_webhook_url_prefers_username_key(monkeypatch):
    monkeypatch.setenv("DISCORD_KEVIN", " https://discord.test/kevin ")
    monkeypatch.setenv("HEALTH_DISCORD_WEBHOOK_USER_1", "https://discord.test/by-id")

    assert ResolveWebhookUrl(1, "kevin") == "https://discord.test/kevin"


def test_resolve_webhook_url_falls_back_to_user_id_key(monkeypatch):
    monkeypatch.delenv("DISCORD_BIANCA", raising=False)
    monkeypatch.setenv("HEALTH_DISCORD_WEBHOOK_USER_2", "https://discord.test/by-id")

    assert ResolveWebhookUrl(2, "bianca") == "https://discord.test/by-id"


def test_resolve_webhook_url_is_optional(monkeypatch):
    monkeypatch.delenv("DISCORD_NOBODY", raising=False)
    monkeypatch.delenv("HEALTH_DISCORD_WEBHOOK_USER_9", raising=False)

    assert ResolveWebhookUrl(9, "nobody") is None
