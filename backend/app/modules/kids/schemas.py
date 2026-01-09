from datetime import date, datetime

from pydantic import BaseModel, Field


class KidSummaryOut(BaseModel):
    KidUserId: int
    DisplayName: str
    Balance: float


class KidLinkOut(BaseModel):
    KidUserId: int
    Username: str
    FirstName: str | None = None
    LastName: str | None = None


class KidLinkCreate(BaseModel):
    KidUserId: int


class ChoreOut(BaseModel):
    Id: int
    Label: str
    Amount: float
    IsActive: bool
    AssignedKidIds: list[int] | None = None


class ChoreCreate(BaseModel):
    Label: str = Field(min_length=1, max_length=200)
    Amount: float = Field(gt=0)
    IsActive: bool = True


class ChoreUpdate(BaseModel):
    Label: str | None = Field(default=None, min_length=1, max_length=200)
    Amount: float | None = Field(default=None, gt=0)
    IsActive: bool | None = None


class ChoreAssignmentRequest(BaseModel):
    KidUserIds: list[int]


class ChoreEntryOut(BaseModel):
    Id: int
    KidUserId: int
    ChoreId: int
    ChoreLabel: str
    Amount: float
    EntryDate: date
    Notes: str | None = None
    IsDeleted: bool
    CreatedByUserId: int
    UpdatedByUserId: int | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class ChoreEntryCreate(BaseModel):
    ChoreId: int
    EntryDate: date
    Notes: str | None = Field(default=None, max_length=500)


class ChoreEntryUpdate(BaseModel):
    ChoreId: int | None = None
    EntryDate: date | None = None
    Notes: str | None = Field(default=None, max_length=500)


class ChoreEntryAuditOut(BaseModel):
    Id: int
    ChoreEntryId: int
    Action: str
    ActorUserId: int
    Summary: str | None = None
    CreatedAt: datetime
    BeforeJson: str | None = None
    AfterJson: str | None = None


class LedgerEntryOut(BaseModel):
    Id: int
    KidUserId: int
    EntryType: str
    Amount: float
    EntryDate: date
    Narrative: str | None = None
    Notes: str | None = None
    CreatedByUserId: int
    CreatedByName: str | None = None
    IsDeleted: bool
    CreatedAt: datetime
    UpdatedAt: datetime


class LedgerEntryCreate(BaseModel):
    Amount: float
    EntryDate: date
    Narrative: str = Field(min_length=1, max_length=200)
    Notes: str | None = Field(default=None, max_length=500)


class PocketMoneyRuleOut(BaseModel):
    Id: int
    KidUserId: int
    Amount: float
    Frequency: str
    DayOfWeek: int | None = None
    DayOfMonth: int | None = None
    StartDate: date
    LastPostedOn: date | None = None
    IsActive: bool
    CreatedByUserId: int
    CreatedAt: datetime
    UpdatedAt: datetime


class PocketMoneyRuleUpsert(BaseModel):
    Amount: float = Field(gt=0)
    Frequency: str = Field(min_length=1, max_length=30)
    DayOfWeek: int | None = Field(default=None, ge=0, le=6)
    DayOfMonth: int | None = Field(default=None, ge=1, le=31)
    StartDate: date
    IsActive: bool = True


class KidsSummaryResponse(BaseModel):
    Balance: float
    RecentLedger: list[LedgerEntryOut]
    AssignedChores: list[ChoreOut]


class KidsLedgerResponse(BaseModel):
    Balance: float
    Entries: list[LedgerEntryOut]
