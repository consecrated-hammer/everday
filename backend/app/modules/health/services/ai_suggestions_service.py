import json
from datetime import timedelta

from app.modules.health.schemas import Suggestion
from app.modules.health.services.daily_logs_service import GetDailyLogByDate, GetEntriesForLog
from app.modules.health.services.settings_service import GetSettings
from app.modules.health.services.summary_service import GetWeeklySummary
from app.modules.health.services.openai_client import GetOpenAiContentWithModel
from app.modules.health.utils.config import Settings
from app.modules.health.utils.dates import ParseIsoDate


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


def BuildAiPrompt(
    LogDate: str, Steps: int, Entries: list[dict], Targets: dict, WeeklySummary
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


def GetAiSuggestions(db, UserId: int, LogDate: str) -> tuple[list[Suggestion], str]:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    LogDateValue = ParseIsoDate(LogDate)
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

    Prompt = BuildAiPrompt(
        LogDate,
        LogItem.Steps if LogItem else 0,
        PayloadEntries,
        TargetsPayload,
        WeeklySummary,
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
        return ParseAiSuggestions(Content), ModelUsed
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
        return ParseAiSuggestions(RetryContent), RetryModelUsed
