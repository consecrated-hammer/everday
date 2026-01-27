import json

from app.modules.health.services.reminders_service import (
    _IsValidTime,
    _ParseFoodReminderSlots,
    _ParseFoodReminderTimes,
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
