import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.budget.models import Expense, ExpenseAccount
from app.modules.budget.schemas import ExpenseAccountCreate, ExpenseAccountOut, ExpenseAccountUpdate

router = APIRouter()
logger = logging.getLogger("budget.expense-accounts")


def _handle_db_error(exc: Exception) -> None:
    logger.exception("expense accounts database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Budget storage not initialized. Run alembic upgrade head.",
    ) from exc


@router.get("", response_model=list[ExpenseAccountOut])
def ListExpenseAccounts(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=False)),
) -> list[ExpenseAccountOut]:
    try:
        accounts = db.query(ExpenseAccount).order_by(ExpenseAccount.Name.asc()).all()
        return [
            ExpenseAccountOut(
                Id=account.Id,
                OwnerUserId=account.OwnerUserId,
                Name=account.Name,
                Enabled=account.Enabled,
                CreatedAt=account.CreatedAt,
            )
            for account in accounts
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=ExpenseAccountOut, status_code=status.HTTP_201_CREATED)
def CreateExpenseAccount(
    payload: ExpenseAccountCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> ExpenseAccountOut:
    try:
        account = ExpenseAccount(
            OwnerUserId=user.Id,
            Name=payload.Name,
            Enabled=payload.Enabled,
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return ExpenseAccountOut(
            Id=account.Id,
            OwnerUserId=account.OwnerUserId,
            Name=account.Name,
            Enabled=account.Enabled,
            CreatedAt=account.CreatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/{account_id}", response_model=ExpenseAccountOut)
def UpdateExpenseAccount(
    account_id: int,
    payload: ExpenseAccountUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> ExpenseAccountOut:
    try:
        account = db.query(ExpenseAccount).filter(ExpenseAccount.Id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        old_name = account.Name
        account.Name = payload.Name
        account.Enabled = payload.Enabled
        if old_name != payload.Name:
            db.query(Expense).filter(Expense.Account == old_name).update(
                {Expense.Account: payload.Name}
            )
        db.add(account)
        db.commit()
        db.refresh(account)
        return ExpenseAccountOut(
            Id=account.Id,
            OwnerUserId=account.OwnerUserId,
            Name=account.Name,
            Enabled=account.Enabled,
            CreatedAt=account.CreatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteExpenseAccount(
    account_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> None:
    try:
        account = db.query(ExpenseAccount).filter(ExpenseAccount.Id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        in_use = db.query(Expense).filter(Expense.Account == account.Name).first()
        if in_use:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is used by an expense",
            )
        db.delete(account)
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)
