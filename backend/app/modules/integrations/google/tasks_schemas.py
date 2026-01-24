from datetime import datetime

from pydantic import BaseModel, Field


class GoogleTaskListOut(BaseModel):
    Key: str
    Name: str
    ListId: str | None = None
    Type: str
    Count: int | None = None


class GoogleTaskListsResponse(BaseModel):
    Lists: list[GoogleTaskListOut]


class GoogleTaskOut(BaseModel):
    Id: str
    Title: str
    Notes: str | None = None
    DueDate: str | None = None
    IsCompleted: bool = False
    ListKey: str
    ListId: str
    UpdatedAt: datetime | None = None
    AssignedToUserId: int | None = None
    AssignedToName: str | None = None


class GoogleTaskListResponse(BaseModel):
    Tasks: list[GoogleTaskOut]


class GoogleTaskCreate(BaseModel):
    Title: str = Field(..., min_length=1, max_length=1024)
    Notes: str | None = None
    DueDate: str | None = None
    ListKey: str = Field(..., min_length=1, max_length=40)
    AssignedToUserId: int | None = None


class GoogleTaskUpdate(BaseModel):
    Title: str | None = Field(default=None, min_length=1, max_length=1024)
    Notes: str | None = None
    DueDate: str | None = None
    IsCompleted: bool | None = None
    ListKey: str = Field(..., min_length=1, max_length=40)


class GoogleTaskDeleteResponse(BaseModel):
    Status: str = "ok"


class GoogleTaskOverdueRunResponse(BaseModel):
    UsersProcessed: int
    NotificationsSent: int
    OverdueTasks: int
