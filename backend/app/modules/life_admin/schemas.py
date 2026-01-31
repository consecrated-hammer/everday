from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    Name: str = Field(..., max_length=120)
    Description: str | None = Field(default=None, max_length=400)
    SortOrder: int = 0
    IsActive: bool = True


class CategoryUpdate(BaseModel):
    Name: str = Field(..., max_length=120)
    Description: str | None = Field(default=None, max_length=400)
    SortOrder: int = 0
    IsActive: bool = True


class CategoryOut(BaseModel):
    Id: int
    Name: str
    Slug: str
    Description: str | None = None
    SortOrder: int
    IsActive: bool
    CreatedAt: datetime
    UpdatedAt: datetime


class FieldCreate(BaseModel):
    Name: str = Field(..., max_length=120)
    Key: str | None = Field(default=None, max_length=120)
    FieldType: str = Field(..., max_length=30)
    IsRequired: bool = False
    IsMulti: bool = False
    SortOrder: int = 0
    DropdownId: int | None = None
    LinkedCategoryId: int | None = None
    Config: dict[str, Any] | None = None


class FieldUpdate(BaseModel):
    Name: str = Field(..., max_length=120)
    Key: str | None = Field(default=None, max_length=120)
    FieldType: str = Field(..., max_length=30)
    IsRequired: bool = False
    IsMulti: bool = False
    SortOrder: int = 0
    DropdownId: int | None = None
    LinkedCategoryId: int | None = None
    Config: dict[str, Any] | None = None


class FieldOut(BaseModel):
    Id: int
    CategoryId: int
    Name: str
    Key: str
    FieldType: str
    IsRequired: bool
    IsMulti: bool
    SortOrder: int
    DropdownId: int | None = None
    LinkedCategoryId: int | None = None
    Config: dict[str, Any] | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class DropdownCreate(BaseModel):
    Name: str = Field(..., max_length=120)
    Description: str | None = Field(default=None, max_length=400)


class DropdownUpdate(BaseModel):
    Name: str = Field(..., max_length=120)
    Description: str | None = Field(default=None, max_length=400)


class DropdownOut(BaseModel):
    Id: int
    Name: str
    Description: str | None = None
    InUseCount: int = 0
    CreatedAt: datetime
    UpdatedAt: datetime


class DropdownOptionCreate(BaseModel):
    Label: str = Field(..., max_length=160)
    Value: str | None = Field(default=None, max_length=160)
    SortOrder: int = 0
    IsActive: bool = True


class DropdownOptionUpdate(BaseModel):
    Label: str = Field(..., max_length=160)
    Value: str | None = Field(default=None, max_length=160)
    SortOrder: int = 0
    IsActive: bool = True


class DropdownOptionOut(BaseModel):
    Id: int
    DropdownId: int
    Label: str
    Value: str | None = None
    SortOrder: int
    IsActive: bool
    CreatedAt: datetime
    UpdatedAt: datetime


class PersonCreate(BaseModel):
    Name: str = Field(..., max_length=160)
    UserId: int | None = None
    Notes: str | None = Field(default=None, max_length=400)


class PersonUpdate(BaseModel):
    Name: str = Field(..., max_length=160)
    UserId: int | None = None
    Notes: str | None = Field(default=None, max_length=400)


class PersonOut(BaseModel):
    Id: int
    Name: str
    UserId: int | None = None
    Notes: str | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class RecordCreate(BaseModel):
    Title: str | None = Field(default=None, max_length=200)
    Data: dict[str, Any]


class RecordUpdate(BaseModel):
    Title: str | None = Field(default=None, max_length=200)
    Data: dict[str, Any]


class RecordOut(BaseModel):
    Id: int
    CategoryId: int
    Title: str | None = None
    Data: dict[str, Any]
    SortOrder: int = 0
    CreatedAt: datetime
    UpdatedAt: datetime


class RecordLookupOut(BaseModel):
    Id: int
    Title: str


class DocumentFolderCreate(BaseModel):
    Name: str = Field(..., max_length=120)
    SortOrder: int = 0


class DocumentFolderUpdate(BaseModel):
    Name: str = Field(..., max_length=120)
    SortOrder: int = 0


class DocumentFolderOut(BaseModel):
    Id: int
    Name: str
    SortOrder: int
    CreatedAt: datetime
    UpdatedAt: datetime


class DocumentTagOut(BaseModel):
    Id: int
    Name: str
    Slug: str
    CreatedAt: datetime
    UpdatedAt: datetime


class DocumentOut(BaseModel):
    Id: int
    Title: str | None = None
    FolderId: int | None = None
    FolderName: str | None = None
    ContentType: str | None = None
    FileSizeBytes: int | None = None
    OriginalFileName: str | None = None
    OcrStatus: str | None = None
    CreatedAt: datetime
    UpdatedAt: datetime
    FileUrl: str | None = None
    Tags: list[DocumentTagOut] = []
    LinkCount: int = 0
    ReminderCount: int = 0


class DocumentUpdate(BaseModel):
    Title: str | None = Field(default=None, max_length=200)
    FolderId: int | None = None


class DocumentTagUpdate(BaseModel):
    TagNames: list[str]


class DocumentBulkUpdate(BaseModel):
    DocumentIds: list[int]
    FolderId: int | None = None
    TagNames: list[str] | None = None


class DocumentLinkCreate(BaseModel):
    LinkedEntityType: str = Field(..., max_length=40)
    LinkedEntityId: int


class DocumentLinkOut(BaseModel):
    Id: int
    DocumentId: int
    LinkedEntityType: str
    LinkedEntityId: int
    CreatedByUserId: int
    CreatedAt: datetime


class ReminderCreate(BaseModel):
    SourceType: str = Field(..., max_length=40)
    SourceId: int
    Title: str = Field(..., max_length=200)
    DueAt: datetime
    RepeatRule: str | None = Field(default=None, max_length=120)
    AssigneeUserId: int | None = None


class ReminderUpdate(BaseModel):
    Status: str = Field(..., max_length=20)


class ReminderOut(BaseModel):
    Id: int
    SourceType: str
    SourceId: int
    Title: str
    DueAt: datetime
    RepeatRule: str | None = None
    Status: str
    AssigneeUserId: int | None = None
    CompletedAt: datetime | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class DocumentAuditOut(BaseModel):
    Id: int
    DocumentId: int
    Action: str
    ActorUserId: int
    Summary: str | None = None
    BeforeJson: dict | None = None
    AfterJson: dict | None = None
    CreatedAt: datetime


class DocumentAiSuggestionOut(BaseModel):
    Id: int
    DocumentId: int
    Status: str
    SuggestedFolderName: str | None = None
    SuggestedTags: list[str] = []
    SuggestedLinks: list[dict] = []
    SuggestedReminder: dict | None = None
    Confidence: str | None = None
    CreatedAt: datetime
    UpdatedAt: datetime


class DocumentDetailOut(DocumentOut):
    StoragePath: str | None = None
    OcrText: str | None = None
    SourceType: str | None = None
    SourceDetail: str | None = None
    Links: list[DocumentLinkOut] = []
    Reminders: list[ReminderOut] = []
    Audits: list[DocumentAuditOut] = []
    AiSuggestion: DocumentAiSuggestionOut | None = None


class RecordOrderUpdate(BaseModel):
    OrderedIds: list[int] = Field(default_factory=list)
