from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.health.schemas import FoodInfo
from app.modules.health.services.food_lookup_service import (
    GetFoodSuggestions,
    LookupFoodByBarcode,
    LookupFoodByImage,
    LookupFoodByText,
    LookupFoodByTextOptions,
)
from app.modules.health.services.multi_source_lookup_service import MultiSourceFoodLookupService
from app.modules.health.services.rate_limiter import OpenFoodFactsRateLimiter

router = APIRouter()


class TextLookupInput(BaseModel):
    Query: str


class ImageLookupInput(BaseModel):
    ImageBase64: str


class BarcodeLookupInput(BaseModel):
    Barcode: str


class FoodLookupResponse(BaseModel):
    FoodName: str
    ServingQuantity: float
    ServingUnit: str
    CaloriesPerServing: int
    ProteinPerServing: float
    FibrePerServing: float | None = None
    CarbsPerServing: float | None = None
    FatPerServing: float | None = None
    SaturatedFatPerServing: float | None = None
    SugarPerServing: float | None = None
    SodiumPerServing: float | None = None
    Source: str
    Confidence: str


class TextLookupResponse(BaseModel):
    Result: FoodLookupResponse


class TextLookupOptionsResponse(BaseModel):
    Results: list[FoodLookupResponse]


class ImageLookupResponse(BaseModel):
    Results: list[FoodLookupResponse]


class BarcodeLookupResponse(BaseModel):
    Result: FoodLookupResponse | None


@router.post("/text", response_model=TextLookupResponse)
def LookupByText(
    payload: TextLookupInput,
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> TextLookupResponse:
    try:
        result = LookupFoodByText(payload.Query)
        return TextLookupResponse(Result=FoodLookupResponse(**result.ToDict()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to lookup food.") from exc


@router.post("/text-options", response_model=TextLookupOptionsResponse)
def LookupByTextOptions(
    payload: TextLookupInput,
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> TextLookupOptionsResponse:
    try:
        results = LookupFoodByTextOptions(payload.Query)
        return TextLookupOptionsResponse(
            Results=[FoodLookupResponse(**result.ToDict()) for result in results]
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to lookup food.") from exc


@router.post("/image", response_model=ImageLookupResponse)
def LookupByImage(
    payload: ImageLookupInput,
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> ImageLookupResponse:
    try:
        results = LookupFoodByImage(payload.ImageBase64)
        return ImageLookupResponse(Results=[FoodLookupResponse(**result.ToDict()) for result in results])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to analyze image.") from exc


@router.post("/barcode", response_model=BarcodeLookupResponse)
def LookupByBarcode(
    payload: BarcodeLookupInput,
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> BarcodeLookupResponse:
    try:
        result = LookupFoodByBarcode(payload.Barcode)
        if result is None:
            return BarcodeLookupResponse(Result=None)
        return BarcodeLookupResponse(Result=FoodLookupResponse(**result.ToDict()))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to lookup barcode.") from exc


class FoodSuggestionsResponse(BaseModel):
    Suggestions: list[str]


@router.get("/suggestions", response_model=FoodSuggestionsResponse)
def GetFoodSuggestionsRoute(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=20, description="Maximum suggestions"),
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> FoodSuggestionsResponse:
    try:
        suggestions = GetFoodSuggestions(q)
        if len(suggestions) > limit:
            suggestions = suggestions[:limit]
        return FoodSuggestionsResponse(Suggestions=suggestions)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to get suggestions.") from exc


class MultiSourceSearchInput(BaseModel):
    Query: str


class MultiSourceSearchResponse(BaseModel):
    Openfoodfacts: list[FoodInfo]
    AiFallbackAvailable: bool


@router.post("/multi-source/search", response_model=MultiSourceSearchResponse)
async def MultiSourceSearch(
    payload: MultiSourceSearchInput,
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
) -> MultiSourceSearchResponse:
    try:
        results = await MultiSourceFoodLookupService.Search(payload.Query)
        return MultiSourceSearchResponse(
            Openfoodfacts=results.get("openfoodfacts", []),
            AiFallbackAvailable=results.get("ai_fallback_available", True),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Multi-source search failed: {exc}") from exc


@router.get("/multi-source/cache-stats")
def GetCacheStats(
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
):
    return MultiSourceFoodLookupService.GetCacheStats()


@router.get("/multi-source/rate-limit-stats")
def GetRateLimitStats(
    user: UserContext = Depends(RequireModuleRole("health", write=False)),
):
    return OpenFoodFactsRateLimiter.GetAllStats()
