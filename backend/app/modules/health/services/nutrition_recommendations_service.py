"""AI-powered nutrition recommendations."""

import json
from datetime import datetime
from typing import Optional

from app.modules.health.services.openai_client import GetOpenAiContentWithModel
from app.modules.health.utils.config import Settings


class NutritionRecommendation:
    def __init__(
        self,
        DailyCalorieTarget: int,
        ProteinTargetMin: float,
        ProteinTargetMax: float,
        FibreTarget: Optional[float] = None,
        CarbsTarget: Optional[float] = None,
        FatTarget: Optional[float] = None,
        SaturatedFatTarget: Optional[float] = None,
        SugarTarget: Optional[float] = None,
        SodiumTarget: Optional[float] = None,
        Explanation: str = "",
    ):
        self.DailyCalorieTarget = DailyCalorieTarget
        self.ProteinTargetMin = ProteinTargetMin
        self.ProteinTargetMax = ProteinTargetMax
        self.FibreTarget = FibreTarget
        self.CarbsTarget = CarbsTarget
        self.FatTarget = FatTarget
        self.SaturatedFatTarget = SaturatedFatTarget
        self.SugarTarget = SugarTarget
        self.SodiumTarget = SodiumTarget
        self.Explanation = Explanation

    def ToDict(self) -> dict:
        return {
            "DailyCalorieTarget": self.DailyCalorieTarget,
            "ProteinTargetMin": self.ProteinTargetMin,
            "ProteinTargetMax": self.ProteinTargetMax,
            "FibreTarget": self.FibreTarget,
            "CarbsTarget": self.CarbsTarget,
            "FatTarget": self.FatTarget,
            "SaturatedFatTarget": self.SaturatedFatTarget,
            "SugarTarget": self.SugarTarget,
            "SodiumTarget": self.SodiumTarget,
            "Explanation": self.Explanation,
        }


def CalculateAge(BirthDate: str) -> int:
    Birth = datetime.strptime(BirthDate, "%Y-%m-%d")
    Today = datetime.now()
    Age = Today.year - Birth.year - ((Today.month, Today.day) < (Birth.month, Birth.day))
    return Age


def _TryParseRecommendationJson(Content: str) -> Optional[dict]:
    Cleaned = Content.strip()
    if "```json" in Cleaned:
        Cleaned = Cleaned.split("```json")[1].split("```")[0].strip()
    elif "```" in Cleaned:
        Cleaned = Cleaned.split("```")[1].split("```")[0].strip()

    try:
        Parsed = json.loads(Cleaned)
        if isinstance(Parsed, dict):
            return Parsed
    except json.JSONDecodeError:
        pass

    Start = Cleaned.find("{")
    End = Cleaned.rfind("}")
    if Start != -1 and End != -1 and End > Start:
        Candidate = Cleaned[Start : End + 1]
        try:
            Parsed = json.loads(Candidate)
            if isinstance(Parsed, dict):
                return Parsed
        except json.JSONDecodeError:
            return None

    return None


def GetAiNutritionRecommendations(
    Age: int,
    HeightCm: int,
    WeightKg: float,
    ActivityLevel: str,
) -> tuple[NutritionRecommendation, str]:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    SystemPrompt = (
        "You are a nutrition and fitness expert. Given a person's age, height, weight, and activity level, provide personalized daily nutrition targets.\n\n"
        "Return ONLY a JSON object with these exact fields:\n"
        "{\n"
        '  "DailyCalorieTarget": integer (daily calories),\n'
        '  "ProteinTargetMin": float (grams),\n'
        '  "ProteinTargetMax": float (grams),\n'
        '  "FibreTarget": float (grams),\n'
        '  "CarbsTarget": float (grams),\n'
        '  "FatTarget": float (grams),\n'
        '  "SaturatedFatTarget": float (grams, max),\n'
        '  "SugarTarget": float (grams, max),\n'
        '  "SodiumTarget": float (mg, max),\n'
        '  "Explanation": "Brief explanation of recommendations (2-3 sentences)"\n'
        "}\n\n"
        "Base your recommendations on:\n"
        "- Basal Metabolic Rate (BMR) + activity level\n"
        "- Standard macronutrient ratios for balanced diet\n"
        "- General health guidelines (WHO, dietary guidelines)\n"
        "- Protein: 0.8-2.0g per kg body weight depending on activity\n"
        "- Fibre: 25-35g per day\n"
        "- Saturated fat: <10% of calories\n"
        "- Sugar: <50g per day\n"
        "- Sodium: <2300mg per day"
    )

    UserPrompt = (
        f"User profile:\n"
        f"- Age: {Age} years\n"
        f"- Height: {HeightCm} cm\n"
        f"- Weight: {WeightKg} kg\n"
        f"- Activity Level: {ActivityLevel}\n\n"
        "Provide personalized daily nutrition targets."
    )

    Content, ModelUsed = GetOpenAiContentWithModel(
        [
            {"role": "system", "content": SystemPrompt},
            {"role": "user", "content": UserPrompt},
        ],
        Temperature=0.3,
        MaxTokens=900,
    )

    if not Content:
        RetryContent, RetryModelUsed = GetOpenAiContentWithModel(
            [
                {"role": "system", "content": SystemPrompt},
                {"role": "user", "content": UserPrompt},
            ],
            Temperature=0.1,
            MaxTokens=1200,
        )
        Content = RetryContent
        ModelUsed = RetryModelUsed
        if not Content:
            raise ValueError("No response from AI.")

    RecommendationData = _TryParseRecommendationJson(Content)
    if RecommendationData is None:
        RetrySystemPrompt = (
            "You are a formatter. Return ONLY valid JSON with the required fields. "
            "Do not include extra text. Explanation must not contain double quotes."
        )
        RetryUserPrompt = f"Reformat this into valid JSON only:\n{Content}"
        RetryContent, RetryModelUsed = GetOpenAiContentWithModel(
            [
                {"role": "system", "content": RetrySystemPrompt},
                {"role": "user", "content": RetryUserPrompt},
            ],
            Temperature=0.1,
            MaxTokens=400,
        )
        RecommendationData = _TryParseRecommendationJson(RetryContent)
        if RecommendationData is None:
            raise ValueError("Invalid AI response format.")
        ModelUsed = RetryModelUsed

    Recommendation = NutritionRecommendation(
        DailyCalorieTarget=int(RecommendationData.get("DailyCalorieTarget", 2000)),
        ProteinTargetMin=float(RecommendationData.get("ProteinTargetMin", 60)),
        ProteinTargetMax=float(RecommendationData.get("ProteinTargetMax", 120)),
        FibreTarget=float(RecommendationData.get("FibreTarget", 30))
        if RecommendationData.get("FibreTarget")
        else None,
        CarbsTarget=float(RecommendationData.get("CarbsTarget", 250))
        if RecommendationData.get("CarbsTarget")
        else None,
        FatTarget=float(RecommendationData.get("FatTarget", 70))
        if RecommendationData.get("FatTarget")
        else None,
        SaturatedFatTarget=float(RecommendationData.get("SaturatedFatTarget", 20))
        if RecommendationData.get("SaturatedFatTarget")
        else None,
        SugarTarget=float(RecommendationData.get("SugarTarget", 50))
        if RecommendationData.get("SugarTarget")
        else None,
        SodiumTarget=float(RecommendationData.get("SodiumTarget", 2300))
        if RecommendationData.get("SodiumTarget")
        else None,
        Explanation=RecommendationData.get(
            "Explanation", "Personalized recommendations based on your profile."
        ),
    )
    return Recommendation, ModelUsed
