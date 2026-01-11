import logging

from fastapi import APIRouter

from app.modules.shopping.routes.items import router as items_router

router = APIRouter(prefix="/api/shopping", tags=["shopping"])
logger = logging.getLogger("shopping")


@router.get("/status")
async def shopping_status() -> dict:
    logger.debug("shopping status ok")
    return {"status": "ok", "module": "shopping"}


router.include_router(items_router, prefix="/items", tags=["shopping-items"])
