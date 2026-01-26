from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Note(Base):
    __tablename__ = "Notes"
    __table_args__ = {"schema": "notes"}

    Id = Column(Integer, primary_key=True, index=True)
    UserId = Column(Integer, ForeignKey("auth.users.Id"), nullable=False, index=True)
    Title = Column(String(500), nullable=False)
    Content = Column(Text, nullable=True)
    Labels = Column(Text, nullable=True)  # JSON array of strings
    IsPinned = Column(Boolean, default=False)
    ArchivedAt = Column(DateTime, nullable=True, index=True)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("NoteItem", back_populates="note", cascade="all, delete-orphan")
    tags = relationship("NoteTag", back_populates="note", cascade="all, delete-orphan")
    task_links = relationship("NoteTaskLink", back_populates="note", cascade="all, delete-orphan")
    associations = relationship("NoteAssociation", back_populates="note", cascade="all, delete-orphan")


class NoteItem(Base):
    __tablename__ = "NoteItems"
    __table_args__ = {"schema": "notes"}

    Id = Column(Integer, primary_key=True, index=True)
    NoteId = Column(Integer, ForeignKey("notes.Notes.Id", ondelete="CASCADE"), nullable=False)
    Text = Column(String(1000), nullable=False)
    Checked = Column(Boolean, default=False)
    OrderIndex = Column(Integer, nullable=False)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    note = relationship("Note", back_populates="items")


class NoteTag(Base):
    __tablename__ = "NoteTags"
    __table_args__ = {"schema": "notes"}

    NoteId = Column(Integer, ForeignKey("notes.Notes.Id", ondelete="CASCADE"), primary_key=True)
    UserId = Column(Integer, ForeignKey("auth.users.Id"), primary_key=True)
    CreatedAt = Column(DateTime, default=datetime.utcnow)

    # Relationships
    note = relationship("Note", back_populates="tags")


class NoteTaskLink(Base):
    __tablename__ = "NoteTaskLinks"
    __table_args__ = {"schema": "notes"}

    NoteId = Column(Integer, ForeignKey("notes.Notes.Id", ondelete="CASCADE"), primary_key=True)
    TaskId = Column(Integer, ForeignKey("tasks.Tasks.Id", ondelete="CASCADE"), primary_key=True)
    CreatedAt = Column(DateTime, default=datetime.utcnow)

    # Relationships
    note = relationship("Note", back_populates="task_links")


class NoteAssociation(Base):
    __tablename__ = "NoteAssociations"
    __table_args__ = {"schema": "notes"}

    Id = Column(Integer, primary_key=True, index=True)
    NoteId = Column(Integer, ForeignKey("notes.Notes.Id", ondelete="CASCADE"), nullable=False)
    ModuleName = Column(String(100), nullable=False)
    RecordId = Column(Integer, nullable=False)
    CreatedAt = Column(DateTime, default=datetime.utcnow)

    # Relationships
    note = relationship("Note", back_populates="associations")
