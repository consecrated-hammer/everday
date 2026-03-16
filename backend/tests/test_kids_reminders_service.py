from datetime import date, datetime, timezone

from app.modules.kids.services.reminders_service import (
    REMINDER_EMOJIS,
    _IsValidTime,
    _NormalizeTime,
    _ResolveEffectiveRunDateTime,
    _ResolveReminderZone,
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


def test_kids_resolve_effective_run_date_time_uses_timezone():
    now_utc = datetime(2026, 3, 8, 16, 0, tzinfo=timezone.utc)

    adelaide_date, adelaide_time = _ResolveEffectiveRunDateTime(
        now_utc=now_utc,
        run_date=None,
        run_time=None,
        run_zone=_ResolveReminderZone("Australia/Adelaide"),
    )
    utc_date, utc_time = _ResolveEffectiveRunDateTime(
        now_utc=now_utc,
        run_date=None,
        run_time=None,
        run_zone=_ResolveReminderZone("UTC"),
    )

    assert adelaide_date == date(2026, 3, 9)
    assert adelaide_time == "02:30"
    assert utc_date == date(2026, 3, 8)
    assert utc_time == "16:00"
