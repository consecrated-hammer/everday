import logging

from fastapi import APIRouter

from app.modules.budget.routes.income_streams import router as income_streams_router
from app.modules.budget.routes.expenses import router as expenses_router
from app.modules.budget.routes.allocation_accounts import router as allocation_accounts_router
from app.modules.budget.routes.expense_accounts import router as expense_accounts_router
from app.modules.budget.routes.expense_types import router as expense_types_router

router = APIRouter(prefix="/api/budget", tags=["budget"])
logger = logging.getLogger("budget")


@router.get("/status")
async def budget_status() -> dict:
    logger.debug("budget status ok")
    return {"status": "ok", "module": "budget"}


router.include_router(income_streams_router, prefix="/income-streams", tags=["budget-income"])
router.include_router(expenses_router, prefix="/expenses", tags=["budget-expenses"])
router.include_router(allocation_accounts_router, prefix="/allocation-accounts", tags=["budget-allocation-accounts"])
router.include_router(expense_accounts_router, prefix="/expense-accounts", tags=["budget-expense-accounts"])
router.include_router(expense_types_router, prefix="/expense-types", tags=["budget-expense-types"])
