from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String

from app.db import Base


class ShoppingItem(Base):
    __tablename__ = "shopping_items"
    __table_args__ = (
        Index(
            "ix_shopping_items_household_active_sort",
            "HouseholdId",
            "IsActive",
            "SortOrder",
        ),
        {"schema": "shopping"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    HouseholdId = Column(Integer, nullable=False, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    AddedByType = Column(String(20), nullable=False, default="User")
    Item = Column(String(200), nullable=False)
    IsActive = Column(Boolean, nullable=False, default=True)
    SortOrder = Column(Integer, nullable=False, default=0)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
