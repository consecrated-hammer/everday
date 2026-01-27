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


class RecordOrderUpdate(BaseModel):
    OrderedIds: list[int] = Field(default_factory=list)
