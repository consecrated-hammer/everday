"""Food lookup service with simple in-memory caching."""

from datetime import datetime, timedelta
import logging
from typing import Any

from app.modules.health.schemas import FoodInfo
from app.modules.health.services.openfoodfacts_service import OpenFoodFactsService
from app.modules.health.utils.config import Settings


_CACHE: dict[str, tuple[Any, datetime]] = {}
_CACHE_TTL = timedelta(hours=24)
Logger = logging.getLogger("health.multi_source_lookup")


class MultiSourceFoodLookupService:
    @classmethod
    async def Search(cls, Query: str) -> dict[str, list[FoodInfo] | bool]:
        CacheKey = f"search:{Query}"
        if CacheKey in _CACHE:
            CachedResults, CachedTime = _CACHE[CacheKey]
            if datetime.now() - CachedTime < _CACHE_TTL:
                return CachedResults

        Results: dict[str, list[FoodInfo] | bool] = {
            "openfoodfacts": [],
            "ai_fallback_available": bool(Settings.OpenAiApiKey),
        }

        try:
            Results["openfoodfacts"] = await OpenFoodFactsService.SearchProducts(Query, PageSize=10)
        except Exception as ErrorValue:
            Logger.warning("openfoodfacts search failed", exc_info=ErrorValue)

        _CACHE[CacheKey] = (Results, datetime.now())
        return Results

    @classmethod
    async def GetByBarcode(cls, Barcode: str) -> FoodInfo | None:
        CacheKey = f"barcode:{Barcode}"
        if CacheKey in _CACHE:
            CachedResult, CachedTime = _CACHE[CacheKey]
            if datetime.now() - CachedTime < _CACHE_TTL:
                return CachedResult

        try:
            Result = await OpenFoodFactsService.GetProductByBarcode(Barcode)
            if Result:
                _CACHE[CacheKey] = (Result, datetime.now())
            return Result
        except Exception as ErrorValue:
            Logger.warning("barcode lookup failed", exc_info=ErrorValue)
            return None

    @classmethod
    def ClearCache(cls) -> None:
        global _CACHE
        _CACHE = {}

    @classmethod
    def GetCacheStats(cls) -> dict[str, Any]:
        Now = datetime.now()
        ValidEntries = sum(1 for _, (_, CachedTime) in _CACHE.items() if Now - CachedTime < _CACHE_TTL)
        return {
            "total_entries": len(_CACHE),
            "valid_entries": ValidEntries,
            "expired_entries": len(_CACHE) - ValidEntries,
            "ttl_hours": _CACHE_TTL.total_seconds() / 3600,
        }
