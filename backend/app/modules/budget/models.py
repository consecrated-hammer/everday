from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text

from app.db import Base


class IncomeStream(Base):
    __tablename__ = "income_streams"
    __table_args__ = {"schema": "budget"}

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Label = Column(String(200), nullable=False)
    NetAmount = Column(Numeric(12, 2), nullable=False)
    GrossAmount = Column(Numeric(12, 2), nullable=False)
    FirstPayDate = Column(Date, nullable=False)
    Frequency = Column(String(50), nullable=False)
    EndDate = Column(Date)
    Notes = Column(Text)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = {"schema": "budget"}

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Label = Column(String(200), nullable=False)
    Amount = Column(Numeric(12, 2), nullable=False)
    Frequency = Column(String(50), nullable=False)
    Account = Column(String(200))
    Type = Column(String(200))
    NextDueDate = Column(Date)
    Cadence = Column(String(50))
    Interval = Column(Integer)
    Month = Column(Integer)
    DayOfMonth = Column(Integer)
    Enabled = Column(Boolean, nullable=False, default=True)
    Notes = Column(Text)
    DisplayOrder = Column(Integer, nullable=False, default=0, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class ExpenseAccount(Base):
    __tablename__ = "expense_accounts"
    __table_args__ = {"schema": "budget"}

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(200), nullable=False)
    Enabled = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class ExpenseType(Base):
    __tablename__ = "expense_types"
    __table_args__ = {"schema": "budget"}

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(200), nullable=False)
    Enabled = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class AllocationAccount(Base):
    __tablename__ = "allocation_accounts"
    __table_args__ = {"schema": "budget"}

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(200), nullable=False)
    Percent = Column(Numeric(6, 2), nullable=False, default=0)
    Enabled = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
