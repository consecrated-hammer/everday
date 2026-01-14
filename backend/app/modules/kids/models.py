from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)

from app.db import Base


class KidLink(Base):
    __tablename__ = "kid_links"
    __table_args__ = (
        UniqueConstraint("ParentUserId", "KidUserId", name="uq_kids_links_parent_kid"),
        {"schema": "kids"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    ParentUserId = Column(Integer, nullable=False, index=True)
    KidUserId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Chore(Base):
    __tablename__ = "chores"
    __table_args__ = ({"schema": "kids"},)

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Label = Column(String(200), nullable=False)
    Type = Column(String(20), nullable=False, default="Bonus")
    Amount = Column(Numeric(12, 2), nullable=False)
    IsActive = Column(Boolean, nullable=False, default=True)
    SortOrder = Column(Integer, nullable=False, default=0)
    StartsOn = Column(Date, nullable=False)
    DisabledOn = Column(Date)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class ChoreAssignment(Base):
    __tablename__ = "chore_assignments"
    __table_args__ = (
        UniqueConstraint("ChoreId", "KidUserId", name="uq_kids_chore_assignments"),
        {"schema": "kids"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    ChoreId = Column(Integer, nullable=False, index=True)
    KidUserId = Column(Integer, nullable=False, index=True)
    IsEnabled = Column(Boolean, nullable=False, default=True)
    StartsOn = Column(Date, nullable=False)
    DisabledOn = Column(Date)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class ChoreEntry(Base):
    __tablename__ = "chore_entries"
    __table_args__ = ({"schema": "kids"},)

    Id = Column(Integer, primary_key=True, index=True)
    KidUserId = Column(Integer, nullable=False, index=True)
    ChoreId = Column(Integer, nullable=False, index=True)
    EntryDate = Column(Date, nullable=False, index=True)
    Status = Column(String(20), nullable=False, default="Approved")
    ChoreType = Column(String(20))
    Amount = Column(Numeric(12, 2), nullable=False)
    Notes = Column(Text)
    IsDeleted = Column(Boolean, nullable=False, default=False)
    CreatedByUserId = Column(Integer, nullable=False)
    UpdatedByUserId = Column(Integer)
    ReviewedByUserId = Column(Integer)
    ReviewedAt = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class ChoreEntryAudit(Base):
    __tablename__ = "chore_entry_audits"
    __table_args__ = ({"schema": "kids"},)

    Id = Column(Integer, primary_key=True, index=True)
    ChoreEntryId = Column(Integer, nullable=False, index=True)
    Action = Column(String(30), nullable=False)
    ActorUserId = Column(Integer, nullable=False)
    Summary = Column(String(300))
    BeforeJson = Column(Text)
    AfterJson = Column(Text)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index(
            "ux_kids_ledger_source",
            "KidUserId",
            "SourceType",
            "SourceId",
            "EntryDate",
            unique=True,
            mssql_where=text("SourceType IS NOT NULL AND SourceId IS NOT NULL"),
        ),
        {"schema": "kids"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    KidUserId = Column(Integer, nullable=False, index=True)
    EntryType = Column(String(40), nullable=False)
    Amount = Column(Numeric(12, 2), nullable=False)
    EntryDate = Column(Date, nullable=False, index=True)
    Narrative = Column(String(200))
    Notes = Column(Text)
    CreatedByUserId = Column(Integer, nullable=False)
    SourceType = Column(String(60))
    SourceId = Column(Integer)
    IsDeleted = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class PocketMoneyRule(Base):
    __tablename__ = "pocket_money_rules"
    __table_args__ = (
        UniqueConstraint("KidUserId", name="uq_kids_pocket_money_kid"),
        {"schema": "kids"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    KidUserId = Column(Integer, nullable=False, index=True)
    Amount = Column(Numeric(12, 2), nullable=False)
    Frequency = Column(String(30), nullable=False)
    DayOfWeek = Column(Integer)
    DayOfMonth = Column(Integer)
    StartDate = Column(Date, nullable=False)
    LastPostedOn = Column(Date)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedByUserId = Column(Integer, nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
