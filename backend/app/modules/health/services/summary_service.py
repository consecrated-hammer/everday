from datetime import timedelta

from sqlalchemy.orm import Session

from app.modules.health.models import DailyLog as DailyLogModel
from app.modules.health.schemas import DailySummary, WeeklySummary
from app.modules.health.services.calculations import (
    BuildDailySummary,
    CalculateDailyTotals,
    CalculateWeeklySummary,
)
from app.modules.health.services.daily_logs_service import GetEntriesForLog
from app.modules.health.services.settings_service import GetSettings
from app.modules.health.utils.dates import ParseIsoDate


def GetWeeklySummary(db: Session, UserId: int, StartDate: str) -> WeeklySummary:
    start = ParseIsoDate(StartDate)
    end = start + timedelta(days=6)

    logs = (
        db.query(DailyLogModel)
        .filter(
            DailyLogModel.UserId == UserId,
            DailyLogModel.LogDate >= start,
            DailyLogModel.LogDate <= end,
        )
        .order_by(DailyLogModel.LogDate.asc())
        .all()
    )

    settings = GetSettings(db, UserId)
    summaries: list[DailySummary] = []

    for log in logs:
        entries_for_log = GetEntriesForLog(db, UserId, log.DailyLogId)
        step_factor = (
            float(log.StepKcalFactorOverride)
            if log.StepKcalFactorOverride is not None
            else settings.StepKcalFactor
        )
        totals = CalculateDailyTotals(entries_for_log, log.Steps, step_factor, settings)
        summaries.append(BuildDailySummary(log.LogDate, log.Steps, totals))

    return CalculateWeeklySummary(summaries)
