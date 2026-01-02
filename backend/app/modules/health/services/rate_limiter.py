"""Simple token-bucket rate limiter for OpenFoodFacts endpoints."""

import asyncio
import time


class TokenBucket:
    def __init__(self, Capacity: int, RefillRatePerSecond: float):
        self.Capacity = Capacity
        self.RefillRatePerSecond = RefillRatePerSecond
        self.Tokens = Capacity
        self.LastRefill = time.time()
        self.Lock = asyncio.Lock()

    async def Acquire(self, Count: int = 1, Wait: bool = True) -> bool:
        async with self.Lock:
            self._Refill()
            if self.Tokens >= Count:
                self.Tokens -= Count
                return True
            if not Wait:
                return False

        while True:
            await asyncio.sleep(0.1)
            async with self.Lock:
                self._Refill()
                if self.Tokens >= Count:
                    self.Tokens -= Count
                    return True

    def _Refill(self) -> None:
        Now = time.time()
        Elapsed = Now - self.LastRefill
        if Elapsed <= 0:
            return
        Refill = Elapsed * self.RefillRatePerSecond
        if Refill > 0:
            self.Tokens = min(self.Capacity, self.Tokens + Refill)
            self.LastRefill = Now

    def GetStats(self) -> dict:
        self._Refill()
        return {
            "capacity": self.Capacity,
            "tokens": round(self.Tokens, 2),
            "refill_per_second": self.RefillRatePerSecond,
        }


class OpenFoodFactsRateLimiter:
    _SearchBucket = TokenBucket(Capacity=10, RefillRatePerSecond=10 / 60)
    _ProductBucket = TokenBucket(Capacity=100, RefillRatePerSecond=100 / 60)

    @classmethod
    async def AcquireSearch(cls, Wait: bool = True) -> bool:
        return await cls._SearchBucket.Acquire(Wait=Wait)

    @classmethod
    async def AcquireProduct(cls, Wait: bool = True) -> bool:
        return await cls._ProductBucket.Acquire(Wait=Wait)

    @classmethod
    def GetAllStats(cls) -> dict:
        return {
            "search": cls._SearchBucket.GetStats(),
            "product": cls._ProductBucket.GetStats(),
        }
