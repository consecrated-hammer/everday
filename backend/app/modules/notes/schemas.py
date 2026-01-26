from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# NoteItem schemas
class NoteItemBase(BaseModel):
    Text: str = Field(..., max_length=1000)
    Checked: bool = False
    OrderIndex: int


class NoteItemCreate(NoteItemBase):
    pass


class NoteItemUpdate(NoteItemBase):
    Id: Optional[int] = None  # For updates to existing items


class NoteItemResponse(NoteItemBase):
    Id: int
    CreatedAt: datetime
    UpdatedAt: datetime

    class Config:
        from_attributes = True


# Note schemas
class NoteBase(BaseModel):
    Title: str = Field(..., max_length=500)
    Content: Optional[str] = None
    Labels: List[str] = Field(default_factory=list)
    IsPinned: bool = False


class NoteCreate(NoteBase):
    Items: List[NoteItemCreate] = Field(default_factory=list)
    SharedUserIds: List[int] = Field(default_factory=list)


class NoteUpdate(NoteBase):
    Items: List[NoteItemUpdate] = Field(default_factory=list)
    SharedUserIds: Optional[List[int]] = None


class NoteResponse(NoteBase):
    Id: int
    UserId: int
    Items: List[NoteItemResponse] = Field(default_factory=list)
    Tags: List[int] = Field(default_factory=list)  # List of tagged user IDs
    TaskIds: List[int] = Field(default_factory=list)  # List of linked task IDs
    Associations: List[dict] = Field(default_factory=list)  # List of {Id, ModuleName, RecordId}
    ArchivedAt: Optional[datetime] = None
    CreatedAt: datetime
    UpdatedAt: datetime

    class Config:
        from_attributes = True


# Tag schemas
class NoteTagCreate(BaseModel):
    UserId: int


# Task link schemas
class NoteTaskLinkCreate(BaseModel):
    TaskId: int


# Association schemas
class NoteAssociationCreate(BaseModel):
    ModuleName: str = Field(..., max_length=100)
    RecordId: int


class NoteAssociationResponse(BaseModel):
    Id: int
    ModuleName: str
    RecordId: int
    CreatedAt: datetime

    class Config:
        from_attributes = True


# Reorder items schema
class NoteItemsReorder(BaseModel):
    ItemOrders: List[dict] = Field(..., description="List of {Id: int, OrderIndex: int}")
