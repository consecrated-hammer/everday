from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class IncomeStreamBase(BaseModel):
    Label: str = Field(..., max_length=200)
    NetAmount: Decimal
    GrossAmount: Decimal
    FirstPayDate: date
    Frequency: str = Field(..., max_length=50)
    EndDate: date | None = None
    Notes: str | None = None


class IncomeStreamCreate(IncomeStreamBase):
    pass


class IncomeStreamUpdate(IncomeStreamBase):
    pass


class IncomeStreamOut(IncomeStreamBase):
    Id: int
    OwnerUserId: int
    CreatedAt: datetime
    LastPayDate: date | None = None
    NextPayDate: date | None = None
    NetPerDay: Decimal | None = None
    NetPerWeek: Decimal | None = None
    NetPerFortnight: Decimal | None = None
    NetPerMonth: Decimal | None = None
    NetPerYear: Decimal | None = None
    GrossPerDay: Decimal | None = None
    GrossPerWeek: Decimal | None = None
    GrossPerFortnight: Decimal | None = None
    GrossPerMonth: Decimal | None = None
    GrossPerYear: Decimal | None = None


class ExpenseBase(BaseModel):
    Label: str = Field(min_length=1, max_length=200)
    Amount: Decimal
    Frequency: str = Field(..., max_length=50)
    Account: str | None = None
    Type: str | None = None
    NextDueDate: date | None = None
    Cadence: str | None = None
    Interval: int | None = None
    Month: int | None = None
    DayOfMonth: int | None = None
    Enabled: bool = True
    Notes: str | None = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    pass


class ExpenseOut(ExpenseBase):
    Id: int
    OwnerUserId: int
    CreatedAt: datetime
    DisplayOrder: int
    PerDay: Decimal
    PerWeek: Decimal
    PerFortnight: Decimal
    PerMonth: Decimal
    PerYear: Decimal


class ExpenseAccountBase(BaseModel):
    Name: str = Field(min_length=1, max_length=200)
    Enabled: bool = True


class ExpenseAccountCreate(ExpenseAccountBase):
    pass


class ExpenseAccountUpdate(ExpenseAccountBase):
    pass


class ExpenseAccountOut(ExpenseAccountBase):
    Id: int
    OwnerUserId: int
    CreatedAt: datetime


class ExpenseTypeBase(BaseModel):
    Name: str = Field(min_length=1, max_length=200)
    Enabled: bool = True


class ExpenseTypeCreate(ExpenseTypeBase):
    pass


class ExpenseTypeUpdate(ExpenseTypeBase):
    pass


class ExpenseTypeOut(ExpenseTypeBase):
    Id: int
    OwnerUserId: int
    CreatedAt: datetime


class AllocationAccountBase(BaseModel):
    Name: str = Field(min_length=1, max_length=200)
    Percent: Decimal = Field(default=0, ge=0)
    Enabled: bool = True


class AllocationAccountCreate(AllocationAccountBase):
    pass


class AllocationAccountUpdate(AllocationAccountBase):
    pass


class AllocationAccountOut(AllocationAccountBase):
    Id: int
    OwnerUserId: int
    CreatedAt: datetime


class ExpenseOrderUpdate(BaseModel):
    OrderedIds: list[int]
