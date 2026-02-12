from app.modules.kids.services.reminders_service import (
    REMINDER_EMOJIS,
    _IsValidTime,
    _NormalizeTime,
    _TimeMatches,
)


def test_kids_reminder_time_validation():
    assert _IsValidTime("19:00")
    assert _IsValidTime("07:00")
    assert not _IsValidTime("7:00")
    assert not _IsValidTime("24:00")
    assert not _IsValidTime("bad")


def test_kids_reminder_normalize_and_match():
    assert _NormalizeTime("19:00") == "19:00"
    assert _NormalizeTime("bad") is None
    assert _TimeMatches("19:00", "19:00")
    assert not _TimeMatches("19:00", "18:59")
    assert not _TimeMatches("19:00", "bad")


def test_kids_reminder_emojis_distinct_from_done_list():
    done_emojis = {"✨", "🎉", "🌟", "🤩", "🙌", "😄", "🥳", "🎯", "✅", "💫"}
    assert REMINDER_EMOJIS
    assert len(set(REMINDER_EMOJIS)) == len(REMINDER_EMOJIS)
    assert done_emojis.isdisjoint(set(REMINDER_EMOJIS))
