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
    Type: str
    Amount: float
    IsActive: bool
    SortOrder: int
    StartDate: date | None = None
    EndDate: date | None = None
    AssignedKidIds: list[int] | None = None


class ChoreCreate(BaseModel):
    Label: str = Field(min_length=1, max_length=200)
    Type: str = Field(min_length=1, max_length=20)
    Amount: float = Field(ge=0)
    IsActive: bool = True
    SortOrder: int = 0
    StartDate: date | None = None
    EndDate: date | None = None


class ChoreUpdate(BaseModel):
    Label: str | None = Field(default=None, min_length=1, max_length=200)
    Type: str | None = Field(default=None, min_length=1, max_length=20)
    Amount: float | None = Field(default=None, ge=0)
    IsActive: bool | None = None
    SortOrder: int | None = None
    StartDate: date | None = None
    EndDate: date | None = None


class ChoreAssignmentRequest(BaseModel):
    KidUserIds: list[int]


class ChoreEntryOut(BaseModel):
    Id: int
    KidUserId: int
    ChoreId: int
    ChoreLabel: str
    ChoreType: str | None = None
    Status: str
    Amount: float
    EntryDate: date
    Notes: str | None = None
    IsDeleted: bool
    CreatedByUserId: int
    UpdatedByUserId: int | None = None
    ReviewedByUserId: int | None = None
    ReviewedAt: datetime | None = None
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


class KidsProjectionPoint(BaseModel):
    Date: date
    Amount: float


class KidsOverviewResponse(BaseModel):
    Today: date
    SelectedDate: date
    AllowedStartDate: date
    AllowedEndDate: date
    MonthStart: date
    MonthEnd: date
    MonthlyAllowance: float
    DailySlice: float
    DayProtected: bool
    Chores: list[ChoreOut]
    Entries: list[ChoreEntryOut]
    Projection: list[KidsProjectionPoint]


class KidsMonthSummaryResponse(BaseModel):
    MonthStart: date
    MonthEnd: date
    MonthlyAllowance: float
    DailySlice: float
    MissedDays: int
    MissedDeduction: float
    ApprovedBonusTotal: float
    PendingBonusTotal: float
    ProjectedPayout: float


class KidsApprovalOut(BaseModel):
    Id: int
    KidUserId: int
    KidName: str
    ChoreId: int
    ChoreLabel: str
    ChoreType: str | None = None
    EntryDate: date
    Amount: float
    Notes: str | None = None
    Status: str
    CreatedAt: datetime


class ParentChoreEntryCreate(BaseModel):
    ChoreId: int
    EntryDate: date
    Notes: str | None = Field(default=None, max_length=500)
    Amount: float | None = Field(default=None, ge=0)


class ParentChoreEntryUpdate(BaseModel):
    EntryDate: date | None = None
    Notes: str | None = Field(default=None, max_length=500)
    Amount: float | None = Field(default=None, ge=0)
    Status: str | None = Field(default=None, min_length=1, max_length=20)


class KidsMonthDayOut(BaseModel):
    Date: date
    DailyDone: int
    DailyTotal: int
    BonusApprovedTotal: float
    PendingCount: int


class KidsMonthOverviewResponse(BaseModel):
    MonthStart: date
    MonthEnd: date
    Days: list[KidsMonthDayOut]


class KidsDayDetailResponse(BaseModel):
    Date: date
    DailyJobs: list[ChoreOut]
    Habits: list[ChoreOut]
    BonusTasks: list[ChoreOut]
    Entries: list[ChoreEntryOut]


class KidsReminderSettingsOut(BaseModel):
    DailyJobsRemindersEnabled: bool = True
    DailyJobsReminderTime: str = "19:00"
    HabitsRemindersEnabled: bool = True
    HabitsReminderTime: str = "19:00"
    ReminderTimeZone: str = "Australia/Adelaide"


class KidsReminderSettingsUpdate(BaseModel):
    DailyJobsRemindersEnabled: bool | None = None
    DailyJobsReminderTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    HabitsRemindersEnabled: bool | None = None
    HabitsReminderTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class KidsReminderRunRequest(BaseModel):
    RunDate: date | None = None
    RunTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class KidsReminderRunResponse(BaseModel):
    EligibleKids: int
    ProcessedKids: int
    NotificationsSent: int
    Skipped: int
    Errors: int
