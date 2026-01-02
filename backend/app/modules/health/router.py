import logging

from fastapi import APIRouter

from app.modules.health.routes.foods import router as foods_router
from app.modules.health.routes.daily_logs import router as daily_logs_router
from app.modules.health.routes.meal_templates import router as meal_templates_router
from app.modules.health.routes.settings import router as settings_router
from app.modules.health.routes.schedule import router as schedule_router
from app.modules.health.routes.summary import router as summary_router
from app.modules.health.routes.suggestions import router as suggestions_router
from app.modules.health.routes.food_lookup import router as food_lookup_router
from app.modules.health.routes.portion_options import router as portion_options_router

router = APIRouter(prefix="/api/health", tags=["health"])
logger = logging.getLogger("health")


@router.get("/status")
async def health_status() -> dict:
    logger.debug("health module status ok")
    return {"status": "ok", "module": "health"}


router.include_router(foods_router, prefix="/foods", tags=["health-foods"])
router.include_router(daily_logs_router, prefix="/daily-logs", tags=["health-logs"])
router.include_router(meal_templates_router, prefix="/meal-templates", tags=["health-templates"])
router.include_router(settings_router, prefix="/settings", tags=["health-settings"])
router.include_router(schedule_router, prefix="/schedule", tags=["health-schedule"])
router.include_router(summary_router, prefix="/summary", tags=["health-summary"])
router.include_router(suggestions_router, prefix="/suggestions", tags=["health-suggestions"])
router.include_router(food_lookup_router, prefix="/food-lookup", tags=["health-lookup"])
router.include_router(portion_options_router, prefix="/portion-options", tags=["health-portions"])
