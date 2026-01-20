"""AI-based image scanning for meals and nutrition labels."""

from typing import Any

import httpx

from app.modules.health.services.food_lookup_service import ParseLookupJson
from app.modules.health.services.serving_conversion_service import NormalizeUnit
from app.modules.health.utils.config import Settings


DEFAULT_VISION_MODEL = "gpt-4o"


def _NormalizeUnitValue(Unit: str) -> str:
    Normalized = NormalizeUnit(Unit)
    if Normalized == "ml":
        return "mL"
    if Normalized == "l":
        return "L"
    return Normalized or "serving"


def _ToFloat(Value: Any) -> float | None:
    if Value is None:
        return None
    try:
        return float(Value)
    except (TypeError, ValueError):
        return None


def _ToInt(Value: Any) -> int:
    if Value is None:
        return 0
    try:
        return int(float(Value))
    except (TypeError, ValueError):
        return 0


def _NormalizeQuestions(Value: Any) -> list[str]:
    if isinstance(Value, str):
        Value = [Value]
    if not isinstance(Value, list):
        return []
    cleaned: list[str] = []
    for item in Value:
        if isinstance(item, str):
            text = item.strip()
            if text:
                cleaned.append(text)
    return cleaned[:6]


def _NormalizeConfidence(Value: Any) -> str:
    if not isinstance(Value, str):
        return "Medium"
    normalized = Value.strip().title()
    if normalized in ("High", "Medium", "Low"):
        return normalized
    return "Medium"


def _StripBase64Prefix(ImageBase64: str) -> str:
    if not ImageBase64:
        return ImageBase64
    if "base64," in ImageBase64:
        return ImageBase64.split("base64,", 1)[-1]
    return ImageBase64


def _BuildMealPrompt() -> str:
    return (
        "You are a nutrition assistant. Analyze a photo of a single meal or drink."
        " Return total nutrition for the whole meal.\n\n"
        "Return ONLY a JSON object with:\n"
        "{\n"
        '  "FoodName": "short name for the meal",\n'
        '  "ServingQuantity": 1.0,\n'
        '  "ServingUnit": "serving",\n'
        '  "CaloriesPerServing": integer,\n'
        '  "ProteinPerServing": float (grams),\n'
        '  "FibrePerServing": float (grams) or null,\n'
        '  "CarbsPerServing": float (grams) or null,\n'
        '  "FatPerServing": float (grams) or null,\n'
        '  "SaturatedFatPerServing": float (grams) or null,\n'
        '  "SugarPerServing": float (grams) or null,\n'
        '  "SodiumPerServing": float (mg) or null,\n'
        '  "Summary": "short note, no em dashes",\n'
        '  "Confidence": "High" or "Medium" or "Low",\n'
        '  "Questions": ["question", "question"] or []\n'
        "}\n\n"
        "Rules:\n"
        "- Treat the photo as a single meal. Do not list ingredients.\n"
        "- Use metric estimates.\n"
        "- If a nutrition label is visible, use it and mention that in Summary.\n"
        "- If unsure, set Confidence to Low and ask for portion size or missing details in Questions.\n"
        "- Summary must be under 200 characters.\n"
        "- No extra text or markdown."
    )


def _BuildLabelPrompt() -> str:
    return (
        "You are a nutrition label parser. Extract nutrition values from the label in the image."
        " Return per serving nutrition for the product.\n\n"
        "Return ONLY a JSON object with:\n"
        "{\n"
        '  "FoodName": "product name with brand if visible",\n'
        '  "ServingQuantity": float,\n'
        '  "ServingUnit": "unit (e.g., g, mL, cup)",\n'
        '  "CaloriesPerServing": integer,\n'
        '  "ProteinPerServing": float (grams),\n'
        '  "FibrePerServing": float (grams) or null,\n'
        '  "CarbsPerServing": float (grams) or null,\n'
        '  "FatPerServing": float (grams) or null,\n'
        '  "SaturatedFatPerServing": float (grams) or null,\n'
        '  "SugarPerServing": float (grams) or null,\n'
        '  "SodiumPerServing": float (mg) or null,\n'
        '  "Summary": "short note, no em dashes",\n'
        '  "Confidence": "High" or "Medium" or "Low",\n'
        '  "Questions": ["question", "question"] or []\n'
        "}\n\n"
        "Rules:\n"
        "- Prefer per serving values. If only per 100g or per 100 mL are shown,"
        " set ServingQuantity to 100 and ServingUnit to g or mL. Add a Question asking for serving size.\n"
        "- If serving size is unclear, ask for clarification in Questions.\n"
        "- If the label is unreadable, set Confidence to Low and ask for a clearer photo.\n"
        "- Summary must be under 200 characters.\n"
        "- No extra text or markdown."
    )


def _AppendContextNote(Prompt: str, Note: str | None) -> str:
    if not Note:
        return Prompt
    Cleaned = str(Note).strip()
    if not Cleaned:
        return Prompt
    if len(Cleaned) > 500:
        Cleaned = Cleaned[:500].rstrip()
    return (
        f"{Prompt}\n\nAdditional context from the user:\n"
        f"{Cleaned}\n"
        "Use this only if it helps interpret the photo."
    )


def _RequestVisionContent(Prompt: str, ImageBase64: str) -> str:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")
    if not ImageBase64:
        raise ValueError("Image data is required.")

    Payload = {
        "model": DEFAULT_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": Prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{ImageBase64}"},
                    },
                ],
            }
        ],
        "temperature": 0.2,
        "max_tokens": 1000,
    }

    Headers = {
        "Authorization": f"Bearer {Settings.OpenAiApiKey}",
        "Content-Type": "application/json",
    }

    Response = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers=Headers,
        json=Payload,
        timeout=60.0,
    )
    Response.raise_for_status()
    Data = Response.json()
    return Data.get("choices", [{}])[0].get("message", {}).get("content", "")


def _NormalizeScanResult(Data: dict) -> dict[str, Any]:
    RawName = str(Data.get("FoodName", "")).strip()
    FoodName = RawName or "AI scan"
    ServingQuantityRaw = Data.get("ServingQuantity")
    ServingQuantity = _ToFloat(ServingQuantityRaw)
    if not ServingQuantity or ServingQuantity <= 0:
        ServingQuantity = 1.0
    ServingUnitRaw = Data.get("ServingUnit")
    ServingUnit = _NormalizeUnitValue(str(ServingUnitRaw or "serving"))

    CaloriesRaw = Data.get("CaloriesPerServing")
    ProteinRaw = Data.get("ProteinPerServing")
    Calories = _ToInt(CaloriesRaw)
    Protein = _ToFloat(ProteinRaw)

    Questions = _NormalizeQuestions(Data.get("Questions"))

    if Calories < 0:
        Calories = 0
    if Protein is None or Protein < 0:
        Protein = 0.0

    if not RawName:
        Questions.append("Confirm the food name.")
    if ServingUnitRaw is None or not str(ServingUnitRaw).strip():
        Questions.append("Confirm the serving unit.")
    if ServingQuantityRaw is None or (isinstance(ServingQuantityRaw, str) and not ServingQuantityRaw.strip()):
        Questions.append("Confirm the serving quantity.")
    if CaloriesRaw is None or (isinstance(CaloriesRaw, str) and not CaloriesRaw.strip()):
        Questions.append("Enter calories per serving.")
    if ProteinRaw is None or (isinstance(ProteinRaw, str) and not ProteinRaw.strip()):
        Questions.append("Enter protein per serving.")

    Summary = str(Data.get("Summary", "")).strip()
    Confidence = _NormalizeConfidence(Data.get("Confidence"))

    if Questions:
        UniqueQuestions: list[str] = []
        seen = set()
        for item in Questions:
            if item not in seen:
                UniqueQuestions.append(item)
                seen.add(item)
        Questions = UniqueQuestions[:6]

    return {
        "FoodName": FoodName,
        "ServingQuantity": ServingQuantity,
        "ServingUnit": ServingUnit,
        "CaloriesPerServing": Calories,
        "ProteinPerServing": Protein,
        "FibrePerServing": _ToFloat(Data.get("FibrePerServing")),
        "CarbsPerServing": _ToFloat(Data.get("CarbsPerServing")),
        "FatPerServing": _ToFloat(Data.get("FatPerServing")),
        "SaturatedFatPerServing": _ToFloat(Data.get("SaturatedFatPerServing")),
        "SugarPerServing": _ToFloat(Data.get("SugarPerServing")),
        "SodiumPerServing": _ToFloat(Data.get("SodiumPerServing")),
        "Summary": Summary,
        "Confidence": Confidence,
        "Questions": Questions,
    }


def ParseImageScan(ImageBase64: str, Mode: str, Note: str | None = None) -> dict[str, Any]:
    if Mode not in ("meal", "label"):
        raise ValueError("Mode must be meal or label.")

    CleanBase64 = _StripBase64Prefix(ImageBase64)
    Prompt = _BuildMealPrompt() if Mode == "meal" else _BuildLabelPrompt()
    Prompt = _AppendContextNote(Prompt, Note)
    Content = _RequestVisionContent(Prompt, CleanBase64)
    Parsed = ParseLookupJson(Content)
    if not isinstance(Parsed, dict):
        raise ValueError("Invalid AI response format.")

    return _NormalizeScanResult(Parsed)
