from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.auth.models import User
from app.modules.health.schemas import Insight, UpsertInsightInput
from app.modules.health.services.openai_client import GetOpenAiContentForModel
from app.modules.health.services.workouts_service import GetWorkoutHistory
from app.modules.health.services.knowledge_service import GetExperiments, GetInsights, UpsertInsight
from app.modules.health.utils.config import Settings
from app.modules.integrations.health_mcp.service import (
    GetHistory,
    GetStepSummary,
    GetSummary,
    GetTargetsHistory,
    GetWeightTrend,
)
from app.modules.health.utils.dates import ParseIsoDate


DAILY_TIP_TYPE = "daily_tip"
DAILY_TIP_TAG = "daily_tip"
TIP_SLOT_ORDER = ("morning", "midday", "dinner")
TIP_SLOT_BOUNDARIES = {
    "morning": ("00:00", "10:59"),
    "midday": ("11:00", "15:29"),
    "dinner": ("15:30", "23:59"),
}


@dataclass
class DailyTipRunResult:
    slot: str
    processed_users: int
    generated: int
    skipped: int
    errors: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "Slot": self.slot,
            "ProcessedUsers": self.processed_users,
            "Generated": self.generated,
            "Skipped": self.skipped,
            "Errors": self.errors,
        }


def _NormalizeTime(value: str) -> str:
    parsed = datetime.strptime(value, "%H:%M")
    return parsed.strftime("%H:%M")


def _ResolveSlot(slot: str | None, run_time: str | None) -> str:
    if slot:
        cleaned = slot.strip().lower()
        if cleaned in TIP_SLOT_ORDER:
            return cleaned
        raise ValueError("slot must be one of: morning, midday, dinner.")

    effective_time = _NormalizeTime(run_time or NowUtc().strftime("%H:%M"))
    for candidate, (start, end) in TIP_SLOT_BOUNDARIES.items():
        if start <= effective_time <= end:
            return candidate
    return "dinner"


def _ParseJsonObject(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if "```" in cleaned:
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("Daily tip response must be a JSON object.")
    return parsed


def _NormalizeConfidence(value: Any) -> str:
    if isinstance(value, int | float):
        score = float(value)
        if score >= 0.75:
            return "high"
        if score >= 0.45:
            return "medium"
        return "low"
    cleaned = str(value or "").strip().lower()
    if cleaned in {"high", "medium", "low"}:
        return cleaned
    if cleaned in {"certain", "strong"}:
        return "high"
    if cleaned in {"uncertain", "weak"}:
        return "low"
    return "medium"


def _DisplayName(user: User) -> str:
    parts = [part.strip() for part in (user.FirstName or "", user.LastName or "") if part and part.strip()]
    if parts:
        return " ".join(parts)
    if user.Username and user.Username.strip():
        return user.Username.strip()
    return "the user"


def _Plain(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_Plain(item) for item in value]
    if isinstance(value, dict):
        return {key: _Plain(item) for key, item in value.items()}
    return value


def _MealSlotsForToday(summary: dict[str, Any]) -> list[dict[str, Any]]:
    entries = summary.get("Entries") or []
    slots: dict[str, dict[str, Any]] = {}
    for entry in entries:
        meal_type = str(entry.get("MealType") or "Other")
        slot = slots.setdefault(
            meal_type,
            {
                "meal_type": meal_type,
                "count": 0,
                "calories": 0,
                "protein": 0.0,
                "foods": [],
            },
        )
        slot["count"] += 1
        slot["calories"] += int(round(float(entry.get("CaloriesPerServing") or 0) * float(entry.get("Quantity") or 1)))
        slot["protein"] += round(float(entry.get("ProteinPerServing") or 0) * float(entry.get("Quantity") or 1), 1)
        food_name = str(entry.get("FoodName") or "").strip()
        if food_name:
            slot["foods"].append(food_name)
    items = list(slots.values())
    items.sort(key=lambda item: str(item["meal_type"]))
    return items


def _BuildDerivedFlags(
    summary: dict[str, Any],
    rolling_days: list[dict[str, Any]],
    slot: str,
) -> dict[str, Any]:
    totals = summary.get("Totals") or {}
    targets = summary.get("Targets") or {}
    daily_log = summary.get("DailyLog") or {}
    entries = summary.get("Entries") or []
    bridge_logged = any(str(entry.get("MealType") or "") == "Snack2" for entry in entries)
    meals_logged = len(entries)
    protein = float(totals.get("TotalProtein") or 0)
    protein_min = float(targets.get("ProteinTargetMin") or 0)
    calories = float(totals.get("TotalCalories") or 0)
    calories_target = float(targets.get("DailyCalorieTarget") or 0)
    today_status = {
        "bridge_missing": not bridge_logged,
        "meals_logged": meals_logged,
        "protein_under_target": bool(protein_min and protein < protein_min),
        "calories_above_target": bool(calories_target and calories > calories_target),
        "hydration_missing": daily_log.get("WaterLitres") is None,
        "sleep_missing": daily_log.get("SleepHours") is None,
        "slot": slot,
    }
    for item in rolling_days:
        if int(item.get("days") or 0) == 7:
            today_status["rolling_7d_protein"] = item.get("Protein")
            today_status["rolling_7d_calories"] = item.get("Calories")
    return today_status


def _BuildRollingAverages(days_history: list[dict[str, Any]], window_sizes: tuple[int, ...] = (7, 30, 90)) -> list[dict[str, Any]]:
    def _avg(records: list[dict[str, Any]], key: str) -> float | None:
        values = [float(record[key]) for record in records if record.get(key) is not None]
        if not values:
            return None
        return round(sum(values) / len(values), 1)

    items: list[dict[str, Any]] = []
    for days in window_sizes:
        window = days_history[-days:]
        items.append(
            {
                "days": days,
                "Calories": _avg(window, "TotalCalories"),
                "Protein": _avg(window, "TotalProtein"),
                "NetCalories": _avg(window, "NetCalories"),
                "Steps": _avg(window, "Steps"),
                "SleepHours": _avg(window, "SleepHours"),
                "WaterLitres": _avg(window, "WaterLitres"),
            }
        )
    return items


def _EarlierSlotsFor(slot: str) -> tuple[str, ...]:
    try:
        index = TIP_SLOT_ORDER.index(slot)
    except ValueError:
        return ()
    return TIP_SLOT_ORDER[:index]


def _BuildPriorSameDayTips(db: Session, user_id: int, run_date: date, slot: str) -> list[dict[str, Any]]:
    earlier_slots = set(_EarlierSlotsFor(slot))
    if not earlier_slots:
        return []

    items = GetInsights(
        db,
        user_id,
        insight_type=DAILY_TIP_TYPE,
        start_date=run_date.isoformat(),
        end_date=run_date.isoformat(),
        status="active",
        limit=6,
    )

    prior_items: list[dict[str, Any]] = []
    for item in items:
        payload = item.Payload or {}
        prior_slot = str(payload.get("slot") or "").strip().lower()
        if prior_slot not in earlier_slots:
            continue
        prior_items.append(
            {
                "slot": prior_slot,
                "title": item.Title,
                "summary": item.Summary,
            }
        )

    prior_items.sort(key=lambda item: TIP_SLOT_ORDER.index(item["slot"]))
    return prior_items


def _BuildPromptContext(db: Session, user: User, run_date: date, slot: str) -> dict[str, Any]:
    date_text = run_date.isoformat()
    start_90 = (run_date - timedelta(days=89)).isoformat()
    start_30 = (run_date - timedelta(days=29)).isoformat()
    summary = _Plain(GetSummary(db, user.Id, date_text))
    days_history = GetHistory(db, user.Id, "days", start_90, date_text, limit=120)
    rolling = _BuildRollingAverages(days_history)
    experiments = GetExperiments(db, user.Id, limit=5)
    other_insights = [
        _Plain(insight)
        for insight in GetInsights(db, user.Id, start_date=start_30, end_date=date_text, limit=5)
        if insight.InsightType != DAILY_TIP_TYPE
    ]
    targets_history = _Plain(GetTargetsHistory(db, user.Id, limit=5))
    weight_trend = _Plain(GetWeightTrend(db, user.Id, days=30))
    step_summary = _Plain(GetStepSummary(db, user.Id, start_30, date_text))
    recent_workouts = [_Plain(item) for item in GetWorkoutHistory(db, user.Id, start_30, date_text, 10)]
    derived = _BuildDerivedFlags(summary, rolling, slot)
    prior_today_tips = _BuildPriorSameDayTips(db, user.Id, run_date, slot)
    return {
        "user": {"display_name": _DisplayName(user)},
        "run": {"date": date_text, "slot": slot},
        "today": {
            "daily_log": summary.get("DailyLog"),
            "totals": summary.get("Totals"),
            "summary": summary.get("Summary"),
            "targets": summary.get("Targets"),
            "meal_slots": _MealSlotsForToday(summary),
        },
        "rolling_averages": rolling,
        "weight_trend_30d": weight_trend,
        "step_summary_30d": step_summary,
        "targets_history": targets_history,
        "recent_experiments": [_Plain(item) for item in experiments],
        "recent_insights": other_insights,
        "prior_today_tips": prior_today_tips,
        "recent_workouts": recent_workouts,
        "derived_flags": derived,
    }


def _BuildMessages(context: dict[str, Any]) -> list[dict[str, Any]]:
    slot = context["run"]["slot"]
    slot_instruction = {
        "morning": "The morning tip should help shape the day ahead.",
        "midday": "The midday tip should focus on the most useful next action for the rest of today.",
        "dinner": "The dinner-time tip should focus on evening decisions, especially bridge-to-dinner, protein, logging, or portion control if supported by the data.",
    }[slot]
    system_prompt = (
        "You are generating one daily health tip for a premium personal nutrition dashboard.\n"
        "The dashboard is warm, calm, editorial, and easy to scan.\n"
        "Use the provided structured data only.\n"
        "Treat current-day metrics and logs as the primary truth.\n"
        "If prior same-day tips are provided, use them only to maintain continuity and avoid repetition.\n"
        "Do not repeat earlier advice unless the same issue is still clearly supported by the current data.\n"
        "Prioritize practical behavioral advice over abstract commentary.\n"
        "Avoid generic encouragement, moralizing language, medical disclaimers, and repetition.\n"
        "Prefer meal timing, bridge-to-dinner, protein trajectory, hydration, logging completeness, and dinner-risk guidance when supported by data.\n"
        "Keep the visible tip concise and useful on mobile.\n"
        "Return JSON only with keys: title, summary, why_it_matters, confidence, tags.\n"
        "title must be under 80 characters. summary should usually be one sentence and under 220 characters."
    )
    user_prompt = (
        f"{slot_instruction}\n"
        "Mobile priorities from the dashboard spec are: calories, protein, meals logged, bridge-to-dinner status, hydration, daily insight.\n"
        "Generate the single best tip for this slot.\n"
        f"Context JSON:\n{json.dumps(context, indent=2, default=str)}"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _DailyTipModels() -> list[str]:
    models: list[str] = []
    primary = (Settings.OpenAiDailyTipModel or Settings.OpenAiModel or "gpt-5-mini").strip()
    if primary:
        models.append(primary)
    raw_fallbacks = Settings.OpenAiDailyTipFallbackModels or Settings.OpenAiFallbackModels or ""
    for item in raw_fallbacks.split(","):
        model = item.strip()
        if model and model not in models:
            models.append(model)
    return models


def _GenerateTipContent(context: dict[str, Any]) -> tuple[dict[str, Any], str]:
    messages = _BuildMessages(context)
    last_error: Exception | None = None
    for model in _DailyTipModels():
        try:
            content, model_used = GetOpenAiContentForModel(
                model,
                messages,
                Temperature=0.2,
                MaxTokens=500,
                ReasoningEffort=Settings.OpenAiDailyTipReasoningEffort or "low",
                TextVerbosity=Settings.OpenAiDailyTipTextVerbosity or "low",
            )
            parsed = _ParseJsonObject(content)
            return parsed, model_used
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    if last_error is not None:
        raise last_error
    raise ValueError("Failed to generate daily tip.")


def _ExistingDailyTipForSlot(db: Session, user_id: int, run_date: date, slot: str) -> Insight | None:
    items = GetInsights(
        db,
        user_id,
        insight_type=DAILY_TIP_TYPE,
        start_date=run_date.isoformat(),
        end_date=run_date.isoformat(),
        status="active",
        tag=slot,
        limit=3,
    )
    for item in items:
        if (item.Payload or {}).get("slot") == slot:
            return item
    return items[0] if items else None


def _HasAlreadyGeneratedForSlot(existing: Insight | None, slot: str, run_date: date) -> bool:
    if existing is None or existing.UpdatedAt is None:
        return False
    payload = existing.Payload or {}
    return payload.get("slot") == slot and existing.PeriodStart == run_date


def GenerateDailyTipForUser(
    db: Session,
    user: User,
    run_date: date,
    slot: str,
) -> tuple[Insight, str, bool]:
    existing = _ExistingDailyTipForSlot(db, user.Id, run_date, slot)
    if _HasAlreadyGeneratedForSlot(existing, slot, run_date):
        return existing, str((existing.Payload or {}).get("model_used") or "existing"), False

    context = _BuildPromptContext(db, user, run_date, slot)
    if not (context["today"]["meal_slots"] or context["rolling_averages"]):
        raise ValueError("Insufficient health data for daily tip generation.")

    parsed, model_used = _GenerateTipContent(context)
    title = str(parsed.get("title") or "").strip()
    summary = str(parsed.get("summary") or "").strip()
    if not title or not summary:
        raise ValueError("Daily tip response omitted title or summary.")
    confidence = _NormalizeConfidence(parsed.get("confidence"))
    tags = [DAILY_TIP_TAG, slot]
    for item in parsed.get("tags") or []:
        text = str(item).strip()
        if text and text not in tags:
            tags.append(text)
    payload = {
        "slot": slot,
        "why_it_matters": parsed.get("why_it_matters"),
        "confidence": confidence,
        "model_used": model_used,
        "generated_at": NowUtc().isoformat(),
        "context_snapshot": {
            "derived_flags": context.get("derived_flags"),
            "rolling_averages": context.get("rolling_averages"),
        },
    }
    insight = UpsertInsight(
        db,
        user.Id,
        UpsertInsightInput(
            InsightId=existing.InsightId if existing else None,
            InsightType=DAILY_TIP_TYPE,
            PeriodType="day",
            PeriodStart=run_date,
            Title=title,
            Summary=summary,
            Confidence=confidence,
            Status="active",
            Source="agent",
            Payload=payload,
            Tags=tags,
        ),
    )
    return insight, model_used, True


def RunDailyTips(
    db: Session,
    admin_user_id: int,
    run_date: date | None = None,
    run_time: str | None = None,
    slot: str | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    del admin_user_id  # reserved for future audit/notification use
    effective_date = run_date or ParseIsoDate(NowUtc().date().isoformat())
    effective_slot = _ResolveSlot(slot, run_time)
    users_query = db.query(User).filter(User.Role == "Parent", User.IsApproved == True)  # noqa: E712
    if user_id is not None:
        users_query = users_query.filter(User.Id == user_id)
    users = users_query.order_by(User.Id.asc()).all()

    result = DailyTipRunResult(slot=effective_slot, processed_users=0, generated=0, skipped=0, errors=0)
    for user in users:
        result.processed_users += 1
        try:
            _, _, created = GenerateDailyTipForUser(db, user, effective_date, effective_slot)
            if created:
                result.generated += 1
            else:
                result.skipped += 1
        except ValueError as exc:
            if "Insufficient health data" in str(exc):
                result.skipped += 1
                continue
            result.errors += 1
        except Exception:  # noqa: BLE001
            result.errors += 1
    return result.to_dict()
