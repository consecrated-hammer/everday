import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.budget.models import Expense, ExpenseType
from app.modules.budget.schemas import ExpenseTypeCreate, ExpenseTypeOut, ExpenseTypeUpdate

router = APIRouter()
logger = logging.getLogger("budget.expense-types")


def _handle_db_error(exc: Exception) -> None:
    logger.exception("expense types database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Budget storage not initialized. Run alembic upgrade head.",
    ) from exc


@router.get("", response_model=list[ExpenseTypeOut])
def ListExpenseTypes(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=False)),
) -> list[ExpenseTypeOut]:
    try:
        entries = db.query(ExpenseType).order_by(ExpenseType.Name.asc()).all()
        return [
            ExpenseTypeOut(
                Id=entry.Id,
                OwnerUserId=entry.OwnerUserId,
                Name=entry.Name,
                Enabled=entry.Enabled,
                CreatedAt=entry.CreatedAt,
            )
            for entry in entries
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=ExpenseTypeOut, status_code=status.HTTP_201_CREATED)
def CreateExpenseType(
    payload: ExpenseTypeCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> ExpenseTypeOut:
    try:
        entry = ExpenseType(
            OwnerUserId=user.Id,
            Name=payload.Name,
            Enabled=payload.Enabled,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return ExpenseTypeOut(
            Id=entry.Id,
            OwnerUserId=entry.OwnerUserId,
            Name=entry.Name,
            Enabled=entry.Enabled,
            CreatedAt=entry.CreatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/{type_id}", response_model=ExpenseTypeOut)
def UpdateExpenseType(
    type_id: int,
    payload: ExpenseTypeUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> ExpenseTypeOut:
    try:
        entry = db.query(ExpenseType).filter(ExpenseType.Id == type_id).first()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type not found")

        old_name = entry.Name
        entry.Name = payload.Name
        entry.Enabled = payload.Enabled
        if old_name != payload.Name:
            db.query(Expense).filter(Expense.Type == old_name).update({Expense.Type: payload.Name})
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return ExpenseTypeOut(
            Id=entry.Id,
            OwnerUserId=entry.OwnerUserId,
            Name=entry.Name,
            Enabled=entry.Enabled,
            CreatedAt=entry.CreatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteExpenseType(
    type_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> None:
    try:
        entry = db.query(ExpenseType).filter(ExpenseType.Id == type_id).first()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type not found")
        in_use = db.query(Expense).filter(Expense.Type == entry.Name).first()
        if in_use:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type is used by an expense",
            )
        db.delete(entry)
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)
