from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    ForeignKey,
    Index,
)

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


class DocumentFolder(Base):
    __tablename__ = "document_folders"
    __table_args__ = (
        UniqueConstraint("OwnerUserId", "Name", name="uq_life_admin_document_folder_owner_name"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(120), nullable=False)
    SortOrder = Column(Integer, nullable=False, default=0)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class DocumentTag(Base):
    __tablename__ = "document_tags"
    __table_args__ = (
        UniqueConstraint("OwnerUserId", "Slug", name="uq_life_admin_document_tag_owner_slug"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    Name = Column(String(80), nullable=False)
    Slug = Column(String(120), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_life_admin_documents_owner_folder", "OwnerUserId", "FolderId"),
        Index("ix_life_admin_documents_owner_created", "OwnerUserId", "CreatedAt"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    Title = Column(String(200))
    OriginalFileName = Column(String(260))
    ContentType = Column(String(120))
    FileSizeBytes = Column(Integer)
    StoragePath = Column(String(500), nullable=False)
    Hash = Column(String(64))
    FolderId = Column(Integer, ForeignKey("life_admin.document_folders.Id"), index=True)
    OcrText = Column(Text)
    OcrStatus = Column(String(20), nullable=False, default="Pending")
    OcrUpdatedAt = Column(DateTime(timezone=True))
    SourceType = Column(String(40))
    SourceDetail = Column(String(200))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class DocumentTagLink(Base):
    __tablename__ = "document_tag_links"
    __table_args__ = (
        UniqueConstraint("DocumentId", "TagId", name="uq_life_admin_document_tag_link"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    DocumentId = Column(Integer, ForeignKey("life_admin.documents.Id", ondelete="CASCADE"), nullable=False, index=True)
    TagId = Column(Integer, ForeignKey("life_admin.document_tags.Id", ondelete="CASCADE"), nullable=False, index=True)


class DocumentLink(Base):
    __tablename__ = "document_links"
    __table_args__ = (
        UniqueConstraint(
            "DocumentId",
            "LinkedEntityType",
            "LinkedEntityId",
            name="uq_life_admin_document_link",
        ),
        Index("ix_life_admin_document_link_entity", "LinkedEntityType", "LinkedEntityId"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    DocumentId = Column(Integer, ForeignKey("life_admin.documents.Id", ondelete="CASCADE"), nullable=False, index=True)
    LinkedEntityType = Column(String(40), nullable=False)
    LinkedEntityId = Column(Integer, nullable=False)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LifeReminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        Index("ix_life_admin_reminders_owner_source", "OwnerUserId", "SourceType", "SourceId"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    OwnerUserId = Column(Integer, nullable=False, index=True)
    CreatedByUserId = Column(Integer, nullable=False, index=True)
    SourceType = Column(String(40), nullable=False)
    SourceId = Column(Integer, nullable=False)
    Title = Column(String(200), nullable=False)
    DueAt = Column(DateTime(timezone=True), nullable=False)
    RepeatRule = Column(String(120))
    Status = Column(String(20), nullable=False, default="Open")
    AssigneeUserId = Column(Integer)
    CompletedAt = Column(DateTime(timezone=True))
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class DocumentAudit(Base):
    __tablename__ = "document_audits"
    __table_args__ = {"schema": "life_admin"}

    Id = Column(Integer, primary_key=True, index=True)
    DocumentId = Column(Integer, ForeignKey("life_admin.documents.Id", ondelete="CASCADE"), nullable=False, index=True)
    Action = Column(String(40), nullable=False)
    ActorUserId = Column(Integer, nullable=False, index=True)
    Summary = Column(String(400))
    BeforeJson = Column(Text)
    AfterJson = Column(Text)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class DocumentAiSuggestion(Base):
    __tablename__ = "document_ai_suggestions"
    __table_args__ = (
        UniqueConstraint("DocumentId", name="uq_life_admin_document_ai_suggestion"),
        {"schema": "life_admin"},
    )

    Id = Column(Integer, primary_key=True, index=True)
    DocumentId = Column(Integer, ForeignKey("life_admin.documents.Id", ondelete="CASCADE"), nullable=False, index=True)
    Status = Column(String(20), nullable=False, default="Pending")
    SuggestedFolderName = Column(String(120))
    SuggestedTagsJson = Column(Text)
    SuggestedLinksJson = Column(Text)
    SuggestedReminderJson = Column(Text)
    Confidence = Column(String(20))
    RawJson = Column(Text)
    CreatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
