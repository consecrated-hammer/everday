"""AI-driven food lookup, with text, options, image, and autosuggest."""

import base64
import json
import logging
import re
from typing import Optional

import httpx

from app.modules.health.services.openai_client import (
    GetOpenAiContent,
    GetOpenAiContentForModel,
    GetOpenAiContentWithModel,
)
from app.modules.health.utils.config import Settings

Logger = logging.getLogger("health.food_lookup")


class FoodLookupResult:
    def __init__(
        self,
        FoodName: str,
        ServingQuantity: float,
        ServingUnit: str,
        CaloriesPerServing: int,
        ProteinPerServing: float,
        FibrePerServing: Optional[float] = None,
        CarbsPerServing: Optional[float] = None,
        FatPerServing: Optional[float] = None,
        SaturatedFatPerServing: Optional[float] = None,
        SugarPerServing: Optional[float] = None,
        SodiumPerServing: Optional[float] = None,
        Source: str = "AI",
        Confidence: str = "High",
    ):
        self.FoodName = FoodName
        self.ServingQuantity = ServingQuantity
        self.ServingUnit = ServingUnit
        self.CaloriesPerServing = CaloriesPerServing
        self.ProteinPerServing = ProteinPerServing
        self.FibrePerServing = FibrePerServing
        self.CarbsPerServing = CarbsPerServing
        self.FatPerServing = FatPerServing
        self.SaturatedFatPerServing = SaturatedFatPerServing
        self.SugarPerServing = SugarPerServing
        self.SodiumPerServing = SodiumPerServing
        self.Source = Source
        self.Confidence = Confidence

    def ToDict(self) -> dict:
        return {
            "FoodName": self.FoodName,
            "ServingQuantity": self.ServingQuantity,
            "ServingUnit": self.ServingUnit,
            "CaloriesPerServing": self.CaloriesPerServing,
            "ProteinPerServing": self.ProteinPerServing,
            "FibrePerServing": self.FibrePerServing,
            "CarbsPerServing": self.CarbsPerServing,
            "FatPerServing": self.FatPerServing,
            "SaturatedFatPerServing": self.SaturatedFatPerServing,
            "SugarPerServing": self.SugarPerServing,
            "SodiumPerServing": self.SodiumPerServing,
            "Source": self.Source,
            "Confidence": self.Confidence,
        }


def ParseLookupJson(Content: str) -> object:
    if not Content:
        raise ValueError("No response from AI.")

    if "```json" in Content:
        Content = Content.split("```json")[1].split("```")[0].strip()
    elif "```" in Content:
        Content = Content.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(Content)
    except json.JSONDecodeError as ErrorValue:
        Cleaned = Content.strip()
        ListStart = Cleaned.find("[")
        ListEnd = Cleaned.rfind("]")
        ObjStart = Cleaned.find("{")
        ObjEnd = Cleaned.rfind("}")
        Candidate = ""
        if ListStart != -1 and ListEnd != -1 and ListEnd > ListStart:
            Candidate = Cleaned[ListStart : ListEnd + 1]
        elif ObjStart != -1 and ObjEnd != -1 and ObjEnd > ObjStart:
            Candidate = Cleaned[ObjStart : ObjEnd + 1]
        if Candidate:
            try:
                return json.loads(Candidate)
            except json.JSONDecodeError:
                pass
        raise ValueError(f"Invalid AI response format: {ErrorValue}") from ErrorValue


def NormalizeServingSize(ServingQuantity: float, ServingUnit: str) -> tuple[float, str]:
    UnitValue = str(ServingUnit or "").strip()
    if not UnitValue:
        return ServingQuantity, "serving"

    Match = re.match(r"^(\d+\.?\d*)\s*([a-zA-Z]+)$", UnitValue)
    if Match and ServingQuantity == 1.0:
        ServingQuantity = float(Match.group(1))
        UnitValue = Match.group(2)

    UnitLower = UnitValue.lower()
    if UnitLower in ("g", "gram", "grams", "gr"):
        return ServingQuantity, "g"
    if UnitLower in ("ml", "milliliter", "milliliters", "millilitre", "millilitres"):
        return ServingQuantity, "mL"
    if UnitLower in ("servings", "portion", "portions"):
        return ServingQuantity, "serving"

    return ServingQuantity, UnitValue


def NormalizeFoodLookupResult(FoodData: dict, Query: str) -> FoodLookupResult:
    ServingQuantity = float(FoodData.get("ServingQuantity", 1.0))
    ServingUnit = FoodData.get("ServingUnit", "serving")
    ServingQuantity, ServingUnit = NormalizeServingSize(ServingQuantity, ServingUnit)
    return FoodLookupResult(
        FoodName=FoodData.get("FoodName", Query),
        ServingQuantity=ServingQuantity,
        ServingUnit=ServingUnit,
        CaloriesPerServing=int(FoodData.get("CaloriesPerServing", 0)),
        ProteinPerServing=float(FoodData.get("ProteinPerServing", 0)),
        FibrePerServing=float(FoodData["FibrePerServing"]) if FoodData.get("FibrePerServing") is not None else None,
        CarbsPerServing=float(FoodData["CarbsPerServing"]) if FoodData.get("CarbsPerServing") is not None else None,
        FatPerServing=float(FoodData["FatPerServing"]) if FoodData.get("FatPerServing") is not None else None,
        SaturatedFatPerServing=float(FoodData["SaturatedFatPerServing"]) if FoodData.get("SaturatedFatPerServing") is not None else None,
        SugarPerServing=float(FoodData["SugarPerServing"]) if FoodData.get("SugarPerServing") is not None else None,
        SodiumPerServing=float(FoodData["SodiumPerServing"]) if FoodData.get("SodiumPerServing") is not None else None,
        Source="AI-Text",
        Confidence=FoodData.get("Confidence", "Medium"),
    )


def LookupFoodByText(Query: str) -> FoodLookupResult:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    SystemPrompt = (
        "You are a nutrition database assistant. When given a food name, return accurate nutritional information in JSON format.\n\n"
        "Return ONLY a JSON object with these exact fields:\n"
        "{\n"
        '  "FoodName": "standardized food name",\n'
        '  "ServingQuantity": 1.0,\n'
        '  "ServingUnit": "unit (e.g., g, mL, cup, slice, piece)",\n'
        '  "CaloriesPerServing": integer,\n'
        '  "ProteinPerServing": float (grams),\n'
        '  "FibrePerServing": float (grams) or null,\n'
        '  "CarbsPerServing": float (grams) or null,\n'
        '  "FatPerServing": float (grams) or null,\n'
        '  "SaturatedFatPerServing": float (grams) or null,\n'
        '  "SugarPerServing": float (grams) or null,\n'
        '  "SodiumPerServing": float (mg) or null,\n'
        '  "Confidence": "High" or "Medium" or "Low"\n'
        "}\n\n"
        "Serving size rules:\n"
        "- Prefer measurable units when possible: use grams (g) for solids and milliliters (mL) for liquids.\n"
        "- Avoid vague units like \"serving\" for basics such as milk, yogurt, rice, cereal, or vegetables.\n"
        "- Use \"serving\" ONLY for named menu items or combo meals, and include the size in FoodName (e.g., \"Large Tropical Whopper Meal\").\n"
        "- For discrete items, use clear units like piece, slice, egg, can, bar.\n\n"
        "Use standard serving sizes. Be precise with nutritional values based on USDA or Australian food databases."
    )

    Content = GetOpenAiContent(
        [
            {"role": "system", "content": SystemPrompt},
            {"role": "user", "content": f"Look up nutritional information for: {Query}"},
        ],
        Temperature=0.3,
        MaxTokens=500,
    )
    FoodData = ParseLookupJson(Content)
    if isinstance(FoodData, list):
        if not FoodData:
            raise ValueError("No results returned from AI.")
        FoodData = FoodData[0]
    if not isinstance(FoodData, dict):
        raise ValueError("Invalid AI response format.")

    return NormalizeFoodLookupResult(FoodData, Query)


def LookupFoodByTextOptions(Query: str) -> list[FoodLookupResult]:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    SystemPrompt = (
        "You are a nutrition database assistant. When given a food name, return multiple size options in JSON format.\n\n"
        "Return ONLY a JSON array of 1 to 3 objects with these exact fields:\n"
        "[\n"
        "  {\n"
        '    "FoodName": "standardized food name including size if needed",\n'
        '    "ServingQuantity": 1.0,\n'
        '    "ServingUnit": "unit (e.g., g, mL, cup, slice, piece)",\n'
        '    "CaloriesPerServing": integer,\n'
        '    "ProteinPerServing": float (grams),\n'
        '    "FibrePerServing": float (grams) or null,\n'
        '    "CarbsPerServing": float (grams) or null,\n'
        '    "FatPerServing": float (grams) or null,\n'
        '    "SaturatedFatPerServing": float (grams) or null,\n'
        '    "SugarPerServing": float (grams) or null,\n'
        '    "SodiumPerServing": float (mg) or null,\n'
        '    "Confidence": "High" or "Medium" or "Low"\n'
        "  }\n"
        "]\n\n"
        "Serving size rules:\n"
        "- Prefer measurable units when possible: use grams (g) for solids and milliliters (mL) for liquids.\n"
        "- Avoid vague units like \"serving\" for basics such as milk, yogurt, rice, cereal, or vegetables.\n"
        "- Use \"serving\" ONLY for named menu items or combo meals, and include the size in FoodName (e.g., \"Large Tropical Whopper Meal\").\n"
        "- For discrete items, use clear units like piece, slice, egg, can, bar.\n\n"
        "When size variants exist for menu items or branded meals, include small, medium, and large entries. Otherwise return the most common measurable serving sizes."
    )

    Content = GetOpenAiContent(
        [
            {"role": "system", "content": SystemPrompt},
            {"role": "user", "content": f"Look up nutritional information for: {Query}"},
        ],
        Temperature=0.3,
        MaxTokens=700,
    )
    try:
        FoodData = ParseLookupJson(Content)
    except ValueError:
        RetryContent, _RetryModelUsed = GetOpenAiContentWithModel(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a formatter. Return ONLY a JSON array of 1-3 objects "
                        "with the required fields. No extra text."
                    ),
                },
                {"role": "user", "content": Content},
            ],
            Temperature=0.2,
            MaxTokens=600,
        )
        FoodData = ParseLookupJson(RetryContent)

    if not isinstance(FoodData, list) or not FoodData:
        raise ValueError("Invalid AI response format.")

    Results: list[FoodLookupResult] = []
    for Item in FoodData[:3]:
        if not isinstance(Item, dict):
            continue
        Results.append(NormalizeFoodLookupResult(Item, Query))

    if not Results:
        raise ValueError("No valid options returned from AI.")
    return Results


def LookupFoodByImage(ImageBase64: str) -> list[FoodLookupResult]:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    if not ImageBase64:
        raise ValueError("Image data is required.")

    SystemPrompt = (
        "You are a nutrition assistant that analyzes food images. Identify all visible foods or ingredients "
        "and estimate their quantities and nutritional values.\n\n"
        "Return ONLY a JSON array of objects with these exact fields:\n"
        "[\n"
        "  {\n"
        "    \"FoodName\": \"ingredient name\",\n"
        "    \"ServingQuantity\": estimated quantity as float,\n"
        "    \"ServingUnit\": \"unit (e.g., g, mL, cup, tbsp, slice)\",\n"
        "    \"CaloriesPerServing\": integer,\n"
        "    \"ProteinPerServing\": float (grams),\n"
        "    \"FibrePerServing\": float (grams) or null,\n"
        "    \"CarbsPerServing\": float (grams) or null,\n"
        "    \"FatPerServing\": float (grams) or null,\n"
        "    \"SaturatedFatPerServing\": float (grams) or null,\n"
        "    \"SugarPerServing\": float (grams) or null,\n"
        "    \"SodiumPerServing\": float (mg) or null,\n"
        "    \"Confidence\": \"High\" or \"Medium\" or \"Low\"\n"
        "  }\n"
        "]\n\n"
        "Serving size rules:\n"
        "- Prefer measurable units when possible: use grams (g) for solids and milliliters (mL) for liquids.\n"
        "- For discrete items, use clear units like piece, slice, egg, can, bar.\n"
        "- Use \"serving\" ONLY for named menu items or combo meals, and include the size in FoodName.\n\n"
        "Provide reasonable estimates based on portion size visible in the image."
    )

    Payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": SystemPrompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{ImageBase64}"}},
                ],
            }
        ],
        "temperature": 0.3,
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
    Content = Data.get("choices", [{}])[0].get("message", {}).get("content", "")

    FoodData = ParseLookupJson(Content)
    if not isinstance(FoodData, list):
        raise ValueError("Invalid AI response format.")

    Results: list[FoodLookupResult] = []
    for Item in FoodData:
        if isinstance(Item, dict):
            Results.append(NormalizeFoodLookupResult(Item, "Image food"))

    if not Results:
        raise ValueError("No results returned from AI.")

    return Results


def LookupFoodByBarcode(Barcode: str) -> FoodLookupResult | None:
    if not Barcode:
        raise ValueError("Barcode is required.")

    try:
        Response = httpx.get(
            f"https://world.openfoodfacts.org/api/v2/product/{Barcode}.json",
            timeout=10.0,
            headers={"User-Agent": "EverdayHealth/1.0"},
        )
        if Response.status_code == 404:
            return None
        Response.raise_for_status()
        Data = Response.json()
    except Exception as ErrorValue:
        Logger.warning("barcode lookup failed", exc_info=ErrorValue)
        return None

    if Data.get("status") != 1:
        return None

    Product = Data.get("product", {})
    Nutriments = Product.get("nutriments", {})

    def ToFloat(Value):
        if Value is None:
            return None
        try:
            return float(Value)
        except (ValueError, TypeError):
            return None

    CaloriesPer100g = ToFloat(Nutriments.get("energy-kcal_100g"))
    ProteinPer100g = ToFloat(Nutriments.get("proteins_100g"))
    FatPer100g = ToFloat(Nutriments.get("fat_100g"))
    SaturatedFatPer100g = ToFloat(Nutriments.get("saturated-fat_100g"))
    CarbsPer100g = ToFloat(Nutriments.get("carbohydrates_100g"))
    SugarPer100g = ToFloat(Nutriments.get("sugars_100g"))
    FiberPer100g = ToFloat(Nutriments.get("fiber_100g"))
    SodiumPer100g = ToFloat(Nutriments.get("sodium_100g"))

    ServingQuantity = ToFloat(Product.get("serving_quantity")) or 100.0
    ServingUnit = "g"
    CaloriesPerServing = round((CaloriesPer100g or 0) * ServingQuantity / 100)

    return FoodLookupResult(
        FoodName=Product.get("product_name", "Unknown product"),
        ServingQuantity=ServingQuantity,
        ServingUnit=ServingUnit,
        CaloriesPerServing=CaloriesPerServing,
        ProteinPerServing=round((ProteinPer100g or 0) * ServingQuantity / 100, 1),
        FibrePerServing=round((FiberPer100g or 0) * ServingQuantity / 100, 1) if FiberPer100g else None,
        CarbsPerServing=round((CarbsPer100g or 0) * ServingQuantity / 100, 1) if CarbsPer100g else None,
        FatPerServing=round((FatPer100g or 0) * ServingQuantity / 100, 1) if FatPer100g else None,
        SaturatedFatPerServing=(
            round((SaturatedFatPer100g or 0) * ServingQuantity / 100, 1)
            if SaturatedFatPer100g
            else None
        ),
        SugarPerServing=round((SugarPer100g or 0) * ServingQuantity / 100, 1) if SugarPer100g else None,
        SodiumPerServing=(
            round((SodiumPer100g or 0) * ServingQuantity / 100 * 1000, 1)
            if SodiumPer100g
            else None
        ),
        Source="OpenFoodFacts",
        Confidence="High",
    )


def GetFoodSuggestions(Query: str) -> list[str]:
    if not Settings.OpenAiApiKey:
        return []

    SystemPrompt = (
        "You are a concise autosuggest assistant for Australian grocery and takeaway items. "
        "Return ONLY a JSON array of 5 to 8 short suggestions. No em dashes."
    )

    Content, _ModelUsed = GetOpenAiContentForModel(
        Settings.OpenAiAutosuggestModel or "gpt-5-mini",
        [
            {"role": "system", "content": SystemPrompt},
            {"role": "user", "content": f"Suggest foods matching: {Query}"},
        ],
        Temperature=0.4,
        MaxTokens=200,
    )

    try:
        Parsed = ParseLookupJson(Content)
    except ValueError:
        return []

    if isinstance(Parsed, list):
        return [str(Item) for Item in Parsed if isinstance(Item, str)]
    return []


def ParseImageToBase64(ImageBytes: bytes) -> str:
    return base64.b64encode(ImageBytes).decode("utf-8")
