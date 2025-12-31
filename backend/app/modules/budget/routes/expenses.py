import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.budget.models import Expense
from app.modules.budget.schemas import ExpenseCreate, ExpenseOrderUpdate, ExpenseOut, ExpenseUpdate
from app.services.schedules import AnnualizedBreakdown, FinancialYearRange

router = APIRouter()
logger = logging.getLogger("budget.expenses")
FINANCIAL_YEAR_START_MONTH = 1
FINANCIAL_YEAR_START_DAY = 1


def _handle_db_error(exc: Exception) -> None:
    logger.exception("expenses database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Budget storage not initialized. Run alembic upgrade head.",
    ) from exc


def _BuildExpenseOut(expense: Expense) -> ExpenseOut:
    today = date.today()
    fy_start, fy_end = FinancialYearRange(
        today, FINANCIAL_YEAR_START_MONTH, FINANCIAL_YEAR_START_DAY
    )
    breakdown = AnnualizedBreakdown(expense.Amount, expense.Frequency, fy_start, fy_end)
    return ExpenseOut(
        Id=expense.Id,
        OwnerUserId=expense.OwnerUserId,
        Label=expense.Label,
        Amount=expense.Amount,
        Frequency=expense.Frequency,
        Account=expense.Account,
        Type=expense.Type,
        NextDueDate=expense.NextDueDate,
        Cadence=expense.Cadence,
        Interval=expense.Interval,
        Month=expense.Month,
        DayOfMonth=expense.DayOfMonth,
        Enabled=expense.Enabled,
        Notes=expense.Notes,
        DisplayOrder=expense.DisplayOrder,
        CreatedAt=expense.CreatedAt,
        PerDay=breakdown["PerDay"],
        PerWeek=breakdown["PerWeek"],
        PerFortnight=breakdown["PerFortnight"],
        PerMonth=breakdown["PerMonth"],
        PerYear=breakdown["PerYear"],
    )


@router.get("", response_model=list[ExpenseOut])
def ListExpenses(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=False)),
) -> list[ExpenseOut]:
    try:
        expenses = (
            db.query(Expense)
            .order_by(Expense.DisplayOrder.asc(), Expense.CreatedAt.desc())
            .all()
        )
        return [_BuildExpenseOut(expense) for expense in expenses]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def CreateExpense(
    payload: ExpenseCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> ExpenseOut:
    try:
        max_order = db.query(func.max(Expense.DisplayOrder)).scalar() or 0
        expense = Expense(
            OwnerUserId=user.Id,
            Label=payload.Label,
            Amount=payload.Amount,
            Frequency=payload.Frequency,
            Account=payload.Account,
            Type=payload.Type,
            NextDueDate=payload.NextDueDate,
            Cadence=payload.Cadence,
            Interval=payload.Interval,
            Month=payload.Month,
            DayOfMonth=payload.DayOfMonth,
            Enabled=payload.Enabled,
            Notes=payload.Notes,
            DisplayOrder=max_order + 1,
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return _BuildExpenseOut(expense)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/{expense_id}", response_model=ExpenseOut)
def UpdateExpense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> ExpenseOut:
    try:
        expense = db.query(Expense).filter(Expense.Id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

        expense.Label = payload.Label
        expense.Amount = payload.Amount
        expense.Frequency = payload.Frequency
        expense.Account = payload.Account
        expense.Type = payload.Type
        expense.NextDueDate = payload.NextDueDate
        expense.Cadence = payload.Cadence
        expense.Interval = payload.Interval
        expense.Month = payload.Month
        expense.DayOfMonth = payload.DayOfMonth
        expense.Enabled = payload.Enabled
        expense.Notes = payload.Notes
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return _BuildExpenseOut(expense)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/order", status_code=status.HTTP_204_NO_CONTENT)
def UpdateExpenseOrder(
    payload: ExpenseOrderUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> None:
    try:
        if not payload.OrderedIds:
            return
        expenses = db.query(Expense).filter(Expense.Id.in_(payload.OrderedIds)).all()
        if len(expenses) != len(payload.OrderedIds):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid expense order")
        order_map = {expense_id: index + 1 for index, expense_id in enumerate(payload.OrderedIds)}
        for expense in expenses:
            expense.DisplayOrder = order_map[expense.Id]
            db.add(expense)
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteExpense(
    expense_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> None:
    try:
        expense = db.query(Expense).filter(Expense.Id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
        db.delete(expense)
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)
