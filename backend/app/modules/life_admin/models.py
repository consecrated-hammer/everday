from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint

from app.db import Base


class LifeCategory(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("Slug", name="uq_life_admin_categories_slug"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    Name = Column(String(120), nullable=False)
    Slug = Column(String(140), nullable=False, index=True)
    Description = Column(String(400))
    SortOrder = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LifeField(Base):
    __tablename__ = "fields"
    __table_args__ = (
        UniqueConstraint("CategoryId", "Key", name="uq_life_admin_fields_category_key"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    CategoryId = Column(Integer, nullable=False, index=True)
    Name = Column(String(120), nullable=False)
    Key = Column(String(120), nullable=False)
    FieldType = Column(String(30), nullable=False)
    IsRequired = Column(Boolean, nullable=False, default=False)
    IsMulti = Column(Boolean, nullable=False, default=False)
    SortOrder = Column(Integer, nullable=False, default=0)
    DropdownId = Column(Integer)
    LinkedCategoryId = Column(Integer)
    ConfigJson = Column(Text)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LifeDropdown(Base):
    __tablename__ = "dropdowns"
    __table_args__ = (
        UniqueConstraint("Name", name="uq_life_admin_dropdowns_name"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    Name = Column(String(120), nullable=False)
    Description = Column(String(400))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LifeDropdownOption(Base):
    __tablename__ = "dropdown_options"
    __table_args__ = (
        UniqueConstraint("DropdownId", "Label", name="uq_life_admin_dropdown_options_label"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    DropdownId = Column(Integer, nullable=False, index=True)
    Label = Column(String(160), nullable=False)
    Value = Column(String(160))
    SortOrder = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LifePerson(Base):
    __tablename__ = "people"
    __table_args__ = {"schema": "life_admin"}

    Id = Column(Integer, primary_key=True, index=True)
    Name = Column(String(160), nullable=False)
    UserId = Column(Integer, index=True)
    Notes = Column(String(400))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LifeRecord(Base):
    __tablename__ = "records"
    __table_args__ = {"schema": "life_admin"}

    Id = Column(Integer, primary_key=True, index=True)
    CategoryId = Column(Integer, nullable=False, index=True)
    Title = Column(String(200))
    DataJson = Column(Text, nullable=False)
    SortOrder = Column(Integer, nullable=False, default=0)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    UpdatedByUserId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
