from datetime import datetime

from pydantic import BaseModel, Field


class ShoppingItemBase(BaseModel):
    HouseholdId: int
    Item: str = Field(min_length=1, max_length=200)


class ShoppingItemCreate(ShoppingItemBase):
    pass


class ShoppingItemUpdate(BaseModel):
    Item: str = Field(min_length=1, max_length=200)


class ShoppingItemOut(ShoppingItemBase):
    Id: int
    OwnerUserId: int
    AddedByType: str
    AddedByName: str | None = None
    IsActive: bool
    SortOrder: int
    CreatedAt: datetime
    UpdatedAt: datetime
