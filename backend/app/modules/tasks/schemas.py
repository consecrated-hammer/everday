from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class TaskRepeatType(str, Enum):
    None_ = "none"
    Daily = "daily"
    Weekly = "weekly"
    Monthly = "monthly"
    Yearly = "yearly"


class TaskView(str, Enum):
    Today = "today"
    Upcoming = "upcoming"
    Completed = "completed"
    Open = "open"
    Starred = "starred"
    Overdue = "overdue"


class TaskListOut(BaseModel):
    Id: int
    Name: str
    IsShared: bool


class TaskTagOut(BaseModel):
    Id: int
    Name: str
    Slug: str


class TaskAssigneeOut(BaseModel):
    UserId: int
    Name: str | None = None


class TaskOut(BaseModel):
    Id: int
    SeriesId: str | None
    Title: str
    Description: str | None
    OwnerUserId: int
    OwnerName: str | None = None
    CreatedByUserId: int
    CreatedByName: str | None = None
    ListId: int | None
    ListName: str | None
    TagNames: list[str]
    Assignees: list[TaskAssigneeOut]
    StartDate: date
    StartTime: str | None
    EndDate: date | None
    EndTime: str | None
    IsAllDay: bool
    TimeZone: str | None
    RepeatType: TaskRepeatType
    RepeatInterval: int
    RepeatWeekdays: list[int]
    RepeatMonthday: int | None
    RepeatUntilDate: date | None
    ReminderAt: datetime | None
    ReminderOffsetMinutes: int | None
    SnoozedUntil: datetime | None
    IsStarred: bool
    IsCompleted: bool
    CompletedAt: datetime | None
    CompletedByUserId: int | None
    RelatedModule: str | None
    RelatedRecordId: str | None
    CreatedAt: datetime
    UpdatedAt: datetime


class TaskListResponse(BaseModel):
    Tasks: list[TaskOut]


class TaskTagListResponse(BaseModel):
    Tags: list[TaskTagOut]


class TaskListListResponse(BaseModel):
    Lists: list[TaskListOut]


class TaskCreate(BaseModel):
    Title: str = Field(min_length=1, max_length=200)
    Description: str | None = None
    ListName: str | None = None
    TagNames: list[str] = Field(default_factory=list)
    AssigneeUserIds: list[int] = Field(default_factory=list)
    StartDate: date
    StartTime: str | None = None
    EndDate: date | None = None
    EndTime: str | None = None
    IsAllDay: bool = False
    TimeZone: str | None = None
    RepeatType: TaskRepeatType = TaskRepeatType.None_
    RepeatInterval: int = 1
    RepeatWeekdays: list[int] = Field(default_factory=list)
    RepeatMonthday: int | None = None
    RepeatUntilDate: date | None = None
    ReminderAt: datetime | None = None
    ReminderOffsetMinutes: int | None = None
    IsStarred: bool = False
    RelatedModule: str | None = None
    RelatedRecordId: str | None = None


class TaskUpdate(BaseModel):
    Title: str | None = Field(default=None, min_length=1, max_length=200)
    Description: str | None = None
    ListName: str | None = None
    TagNames: list[str] | None = None
    AssigneeUserIds: list[int] | None = None
    StartDate: date | None = None
    StartTime: str | None = None
    EndDate: date | None = None
    EndTime: str | None = None
    IsAllDay: bool | None = None
    TimeZone: str | None = None
    RepeatType: TaskRepeatType | None = None
    RepeatInterval: int | None = None
    RepeatWeekdays: list[int] | None = None
    RepeatMonthday: int | None = None
    RepeatUntilDate: date | None = None
    ReminderAt: datetime | None = None
    ReminderOffsetMinutes: int | None = None
    IsStarred: bool | None = None
    IsCompleted: bool | None = None
    RelatedModule: str | None = None
    RelatedRecordId: str | None = None


class TaskCompleteResponse(BaseModel):
    Task: TaskOut
    NextTask: TaskOut | None = None


class TaskSnoozeRequest(BaseModel):
    Minutes: int | None = None
    SnoozeUntil: datetime | None = None


class TaskNotificationRunResponse(BaseModel):
    RemindersSent: int
    OverdueSent: int


class TaskSettingsOut(BaseModel):
    OverdueReminderTime: str | None = None
    OverdueReminderTimeZone: str | None = None
    OverdueLastNotifiedDate: date | None = None


class TaskSettingsUpdate(BaseModel):
    OverdueReminderTime: str | None = None
    OverdueReminderTimeZone: str | None = None


class TaskListCreate(BaseModel):
    Name: str = Field(min_length=1, max_length=120)
    IsShared: bool = False


class TaskListUpdate(BaseModel):
    Name: str = Field(min_length=1, max_length=120)


class TaskListDeleteResponse(BaseModel):
    DeletedId: int
    ReassignedCount: int
    DestinationListId: int | None
    DestinationListName: str | None


class TaskTagCreate(BaseModel):
    Name: str = Field(min_length=1, max_length=80)
