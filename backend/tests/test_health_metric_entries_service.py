from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.modules.health.services.metric_entries_service import ApplyMetricToDailyLog


def test_automated_sleep_does_not_overwrite_manual_sleep():
    updated_at = datetime(2026, 7, 20, 8, tzinfo=timezone.utc)
    record = SimpleNamespace(SleepHours=7.0, SleepSource="user", SleepUpdatedAt=updated_at)

    changed = ApplyMetricToDailyLog(record, "sleep", 2.0, updated_at + timedelta(hours=1), "automation")

    assert changed is False
    assert record.SleepHours == 7.0
    assert record.SleepSource == "user"


def test_manual_sleep_replaces_imported_sleep():
    updated_at = datetime(2026, 7, 20, 8, tzinfo=timezone.utc)
    record = SimpleNamespace(SleepHours=2.0, SleepSource="automation", SleepUpdatedAt=updated_at)

    changed = ApplyMetricToDailyLog(record, "sleep", 7.0, updated_at + timedelta(hours=1), "user")

    assert changed is True
    assert record.SleepHours == 7.0
    assert record.SleepSource == "user"
