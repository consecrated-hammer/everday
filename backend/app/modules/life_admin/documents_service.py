"""Document library services for life-admin."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timezone
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.life_admin.document_ai_service import AnalyzeDocument, DocumentAiResult
from app.modules.life_admin.models import (
    Document,
    DocumentAiSuggestion,
    DocumentAudit,
    DocumentFolder,
    DocumentLink,
    DocumentTag,
    DocumentTagLink,
    LifeRecord,
    LifeReminder,
)


LINK_TYPE_LIFE_RECORD = "life_admin_record"
REMINDER_STATUS_OPEN = "Open"
REMINDER_STATUS_DONE = "Done"


def _SerializeJson(value: dict | list | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, separators=(",", ":"))


def _ParseJson(value: str | None) -> dict | list | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _ParseDueAt(value: object | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            try:
                parsed_date = date.fromisoformat(raw)
            except ValueError:
                return None
            parsed = datetime.combine(parsed_date, time(hour=9, tzinfo=timezone.utc))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    return None


def NormalizeTagName(value: str) -> str:
    return value.strip()


def NormalizeTagSlug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or "tag"


def NormalizeFolderName(value: str) -> str:
    return value.strip()


def ListFolders(db: Session, *, owner_user_id: int) -> list[DocumentFolder]:
    return (
        db.query(DocumentFolder)
        .filter(DocumentFolder.OwnerUserId == owner_user_id)
        .order_by(DocumentFolder.SortOrder.asc(), DocumentFolder.Name.asc())
        .all()
    )


def CreateFolder(db: Session, *, owner_user_id: int, name: str, sort_order: int = 0) -> DocumentFolder:
    now = NowUtc()
    record = DocumentFolder(
        OwnerUserId=owner_user_id,
        Name=NormalizeFolderName(name),
        SortOrder=sort_order,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateFolder(
    db: Session,
    *,
    owner_user_id: int,
    folder_id: int,
    name: str,
    sort_order: int = 0,
) -> DocumentFolder | None:
    record = (
        db.query(DocumentFolder)
        .filter(DocumentFolder.Id == folder_id, DocumentFolder.OwnerUserId == owner_user_id)
        .first()
    )
    if not record:
        return None
    record.Name = NormalizeFolderName(name)
    record.SortOrder = sort_order
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteFolder(db: Session, *, owner_user_id: int, folder_id: int) -> bool:
    record = (
        db.query(DocumentFolder)
        .filter(DocumentFolder.Id == folder_id, DocumentFolder.OwnerUserId == owner_user_id)
        .first()
    )
    if not record:
        return False
    db.query(Document).filter(Document.FolderId == folder_id).update(
        {Document.FolderId: None}, synchronize_session=False
    )
    db.delete(record)
    db.commit()
    return True


def ListTags(db: Session, *, owner_user_id: int) -> list[DocumentTag]:
    return (
        db.query(DocumentTag)
        .filter(DocumentTag.OwnerUserId == owner_user_id)
        .order_by(DocumentTag.Name.asc())
        .all()
    )


def _GetOrCreateTag(db: Session, *, owner_user_id: int, name: str) -> DocumentTag:
    normalized = NormalizeTagName(name)
    slug = NormalizeTagSlug(normalized)
    existing = (
        db.query(DocumentTag)
        .filter(DocumentTag.OwnerUserId == owner_user_id, DocumentTag.Slug == slug)
        .first()
    )
    if existing:
        return existing
    now = NowUtc()
    record = DocumentTag(
        OwnerUserId=owner_user_id,
        Name=normalized,
        Slug=slug,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def EnsureTags(db: Session, *, owner_user_id: int, names: Iterable[str]) -> list[DocumentTag]:
    tags: list[DocumentTag] = []
    for name in names:
        if not name or not str(name).strip():
            continue
        tags.append(_GetOrCreateTag(db, owner_user_id=owner_user_id, name=str(name)))
    return tags


def CreateDocument(
    db: Session,
    *,
    owner_user_id: int,
    created_by_user_id: int,
    title: str | None,
    folder_id: int | None,
    storage_path: str,
    file_size_bytes: int,
    content_type: str | None,
    original_filename: str | None,
    file_hash: str | None,
    source_type: str | None,
    source_detail: str | None,
) -> Document:
    now = NowUtc()
    record = Document(
        OwnerUserId=owner_user_id,
        CreatedByUserId=created_by_user_id,
        Title=title,
        FolderId=folder_id,
        StoragePath=storage_path,
        FileSizeBytes=file_size_bytes,
        ContentType=content_type,
        OriginalFileName=original_filename,
        Hash=file_hash,
        OcrStatus="Pending",
        SourceType=source_type,
        SourceDetail=source_detail,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateDocument(
    db: Session,
    *,
    owner_user_id: int,
    document_id: int,
    title: str | None,
    folder_id: int | None,
) -> Document | None:
    record = (
        db.query(Document)
        .filter(Document.Id == document_id, Document.OwnerUserId == owner_user_id)
        .first()
    )
    if not record:
        return None
    record.Title = title
    record.FolderId = folder_id
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def ListDocuments(
    db: Session,
    *,
    owner_user_id: int,
    search: str | None = None,
    folder_id: int | None = None,
    tag_ids: list[int] | None = None,
    linked_only: bool | None = None,
    reminders_only: bool | None = None,
    limit: int = 200,
) -> list[Document]:
    query = db.query(Document).filter(Document.OwnerUserId == owner_user_id)

    if folder_id is not None:
        if folder_id == 0:
            query = query.filter(Document.FolderId == None)  # noqa: E711
        else:
            query = query.filter(Document.FolderId == folder_id)

    if tag_ids:
        query = query.join(DocumentTagLink, DocumentTagLink.DocumentId == Document.Id)
        query = query.filter(DocumentTagLink.TagId.in_(tag_ids))
        query = query.distinct()

    if linked_only:
        query = query.join(DocumentLink, DocumentLink.DocumentId == Document.Id)
        query = query.distinct()

    if reminders_only:
        query = query.join(
            LifeReminder,
            (LifeReminder.SourceType == "life_admin_document")
            & (LifeReminder.SourceId == Document.Id),
        )
        query = query.distinct()

    if search:
        needle = f"%{search.strip().lower()}%"
        query = query.outerjoin(DocumentTagLink, DocumentTagLink.DocumentId == Document.Id)
        query = query.outerjoin(DocumentTag, DocumentTag.Id == DocumentTagLink.TagId)
        query = query.filter(
            func.lower(Document.Title).like(needle)
            | func.lower(Document.OriginalFileName).like(needle)
            | func.lower(Document.OcrText).like(needle)
            | func.lower(DocumentTag.Name).like(needle)
        )
        query = query.distinct()

    return (
        query.order_by(Document.CreatedAt.desc(), Document.Id.desc())
        .limit(limit)
        .all()
    )


def GetDocument(db: Session, *, owner_user_id: int, document_id: int) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.Id == document_id, Document.OwnerUserId == owner_user_id)
        .first()
    )


def ListDocumentTags(
    db: Session, *, document_ids: list[int], owner_user_id: int | None = None
) -> dict[int, list[DocumentTag]]:
    if not document_ids:
        return {}
    query = (
        db.query(DocumentTagLink.DocumentId, DocumentTag)
        .join(DocumentTag, DocumentTag.Id == DocumentTagLink.TagId)
        .filter(DocumentTagLink.DocumentId.in_(document_ids))
    )
    if owner_user_id is not None:
        query = query.filter(DocumentTag.OwnerUserId == owner_user_id)
    rows = query.all()
    result: dict[int, list[DocumentTag]] = {}
    for doc_id, tag in rows:
        result.setdefault(doc_id, []).append(tag)
    return result


def SetDocumentTags(
    db: Session,
    *,
    owner_user_id: int,
    document_id: int,
    tag_names: list[str],
) -> list[DocumentTag]:
    record = db.query(Document).filter(
        Document.Id == document_id, Document.OwnerUserId == owner_user_id
    ).first()
    if not record:
        raise ValueError("Document not found.")

    tags = EnsureTags(db, owner_user_id=owner_user_id, names=tag_names)
    existing_links = (
        db.query(DocumentTagLink)
        .filter(DocumentTagLink.DocumentId == document_id)
        .all()
    )
    existing_tag_ids = {link.TagId for link in existing_links}
    for tag in tags:
        if tag.Id in existing_tag_ids:
            continue
        db.add(DocumentTagLink(DocumentId=document_id, TagId=tag.Id))
    db.commit()
    return tags


def RemoveDocumentTag(
    db: Session,
    *,
    owner_user_id: int,
    document_id: int,
    tag_id: int,
) -> bool:
    record = db.query(Document).filter(
        Document.Id == document_id, Document.OwnerUserId == owner_user_id
    ).first()
    if not record:
        return False
    deleted = (
        db.query(DocumentTagLink)
        .filter(DocumentTagLink.DocumentId == document_id, DocumentTagLink.TagId == tag_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted > 0


def AddDocumentLink(
    db: Session,
    *,
    owner_user_id: int,
    document_id: int,
    linked_entity_type: str,
    linked_entity_id: int,
    created_by_user_id: int,
) -> DocumentLink:
    record = db.query(Document).filter(
        Document.Id == document_id, Document.OwnerUserId == owner_user_id
    ).first()
    if not record:
        raise ValueError("Document not found.")
    if linked_entity_type == LINK_TYPE_LIFE_RECORD:
        exists = db.query(LifeRecord).filter(LifeRecord.Id == linked_entity_id).first()
        if not exists:
            raise ValueError("Life admin record not found.")
    existing_link = (
        db.query(DocumentLink)
        .filter(
            DocumentLink.DocumentId == document_id,
            DocumentLink.LinkedEntityType == linked_entity_type,
            DocumentLink.LinkedEntityId == linked_entity_id,
        )
        .first()
    )
    if existing_link:
        return existing_link
    now = NowUtc()
    link = DocumentLink(
        DocumentId=document_id,
        LinkedEntityType=linked_entity_type,
        LinkedEntityId=linked_entity_id,
        CreatedByUserId=created_by_user_id,
        CreatedAt=now,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def RemoveDocumentLink(
    db: Session,
    *,
    owner_user_id: int,
    document_id: int,
    link_id: int,
) -> bool:
    record = db.query(Document).filter(
        Document.Id == document_id, Document.OwnerUserId == owner_user_id
    ).first()
    if not record:
        return False
    deleted = (
        db.query(DocumentLink)
        .filter(DocumentLink.Id == link_id, DocumentLink.DocumentId == document_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted > 0


def ListDocumentLinks(db: Session, *, document_ids: list[int]) -> dict[int, list[DocumentLink]]:
    if not document_ids:
        return {}
    rows = (
        db.query(DocumentLink)
        .filter(DocumentLink.DocumentId.in_(document_ids))
        .order_by(DocumentLink.CreatedAt.desc())
        .all()
    )
    result: dict[int, list[DocumentLink]] = {}
    for link in rows:
        result.setdefault(link.DocumentId, []).append(link)
    return result


def ListDocumentsForRecord(db: Session, *, record_id: int) -> list[int]:
    rows = (
        db.query(DocumentLink.DocumentId)
        .filter(
            DocumentLink.LinkedEntityType == LINK_TYPE_LIFE_RECORD,
            DocumentLink.LinkedEntityId == record_id,
        )
        .all()
    )
    return [row.DocumentId for row in rows]


def CreateReminder(
    db: Session,
    *,
    owner_user_id: int,
    created_by_user_id: int,
    source_type: str,
    source_id: int,
    title: str,
    due_at: datetime,
    repeat_rule: str | None = None,
    assignee_user_id: int | None = None,
) -> LifeReminder:
    now = NowUtc()
    record = LifeReminder(
        OwnerUserId=owner_user_id,
        CreatedByUserId=created_by_user_id,
        SourceType=source_type,
        SourceId=source_id,
        Title=title,
        DueAt=due_at,
        RepeatRule=repeat_rule,
        Status=REMINDER_STATUS_OPEN,
        AssigneeUserId=assignee_user_id,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateReminderStatus(
    db: Session,
    *,
    owner_user_id: int,
    reminder_id: int,
    status: str,
) -> LifeReminder | None:
    record = (
        db.query(LifeReminder)
        .filter(LifeReminder.Id == reminder_id, LifeReminder.OwnerUserId == owner_user_id)
        .first()
    )
    if not record:
        return None
    record.Status = status
    if status == REMINDER_STATUS_DONE:
        record.CompletedAt = NowUtc()
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteReminder(db: Session, *, owner_user_id: int, reminder_id: int) -> bool:
    deleted = (
        db.query(LifeReminder)
        .filter(LifeReminder.Id == reminder_id, LifeReminder.OwnerUserId == owner_user_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted > 0


def ListReminders(
    db: Session,
    *,
    owner_user_id: int,
    source_type: str | None = None,
    source_id: int | None = None,
) -> list[LifeReminder]:
    query = db.query(LifeReminder).filter(LifeReminder.OwnerUserId == owner_user_id)
    if source_type:
        query = query.filter(LifeReminder.SourceType == source_type)
    if source_id:
        query = query.filter(LifeReminder.SourceId == source_id)
    return query.order_by(LifeReminder.DueAt.asc(), LifeReminder.Id.asc()).all()


def ListRemindersForDocuments(
    db: Session, *, owner_user_id: int, document_ids: list[int]
) -> dict[int, list[LifeReminder]]:
    if not document_ids:
        return {}
    rows = (
        db.query(LifeReminder)
        .filter(
            LifeReminder.OwnerUserId == owner_user_id,
            LifeReminder.SourceType == "life_admin_document",
            LifeReminder.SourceId.in_(document_ids),
        )
        .order_by(LifeReminder.DueAt.asc())
        .all()
    )
    result: dict[int, list[LifeReminder]] = {}
    for reminder in rows:
        result.setdefault(reminder.SourceId, []).append(reminder)
    return result


def LogDocumentAudit(
    db: Session,
    *,
    document_id: int,
    actor_user_id: int,
    action: str,
    summary: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
) -> DocumentAudit:
    record = DocumentAudit(
        DocumentId=document_id,
        ActorUserId=actor_user_id,
        Action=action,
        Summary=summary,
        BeforeJson=_SerializeJson(before),
        AfterJson=_SerializeJson(after),
        CreatedAt=NowUtc(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def ListDocumentAudits(db: Session, *, document_id: int) -> list[DocumentAudit]:
    return (
        db.query(DocumentAudit)
        .filter(DocumentAudit.DocumentId == document_id)
        .order_by(DocumentAudit.CreatedAt.desc())
        .all()
    )


def UpdateOcrResults(
    db: Session,
    *,
    document_id: int,
    ocr_text: str,
    status: str,
) -> None:
    record = db.query(Document).filter(Document.Id == document_id).first()
    if not record:
        return
    record.OcrText = ocr_text
    record.OcrStatus = status
    record.OcrUpdatedAt = NowUtc()
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()


def RunAiAnalysis(db: Session, *, document_id: int) -> None:
    record = db.query(Document).filter(Document.Id == document_id).first()
    if not record:
        return
    try:
        result = AnalyzeDocument(
            storage_path=record.StoragePath,
            content_type=record.ContentType,
            filename=record.OriginalFileName,
        )
    except Exception:
        UpdateOcrResults(db, document_id=document_id, ocr_text="", status="Failed")
        return
    status_value = "Complete"
    if not result.RawJson and not result.OcrText:
        status_value = "Skipped"
    UpdateOcrResults(db, document_id=document_id, ocr_text=result.OcrText, status=status_value)
    UpsertAiSuggestion(db, document_id=document_id, result=result)


def UpsertAiSuggestion(
    db: Session,
    *,
    document_id: int,
    result: DocumentAiResult,
) -> DocumentAiSuggestion:
    record = db.query(DocumentAiSuggestion).filter(DocumentAiSuggestion.DocumentId == document_id).first()
    now = NowUtc()
    if not record:
        record = DocumentAiSuggestion(DocumentId=document_id, CreatedAt=now, UpdatedAt=now)
    record.Status = "Complete" if result.RawJson else "Skipped"
    record.SuggestedFolderName = str(result.Suggestions.get("SuggestedFolder") or "").strip() or None
    record.SuggestedTagsJson = _SerializeJson(result.Suggestions.get("SuggestedTags") or [])
    record.SuggestedLinksJson = _SerializeJson(result.Suggestions.get("SuggestedLinks") or [])
    record.SuggestedReminderJson = _SerializeJson(result.Suggestions.get("SuggestedReminder"))
    record.Confidence = result.Confidence
    record.RawJson = result.RawJson
    record.UpdatedAt = now
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def ApplyAiSuggestion(
    db: Session,
    *,
    owner_user_id: int,
    document_id: int,
    actor_user_id: int,
) -> Document | None:
    record = db.query(Document).filter(
        Document.Id == document_id, Document.OwnerUserId == owner_user_id
    ).first()
    if not record:
        return None
    suggestion = db.query(DocumentAiSuggestion).filter(
        DocumentAiSuggestion.DocumentId == document_id
    ).first()
    if not suggestion:
        return record
    tags = _ParseJson(suggestion.SuggestedTagsJson) or []
    if isinstance(tags, list):
        normalized = [str(tag).strip() for tag in tags if str(tag).strip()]
        if normalized:
            SetDocumentTags(
                db, owner_user_id=owner_user_id, document_id=document_id, tag_names=normalized
            )
    if suggestion.SuggestedFolderName:
        folder = (
            db.query(DocumentFolder)
            .filter(
                DocumentFolder.OwnerUserId == owner_user_id,
                func.lower(DocumentFolder.Name) == suggestion.SuggestedFolderName.lower(),
            )
            .first()
        )
        if not folder:
            folder = CreateFolder(db, owner_user_id=owner_user_id, name=suggestion.SuggestedFolderName)
        record.FolderId = folder.Id
        record.UpdatedAt = NowUtc()
        db.add(record)
        db.commit()
        db.refresh(record)
    links = _ParseJson(suggestion.SuggestedLinksJson) or []
    if isinstance(links, list):
        for entry in links:
            if not isinstance(entry, dict):
                continue
            entity_type = (
                entry.get("EntityType")
                or entry.get("LinkedEntityType")
                or entry.get("entityType")
                or entry.get("type")
            )
            if entity_type != LINK_TYPE_LIFE_RECORD:
                continue
            linked_entity_id = entry.get("LinkedEntityId") or entry.get("EntityId") or entry.get("Id")
            if isinstance(linked_entity_id, str) and linked_entity_id.isdigit():
                linked_entity_id = int(linked_entity_id)
            if isinstance(linked_entity_id, int):
                try:
                    AddDocumentLink(
                        db,
                        owner_user_id=owner_user_id,
                        document_id=document_id,
                        linked_entity_type=LINK_TYPE_LIFE_RECORD,
                        linked_entity_id=linked_entity_id,
                        created_by_user_id=actor_user_id,
                    )
                except ValueError:
                    continue
                continue
            hint = entry.get("Hint") or entry.get("Title") or entry.get("hint")
            if isinstance(hint, str) and hint.strip():
                match = (
                    db.query(LifeRecord)
                    .filter(func.lower(LifeRecord.Title) == hint.strip().lower())
                    .first()
                )
                if match:
                    try:
                        AddDocumentLink(
                            db,
                            owner_user_id=owner_user_id,
                            document_id=document_id,
                            linked_entity_type=LINK_TYPE_LIFE_RECORD,
                            linked_entity_id=match.Id,
                            created_by_user_id=actor_user_id,
                        )
                    except ValueError:
                        continue
    reminder = _ParseJson(suggestion.SuggestedReminderJson)
    if isinstance(reminder, dict):
        title = reminder.get("Title") or reminder.get("title") or reminder.get("Subject")
        due_value = reminder.get("DueDate") or reminder.get("DueAt") or reminder.get("due")
        title_text = str(title).strip() if title is not None else ""
        due_at = _ParseDueAt(due_value)
        if title_text and due_at:
            existing = (
                db.query(LifeReminder)
                .filter(
                    LifeReminder.OwnerUserId == owner_user_id,
                    LifeReminder.SourceType == "life_admin_document",
                    LifeReminder.SourceId == document_id,
                    LifeReminder.Title == title_text,
                    LifeReminder.DueAt == due_at,
                )
                .first()
            )
            if not existing:
                CreateReminder(
                    db,
                    owner_user_id=owner_user_id,
                    created_by_user_id=actor_user_id,
                    source_type="life_admin_document",
                    source_id=document_id,
                    title=title_text,
                    due_at=due_at,
                )
    LogDocumentAudit(
        db,
        document_id=document_id,
        actor_user_id=actor_user_id,
        action="ai_apply",
        summary="Applied AI suggestions",
    )
    return record


def BulkUpdateDocuments(
    db: Session,
    *,
    owner_user_id: int,
    actor_user_id: int,
    document_ids: list[int],
    folder_id: int | None = None,
    tag_names: list[str] | None = None,
) -> int:
    if not document_ids:
        return 0
    count = (
        db.query(Document)
        .filter(Document.OwnerUserId == owner_user_id, Document.Id.in_(document_ids))
        .count()
    )
    if count == 0:
        return 0
    if folder_id is not None:
        folder_value = None if folder_id == 0 else folder_id
        db.query(Document).filter(
            Document.OwnerUserId == owner_user_id, Document.Id.in_(document_ids)
        ).update({Document.FolderId: folder_value}, synchronize_session=False)
    if tag_names:
        for document_id in document_ids:
            SetDocumentTags(
                db,
                owner_user_id=owner_user_id,
                document_id=document_id,
                tag_names=tag_names,
            )
    db.commit()
    for document_id in document_ids:
        LogDocumentAudit(
            db,
            document_id=document_id,
            actor_user_id=actor_user_id,
            action="bulk_update",
            summary="Bulk update applied",
        )
    return count
