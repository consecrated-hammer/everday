import json
from datetime import timedelta

from app.modules.health.schemas import Suggestion
from app.modules.health.models import AiSuggestion, AiSuggestionRun, DailyLog as DailyLogModel
from app.modules.health.services.daily_logs_service import GetDailyLogByDate, GetEntriesForLog
from app.modules.health.services.settings_service import GetSettings
from app.modules.health.services.summary_service import GetWeeklySummary
from app.modules.health.services.openai_client import GetOpenAiContentWithModel
from app.modules.health.utils.config import Settings
from app.modules.health.utils.dates import ParseIsoDate
from app.modules.auth.deps import NowUtc


def _BuildWeeklyContext(Summary) -> list[str]:
    Totals = Summary.Totals or {}
    Averages = Summary.Averages or {}
    Days = Summary.Days or []
    Lines = [
        f"Weekly summary (last 7 days, {len(Days)} day(s) logged):",
        (
            f"- Totals: calories {Totals.get('TotalCalories', 0)}, "
            f"protein {Totals.get('TotalProtein', 0)} g, "
            f"steps {Totals.get('TotalSteps', 0)}"
        ),
        (
            f"- Averages: calories {Averages.get('AverageCalories', 0)}, "
            f"protein {Averages.get('AverageProtein', 0)} g, "
            f"steps {Averages.get('AverageSteps', 0)}"
        ),
    ]

    if Days:
        BestProtein = max(Days, key=lambda Day: Day.TotalProtein)
        HighestCalories = max(Days, key=lambda Day: Day.TotalCalories)
        LowestCalories = min(Days, key=lambda Day: Day.TotalCalories)
        Lines.append(
            f"- Best protein day: {BestProtein.LogDate.isoformat()} ({BestProtein.TotalProtein} g)"
        )
        Lines.append(
            f"- Highest calories day: {HighestCalories.LogDate.isoformat()} ({HighestCalories.TotalCalories})"
        )
        Lines.append(
            f"- Lowest calories day: {LowestCalories.LogDate.isoformat()} ({LowestCalories.TotalCalories})"
        )
    else:
        Lines.append("- No logged days in the last 7 days.")

    return Lines


def _ExtractJsonArray(Content: str) -> str:
    Cleaned = Content.strip()
    if "```" in Cleaned:
        Cleaned = Cleaned.replace("```json", "").replace("```", "").strip()
    if Cleaned.startswith("[") and Cleaned.endswith("]"):
        return Cleaned
    StartIndex = Cleaned.find("[")
    EndIndex = Cleaned.rfind("]")
    if StartIndex != -1 and EndIndex != -1 and EndIndex > StartIndex:
        return Cleaned[StartIndex : EndIndex + 1]
    return Cleaned


def _BuildRecentEntriesContext(db, UserId: int, LogDateValue, days: int = 7) -> list[str]:
    start_date = LogDateValue - timedelta(days=days - 1)
    rows = (
        db.query(DailyLogModel)
        .filter(
            DailyLogModel.UserId == UserId,
            DailyLogModel.LogDate >= start_date,
            DailyLogModel.LogDate <= LogDateValue,
        )
        .order_by(DailyLogModel.LogDate.asc())
        .all()
    )
    lines: list[str] = []
    for log in rows:
        entries = GetEntriesForLog(db, UserId, log.DailyLogId)
        if not entries:
            continue
        for entry in entries:
            meal_type = entry.MealType.value if hasattr(entry.MealType, "value") else entry.MealType
            created_at = entry.CreatedAt
            time_label = created_at.strftime("%H:%M") if created_at else "time unknown"
            calories = round((entry.CaloriesPerServing or 0) * entry.Quantity, 1)
            protein = round((entry.ProteinPerServing or 0) * entry.Quantity, 1)
            lines.append(
                (
                    f"- {log.LogDate.isoformat()} {meal_type} at {time_label}: "
                    f"{entry.FoodName} x{entry.Quantity} ({calories} kcal, {protein} g protein)"
                )
            )
    return lines


def BuildAiPrompt(
    LogDate: str,
    Steps: int,
    Entries: list[dict],
    Targets: dict,
    WeeklySummary,
    RecentEntries: list[str] | None = None,
) -> str:
    Lines = [
        "Use today's log as the primary context. Use the weekly summary for trends and fallback.",
        f"Log date: {LogDate}",
        f"Steps: {Steps}",
        f"Targets: {Targets}",
        "Entries:",
    ]

    if not Entries:
        Lines.append("- None")
    else:
        for Entry in Entries:
            Lines.append(
                f"- {Entry['MealType']}: {Entry['FoodName']} x{Entry['Quantity']} "
                f"({Entry['Calories']} kcal, {Entry['Protein']} g protein)"
            )

    Lines.extend(_BuildWeeklyContext(WeeklySummary))
    if RecentEntries is not None:
        Lines.append("Recent intake (last 7 days):")
        if RecentEntries:
            Lines.extend(RecentEntries)
        else:
            Lines.append("- No recent meals logged.")
    Lines.append("Provide 2-4 concise suggestions focused on protein, calories, or meal balance.")
    return "\n".join(Lines)


def ParseAiSuggestions(Content: str) -> list[Suggestion]:
    ParsedContent = _ExtractJsonArray(Content)
    try:
        Parsed = json.loads(ParsedContent)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid AI response.") from exc
    if not isinstance(Parsed, list):
        raise ValueError("Invalid AI response.")

    Suggestions: list[Suggestion] = []
    for Item in Parsed:
        if not isinstance(Item, dict):
            continue
        Title = str(Item.get("Title", "")).strip()
        Detail = str(Item.get("Detail", "")).strip()
        if not Title or not Detail:
            continue
        Suggestions.append(
            Suggestion(
                SuggestionType="AiSuggestion",
                Title=Title,
                Detail=Detail,
            )
        )

    if not Suggestions:
        raise ValueError("No AI suggestions returned.")

    return Suggestions


def GetAiSuggestions(db, UserId: int, LogDate: str, save_to_db: bool = True) -> tuple[list[Suggestion], str]:
    """
    Generate AI suggestions for a user on a specific date.
    
    Args:
        db: Database session
        UserId: User ID
        LogDate: ISO date string (YYYY-MM-DD)
        save_to_db: If True, save suggestions to database for cross-device sync
    
    Returns:
        Tuple of (suggestions list, model_used string)
    """
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    LogDateValue = ParseIsoDate(LogDate)
    
    # Check if we already have stored suggestions for this date
    if save_to_db:
        existing_run = (
            db.query(AiSuggestionRun)
            .filter(
                AiSuggestionRun.UserId == UserId,
                AiSuggestionRun.RunDate == LogDateValue,
                AiSuggestionRun.SuggestionsGenerated > 0,
            )
            .order_by(AiSuggestionRun.CreatedAt.desc())
            .first()
        )
        if existing_run:
            stored_suggestions = (
                db.query(AiSuggestion)
                .filter(AiSuggestion.RunId == existing_run.Id)
                .order_by(AiSuggestion.Id.asc())
                .all()
            )
            if stored_suggestions:
                return [
                    Suggestion(
                        SuggestionType=s.SuggestionType,
                        Title=s.Title,
                        Detail=s.Detail,
                    )
                    for s in stored_suggestions
                ], existing_run.ModelUsed or "unknown"

    LogItem = GetDailyLogByDate(db, UserId, LogDateValue)

    Entries = GetEntriesForLog(db, UserId, LogItem.DailyLogId) if LogItem else []
    Targets = GetSettings(db, UserId)
    WeekStart = (LogDateValue - timedelta(days=6)).isoformat()
    WeeklySummary = GetWeeklySummary(db, UserId, WeekStart)

    PayloadEntries = [
        {
            "MealType": Entry.MealType.value if hasattr(Entry.MealType, "value") else Entry.MealType,
            "FoodName": Entry.FoodName,
            "Quantity": Entry.Quantity,
            "Calories": round(Entry.CaloriesPerServing * Entry.Quantity, 1),
            "Protein": round(Entry.ProteinPerServing * Entry.Quantity, 1),
        }
        for Entry in Entries
    ]

    TargetsPayload = {
        "DailyCalorieTarget": Targets.DailyCalorieTarget,
        "ProteinTargetMin": Targets.ProteinTargetMin,
        "ProteinTargetMax": Targets.ProteinTargetMax,
    }

    recent_entries = None
    if len(PayloadEntries) < 3:
        recent_entries = _BuildRecentEntriesContext(db, UserId, LogDateValue, days=7)

    Prompt = BuildAiPrompt(
        LogDate,
        LogItem.Steps if LogItem else 0,
        PayloadEntries,
        TargetsPayload,
        WeeklySummary,
        RecentEntries=recent_entries,
    )

    Messages = [
        {
            "role": "system",
            "content": (
                "You are a nutrition assistant for a calorie and protein tracking app. "
                "Return JSON only as an array of objects with Title and Detail fields."
            ),
        },
        {"role": "user", "content": Prompt},
    ]
    Content, ModelUsed = GetOpenAiContentWithModel(
        Messages,
        Temperature=0.4,
    )
    if not Content:
        raise ValueError("No AI response content.")

    try:
        suggestions = ParseAiSuggestions(Content)
        model_used = ModelUsed
    except ValueError:
        RetryContent, RetryModelUsed = GetOpenAiContentWithModel(
            [
                {
                    "role": "system",
                    "content": (
                        "Return ONLY a JSON array of objects with Title and Detail fields. "
                        "No extra text."
                    ),
                },
                {"role": "user", "content": f"Reformat into valid JSON only:\n{Content}"},
            ],
            Temperature=0.2,
        )
        if not RetryContent:
            raise ValueError("No AI response content.")
        suggestions = ParseAiSuggestions(RetryContent)
        model_used = RetryModelUsed
    
    # Save to database if requested
    if save_to_db and suggestions:
        now = NowUtc()
        # Create or update run record
        run_record = (
            db.query(AiSuggestionRun)
            .filter(
                AiSuggestionRun.UserId == UserId,
                AiSuggestionRun.RunDate == LogDateValue,
            )
            .first()
        )
        if not run_record:
            run_record = AiSuggestionRun(
                UserId=UserId,
                RunDate=LogDateValue,
                SuggestionsGenerated=len(suggestions),
                ModelUsed=model_used,
                NotificationSent=False,
                CreatedAt=now,
            )
            db.add(run_record)
            db.flush()
        else:
            run_record.SuggestionsGenerated = len(suggestions)
            run_record.ModelUsed = model_used
            db.add(run_record)
            db.flush()
        
        # Delete old suggestions for this run
        db.query(AiSuggestion).filter(AiSuggestion.RunId == run_record.Id).delete()
        
        # Save new suggestions
        for suggestion in suggestions:
            db.add(
                AiSuggestion(
                    UserId=UserId,
                    RunId=run_record.Id,
                    SuggestionType=suggestion.SuggestionType,
                    Title=suggestion.Title,
                    Detail=suggestion.Detail,
                    CreatedAt=now,
                )
            )
        db.commit()
    
    return suggestions, model_used
