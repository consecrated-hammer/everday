import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.budget.models import IncomeStream
from app.modules.budget.schemas import IncomeStreamCreate, IncomeStreamOut, IncomeStreamUpdate
from app.modules.auth.deps import RequireAuthenticated, RequireModuleRole, UserContext
from app.services.schedules import AnnualizedBreakdown, FinancialYearRange, LastNextOccurrence

router = APIRouter()
logger = logging.getLogger("budget.income")
FINANCIAL_YEAR_START_MONTH = 1
FINANCIAL_YEAR_START_DAY = 1


def _handle_db_error(exc: Exception) -> None:
    logger.exception("income streams database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Budget storage not initialized. Run alembic upgrade head.",
    ) from exc


def _BuildIncomeStreamOut(stream: IncomeStream) -> IncomeStreamOut:
    today = date.today()
    fy_start, fy_end = FinancialYearRange(
        today, FINANCIAL_YEAR_START_MONTH, FINANCIAL_YEAR_START_DAY
    )
    last_pay, next_pay = LastNextOccurrence(
        stream.FirstPayDate,
        stream.Frequency,
        today,
        stream.EndDate,
    )
    net_breakdown = AnnualizedBreakdown(stream.NetAmount, stream.Frequency, fy_start, fy_end)
    gross_breakdown = AnnualizedBreakdown(stream.GrossAmount, stream.Frequency, fy_start, fy_end)
    return IncomeStreamOut(
        Id=stream.Id,
        OwnerUserId=stream.OwnerUserId,
        Label=stream.Label,
        NetAmount=stream.NetAmount,
        GrossAmount=stream.GrossAmount,
        FirstPayDate=stream.FirstPayDate,
        Frequency=stream.Frequency,
        EndDate=stream.EndDate,
        Notes=stream.Notes,
        CreatedAt=stream.CreatedAt,
        LastPayDate=last_pay,
        NextPayDate=next_pay,
        NetPerDay=net_breakdown["PerDay"],
        NetPerWeek=net_breakdown["PerWeek"],
        NetPerFortnight=net_breakdown["PerFortnight"],
        NetPerMonth=net_breakdown["PerMonth"],
        NetPerYear=net_breakdown["PerYear"],
        GrossPerDay=gross_breakdown["PerDay"],
        GrossPerWeek=gross_breakdown["PerWeek"],
        GrossPerFortnight=gross_breakdown["PerFortnight"],
        GrossPerMonth=gross_breakdown["PerMonth"],
        GrossPerYear=gross_breakdown["PerYear"],
    )


@router.get("", response_model=list[IncomeStreamOut])
def ListIncomeStreams(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=False)),
) -> list[IncomeStreamOut]:
    try:
        streams = db.query(IncomeStream).order_by(IncomeStream.CreatedAt.desc()).all()
        return [_BuildIncomeStreamOut(stream) for stream in streams]
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=IncomeStreamOut, status_code=status.HTTP_201_CREATED)
def CreateIncomeStream(
    payload: IncomeStreamCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> IncomeStreamOut:
    stream = IncomeStream(
        OwnerUserId=user.Id,
        Label=payload.Label,
        NetAmount=payload.NetAmount,
        GrossAmount=payload.GrossAmount,
        FirstPayDate=payload.FirstPayDate,
        Frequency=payload.Frequency,
        EndDate=payload.EndDate,
        Notes=payload.Notes,
    )
    try:
        db.add(stream)
        db.commit()
        db.refresh(stream)
        return _BuildIncomeStreamOut(stream)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/{stream_id}", response_model=IncomeStreamOut)
def UpdateIncomeStream(
    stream_id: int,
    payload: IncomeStreamUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> IncomeStreamOut:
    try:
        stream = db.query(IncomeStream).filter(IncomeStream.Id == stream_id).first()
        if not stream:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Income stream not found")

        stream.Label = payload.Label
        stream.NetAmount = payload.NetAmount
        stream.GrossAmount = payload.GrossAmount
        stream.FirstPayDate = payload.FirstPayDate
        stream.Frequency = payload.Frequency
        stream.EndDate = payload.EndDate
        stream.Notes = payload.Notes
        db.add(stream)
        db.commit()
        db.refresh(stream)
        return _BuildIncomeStreamOut(stream)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteIncomeStream(
    stream_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("budget", write=True)),
) -> None:
    try:
        stream = db.query(IncomeStream).filter(IncomeStream.Id == stream_id).first()
        if not stream:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Income stream not found")

        db.delete(stream)
        db.commit()
    except ProgrammingError as exc:
        _handle_db_error(exc)
