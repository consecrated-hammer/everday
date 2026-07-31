from datetime import date
from types import SimpleNamespace

from app.modules.auth import api_tokens
from app.modules.health.routes.dashboard_api import _TokenRateLimiter, _Window
from app.modules.health.services import dashboard_api_service


def test_api_token_format_and_lookup_hash_are_stable() -> None:
    token = "evd_example-token"
    assert api_tokens._LookupHash(token) == api_tokens._LookupHash(token)
    assert api_tokens._ParseScopes('["health:dashboard:read"]') == {"health:dashboard:read"}
    assert api_tokens._ParseScopes("not-json") == set()


def test_dashboard_windows_reject_out_of_range_values() -> None:
    assert _Window("90", name="weightDays", default=90, maximum=365) == 90
    try:
        _Window("366", name="weightDays", default=90, maximum=365)
    except api_tokens.ApiTokenRequestError as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("Expected invalid parameter error")


def test_rate_limiter_drops_expired_token_records(monkeypatch) -> None:
    limiter = _TokenRateLimiter(limit=1, window_seconds=60)
    monkeypatch.setattr("app.modules.health.routes.dashboard_api.time.monotonic", lambda: 100.0)
    assert limiter.allow("retired-token") is True
    monkeypatch.setattr("app.modules.health.routes.dashboard_api.time.monotonic", lambda: 161.0)
    assert limiter.allow("fresh-token") is True
    assert "retired-token" not in limiter._requests


def test_dashboard_response_excludes_notes_and_meal_details(monkeypatch) -> None:
    target = SimpleNamespace(
        DailyCalorieTarget=1600, ProteinTargetMin=100, ProteinTargetMax=120, StepTarget=7000, FibreTarget=30
    )
    settings = SimpleNamespace(ReminderTimeZone="Australia/Adelaide", Targets=target, Goal=None)
    monkeypatch.setattr(dashboard_api_service, "GetUserSettings", lambda *_args: settings)
    monkeypatch.setattr(
        dashboard_api_service,
        "GetSummary",
        lambda *_args: {
            "DailyLog": SimpleNamespace(SleepHours=7.5, LoggedComplete=False),
            "Totals": SimpleNamespace(TotalCalories=450, RemainingCalories=1150, TotalProtein=23.7, RemainingProteinMin=76.3),
            "Summary": SimpleNamespace(Steps=2235, WorkoutCount=0),
        },
    )
    monkeypatch.setattr(
        dashboard_api_service,
        "GetWeeklySummary",
        lambda *_args: SimpleNamespace(Averages={"AverageCalories": 1238, "AverageProtein": 63.4, "AverageSteps": 4522}),
    )
    monkeypatch.setattr(
        dashboard_api_service,
        "GetWeightHistory",
        lambda *_args: [SimpleNamespace(LogDate=date(2026, 7, 26), WeightKg=94.6), SimpleNamespace(LogDate=date(2026, 7, 30), WeightKg=92.6)],
    )
    def history(_db, _user, kind, *_args):
        if kind == "steps":
            return [{"LogDate": "2026-07-30", "Steps": 4584}]
        return [{"LogDate": "2026-07-30", "TotalCalories": 1355, "TotalProtein": 63.3, "TotalFibre": 16.1,
                 "Steps": 4584, "SleepHours": 3.31, "WeightKg": 92.6, "WorkoutCount": 0,
                 "LoggedComplete": False, "Notes": "must not escape"}]
    monkeypatch.setattr(dashboard_api_service, "GetHistory", history)

    response = dashboard_api_service.BuildDashboardResponse(None, 7, weight_days=90, step_days=30, day_summary_days=14)

    assert response["targets"]["dailyCalories"] == 1600
    assert response["weightHistory"][-1]["weightKg"] == 92.6
    assert response["dailySummaries"][0]["sleepHours"] == 3.31
    assert "Notes" not in response["dailySummaries"][0]
    assert "Entries" not in response
