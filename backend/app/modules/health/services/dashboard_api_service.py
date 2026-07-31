from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.modules.health.services.daily_logs_service import GetWeightHistory
from app.modules.health.services.settings_service import GetUserSettings
from app.modules.health.services.summary_service import GetWeeklySummary
from app.modules.integrations.health_mcp.service import GetHistory, GetSummary


def _UserZone(timezone_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name or "Australia/Adelaide")
    except ZoneInfoNotFoundError:
        return ZoneInfo("Australia/Adelaide")


def _Number(value: object, digits: int = 1) -> float | int | None:
    if value is None:
        return None
    return round(float(value), digits)


def BuildDashboardResponse(
    db: Session,
    user_id: int,
    *,
    weight_days: int,
    step_days: int,
    day_summary_days: int,
) -> dict:
    settings = GetUserSettings(db, user_id)
    zone = _UserZone(settings.ReminderTimeZone)
    today = datetime.now(zone).date()
    today_text = today.isoformat()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    today_snapshot = GetSummary(db, user_id, today_text)
    weekly = GetWeeklySummary(db, user_id, week_start.isoformat())
    weights = GetWeightHistory(db, user_id, (today - timedelta(days=weight_days - 1)).isoformat(), today_text)
    steps = GetHistory(db, user_id, "steps", (today - timedelta(days=step_days - 1)).isoformat(), today_text)
    days = GetHistory(db, user_id, "days", (today - timedelta(days=day_summary_days - 1)).isoformat(), today_text)
    current_week_days = [
        item for item in days if week_start.isoformat() <= item["LogDate"] <= week_end.isoformat()
    ]
    sleep_values = [float(item["SleepHours"]) for item in current_week_days if item["SleepHours"] is not None]

    log = today_snapshot["DailyLog"]
    totals = today_snapshot["Totals"]
    summary = today_snapshot["Summary"]
    targets = settings.Targets
    goal = settings.Goal
    weight_change = None
    if len(weights) >= 2:
        weight_change = round(float(weights[-1].WeightKg) - float(weights[0].WeightKg), 2)

    return {
        "apiVersion": "1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "timezone": zone.key,
        "goal": None if goal is None else {
            "type": goal.GoalType.value,
            "status": goal.Status,
            "startDate": goal.StartDate.isoformat(),
            "endDate": goal.EndDate.isoformat(),
            "currentWeightKg": _Number(goal.CurrentWeightKg, 2),
            "targetWeightKg": _Number(goal.TargetWeightKg, 2),
            "remainingKg": round(abs(float(goal.TargetWeightKg) - float(goal.CurrentWeightKg)), 2),
            "currentBmi": _Number(goal.CurrentBmi, 2),
            "targetBmi": _Number(goal.TargetBmi, 2),
            "remainingDays": goal.RemainingDays,
        },
        "targets": {
            "dailyCalories": targets.DailyCalorieTarget,
            "proteinMinG": _Number(targets.ProteinTargetMin),
            "proteinMaxG": _Number(targets.ProteinTargetMax),
            "dailySteps": targets.StepTarget,
            "fibreG": _Number(targets.FibreTarget),
        },
        "today": {
            "date": today_text,
            "calories": totals.TotalCalories,
            "remainingCalories": totals.RemainingCalories,
            "proteinG": _Number(totals.TotalProtein),
            "remainingProteinMinG": _Number(totals.RemainingProteinMin),
            "steps": summary.Steps if log is not None else None,
            "sleepHours": _Number(log.SleepHours, 2) if log is not None else None,
            "workoutCount": summary.WorkoutCount,
            "loggingComplete": bool(log.LoggedComplete) if log is not None and log.LoggedComplete is not None else False,
        },
        "currentWeek": {
            "weekStart": week_start.isoformat(),
            "weekEnd": week_end.isoformat(),
            "averageCalories": weekly.Averages["AverageCalories"],
            "averageProteinG": weekly.Averages["AverageProtein"],
            "averageSteps": weekly.Averages["AverageSteps"],
            "averageSleepHours": _Number(sum(sleep_values) / len(sleep_values), 2) if sleep_values else None,
            "weightChangeKg": weight_change,
        },
        "weightHistory": [{"date": item.LogDate.isoformat(), "weightKg": _Number(item.WeightKg, 2)} for item in weights],
        "stepHistory": [{"date": item["LogDate"], "steps": item["Steps"]} for item in steps],
        "dailySummaries": [
            {
                "date": item["LogDate"], "calories": item["TotalCalories"], "proteinG": _Number(item["TotalProtein"]),
                "fibreG": _Number(item["TotalFibre"]), "steps": item["Steps"],
                "sleepHours": _Number(item["SleepHours"], 2), "weightKg": _Number(item["WeightKg"], 2),
                "workoutCount": item["WorkoutCount"], "loggingComplete": item["LoggedComplete"],
            }
            for item in days
        ],
    }
