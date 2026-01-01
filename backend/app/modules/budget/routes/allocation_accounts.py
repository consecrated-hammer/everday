import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.budget.models import AllocationAccount
from app.modules.budget.schemas import (
    AllocationAccountCreate,
    AllocationAccountOut,
    AllocationAccountUpdate,
)

router = APIRouter()
logger = logging.getLogger("budget.allocation-accounts")


def _handle_db_error(exc: Exception) -> None:
    logger.exception("allocation accounts database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Budget storage not initialized. Run alembic upgrade head.",
    ) from exc


@router.get("", response_model=list[AllocationAccountOut])
def ListAllocationAccounts(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=False)),
) -> list[AllocationAccountOut]:
    try:
        accounts = db.query(AllocationAccount).order_by(AllocationAccount.Name.asc()).all()
        return [
            AllocationAccountOut(
                Id=account.Id,
                OwnerUserId=account.OwnerUserId,
                Name=account.Name,
                Percent=account.Percent,
                Enabled=account.Enabled,
                CreatedAt=account.CreatedAt,
            )
            for account in accounts
        ]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=AllocationAccountOut, status_code=status.HTTP_201_CREATED)
def CreateAllocationAccount(
    payload: AllocationAccountCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> AllocationAccountOut:
    try:
        account = AllocationAccount(
            OwnerUserId=user.Id,
            Name=payload.Name,
            Percent=payload.Percent,
            Enabled=payload.Enabled,
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return AllocationAccountOut(
            Id=account.Id,
            OwnerUserId=account.OwnerUserId,
            Name=account.Name,
            Percent=account.Percent,
            Enabled=account.Enabled,
            CreatedAt=account.CreatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/{account_id}", response_model=AllocationAccountOut)
def UpdateAllocationAccount(
    account_id: int,
    payload: AllocationAccountUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> AllocationAccountOut:
    try:
        account = db.query(AllocationAccount).filter(AllocationAccount.Id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        account.Name = payload.Name
        account.Percent = payload.Percent
        account.Enabled = payload.Enabled
        db.add(account)
        db.commit()
        db.refresh(account)
        return AllocationAccountOut(
            Id=account.Id,
            OwnerUserId=account.OwnerUserId,
            Name=account.Name,
            Percent=account.Percent,
            Enabled=account.Enabled,
            CreatedAt=account.CreatedAt,
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteAllocationAccount(
    account_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> None:
    try:
        account = db.query(AllocationAccount).filter(AllocationAccount.Id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        db.delete(account)
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)
