import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import GetDb, SessionLocal
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.life_admin import gmail_intake_service
from app.modules.life_admin.document_storage import ResolveDocumentPath, SaveUploadFile
from app.modules.life_admin import documents_service
from app.modules.life_admin.models import Document, DocumentAiSuggestion, DocumentFolder, LifeReminder, LifeRecord
from app.modules.life_admin.schemas import (
    DocumentAiSuggestionOut,
    DocumentAuditOut,
    DocumentBulkUpdate,
    DocumentDetailOut,
    DocumentFolderCreate,
    DocumentFolderOut,
    DocumentFolderUpdate,
    DocumentLinkCreate,
    DocumentLinkOut,
    DocumentOut,
    DocumentTagOut,
    DocumentTagUpdate,
    DocumentUpdate,
    ReminderCreate,
    ReminderOut,
    ReminderUpdate,
)

router = APIRouter(prefix="/api/life-admin", tags=["life-admin"])


def _folder_out(record) -> DocumentFolderOut:
    return DocumentFolderOut(
        Id=record.Id,
        Name=record.Name,
        SortOrder=record.SortOrder,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _tag_out(record) -> DocumentTagOut:
    return DocumentTagOut(
        Id=record.Id,
        Name=record.Name,
        Slug=record.Slug,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _link_out(record) -> DocumentLinkOut:
    return DocumentLinkOut(
        Id=record.Id,
        DocumentId=record.DocumentId,
        LinkedEntityType=record.LinkedEntityType,
        LinkedEntityId=record.LinkedEntityId,
        CreatedByUserId=record.CreatedByUserId,
        CreatedAt=record.CreatedAt,
    )


def _reminder_out(record) -> ReminderOut:
    return ReminderOut(
        Id=record.Id,
        SourceType=record.SourceType,
        SourceId=record.SourceId,
        Title=record.Title,
        DueAt=record.DueAt,
        RepeatRule=record.RepeatRule,
        Status=record.Status,
        AssigneeUserId=record.AssigneeUserId,
        CompletedAt=record.CompletedAt,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _audit_out(record) -> DocumentAuditOut:
    try:
        before = json.loads(record.BeforeJson) if record.BeforeJson else None
    except json.JSONDecodeError:
        before = None
    try:
        after = json.loads(record.AfterJson) if record.AfterJson else None
    except json.JSONDecodeError:
        after = None
    return DocumentAuditOut(
        Id=record.Id,
        DocumentId=record.DocumentId,
        Action=record.Action,
        ActorUserId=record.ActorUserId,
        Summary=record.Summary,
        BeforeJson=before,
        AfterJson=after,
        CreatedAt=record.CreatedAt,
    )


def _ai_out(record) -> DocumentAiSuggestionOut:
    try:
        tags = json.loads(record.SuggestedTagsJson) if record.SuggestedTagsJson else []
    except json.JSONDecodeError:
        tags = []
    try:
        links = json.loads(record.SuggestedLinksJson) if record.SuggestedLinksJson else []
    except json.JSONDecodeError:
        links = []
    try:
        reminder = json.loads(record.SuggestedReminderJson) if record.SuggestedReminderJson else None
    except json.JSONDecodeError:
        reminder = None
    return DocumentAiSuggestionOut(
        Id=record.Id,
        DocumentId=record.DocumentId,
        Status=record.Status,
        SuggestedFolderName=record.SuggestedFolderName,
        SuggestedTags=tags,
        SuggestedLinks=links,
        SuggestedReminder=reminder,
        Confidence=record.Confidence,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _document_out(record, *, folder_name: str | None, tags: list[DocumentTagOut], link_count: int, reminder_count: int):
    return DocumentOut(
        Id=record.Id,
        Title=record.Title,
        FolderId=record.FolderId,
        FolderName=folder_name,
        ContentType=record.ContentType,
        FileSizeBytes=record.FileSizeBytes,
        OriginalFileName=record.OriginalFileName,
        OcrStatus=record.OcrStatus,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
        FileUrl=f"/api/life-admin/documents/{record.Id}/file",
        Tags=tags,
        LinkCount=link_count,
        ReminderCount=reminder_count,
    )


@router.get("/document-folders", response_model=list[DocumentFolderOut])
def ListDocumentFolders(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[DocumentFolderOut]:
    records = documents_service.ListFolders(db, owner_user_id=user.Id)
    return [_folder_out(record) for record in records]


@router.post("/document-folders", response_model=DocumentFolderOut, status_code=status.HTTP_201_CREATED)
def CreateDocumentFolder(
    payload: DocumentFolderCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DocumentFolderOut:
    record = documents_service.CreateFolder(
        db, owner_user_id=user.Id, name=payload.Name, sort_order=payload.SortOrder
    )
    return _folder_out(record)


@router.put("/document-folders/{folder_id}", response_model=DocumentFolderOut)
def UpdateDocumentFolder(
    folder_id: int,
    payload: DocumentFolderUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DocumentFolderOut:
    record = documents_service.UpdateFolder(
        db,
        owner_user_id=user.Id,
        folder_id=folder_id,
        name=payload.Name,
        sort_order=payload.SortOrder,
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return _folder_out(record)


@router.delete("/document-folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteDocumentFolder(
    folder_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    if not documents_service.DeleteFolder(db, owner_user_id=user.Id, folder_id=folder_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")


@router.get("/document-tags", response_model=list[DocumentTagOut])
def ListDocumentTags(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[DocumentTagOut]:
    tags = documents_service.ListTags(db, owner_user_id=user.Id)
    return [_tag_out(tag) for tag in tags]


@router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def UploadDocument(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    folder_id: int | None = Form(None),
    tag_names: str | None = Form(None),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DocumentOut:
    if folder_id == 0:
        folder_id = None
    folder = None
    if folder_id is not None:
        folder = (
            db.query(DocumentFolder)
            .filter(DocumentFolder.Id == folder_id, DocumentFolder.OwnerUserId == user.Id)
            .first()
        )
        if not folder:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder not found")
    try:
        stored = SaveUploadFile(file, owner_user_id=user.Id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record = documents_service.CreateDocument(
        db,
        owner_user_id=user.Id,
        created_by_user_id=user.Id,
        title=title,
        folder_id=folder_id,
        storage_path=stored.StoragePath,
        file_size_bytes=stored.FileSizeBytes,
        content_type=stored.ContentType,
        original_filename=stored.OriginalFileName,
        file_hash=stored.Hash,
        source_type="upload",
        source_detail=None,
    )

    tags: list[DocumentTagOut] = []
    if tag_names:
        tag_list = [entry.strip() for entry in tag_names.split(",") if entry.strip()]
        if tag_list:
            tag_records = documents_service.SetDocumentTags(
                db, owner_user_id=user.Id, document_id=record.Id, tag_names=tag_list
            )
            tags = [_tag_out(tag) for tag in tag_records]

    documents_service.LogDocumentAudit(
        db,
        document_id=record.Id,
        actor_user_id=user.Id,
        action="created",
        summary="Document uploaded",
    )

    background_tasks.add_task(_run_ai_analysis, record.Id)

    return _document_out(
        record,
        folder_name=folder.Name if folder else None,
        tags=tags,
        link_count=0,
        reminder_count=0,
    )


def _run_ai_analysis(document_id: int) -> None:
    if SessionLocal is None:
        return
    db = SessionLocal()
    try:
        documents_service.RunAiAnalysis(db, document_id=document_id)
    finally:
        db.close()


@router.get("/documents", response_model=list[DocumentOut])
def ListDocuments(
    search: str | None = None,
    folder_id: int | None = None,
    tag_ids: str | None = None,
    linked_only: bool | None = None,
    reminders_only: bool | None = None,
    record_id: int | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[DocumentOut]:
    tag_id_list = [int(value) for value in tag_ids.split(",") if value.strip().isdigit()] if tag_ids else None
    documents = documents_service.ListDocuments(
        db,
        owner_user_id=user.Id,
        search=search,
        folder_id=folder_id,
        tag_ids=tag_id_list,
        linked_only=linked_only,
        reminders_only=reminders_only,
    )

    if record_id:
        linked_ids = set(documents_service.ListDocumentsForRecord(db, record_id=record_id))
        documents = [doc for doc in documents if doc.Id in linked_ids]

    folder_map = {folder.Id: folder.Name for folder in documents_service.ListFolders(db, owner_user_id=user.Id)}
    tag_map = documents_service.ListDocumentTags(
        db, document_ids=[doc.Id for doc in documents], owner_user_id=user.Id
    )
    link_map = documents_service.ListDocumentLinks(db, document_ids=[doc.Id for doc in documents])
    reminder_map = documents_service.ListRemindersForDocuments(
        db, owner_user_id=user.Id, document_ids=[doc.Id for doc in documents]
    )

    response = []
    for doc in documents:
        tags = [_tag_out(tag) for tag in tag_map.get(doc.Id, [])]
        response.append(
            _document_out(
                doc,
                folder_name=folder_map.get(doc.FolderId),
                tags=tags,
                link_count=len(link_map.get(doc.Id, [])),
                reminder_count=len(reminder_map.get(doc.Id, [])),
            )
        )
    return response


@router.get("/documents/{document_id}", response_model=DocumentDetailOut)
def GetDocument(
    document_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> DocumentDetailOut:
    record = documents_service.GetDocument(db, owner_user_id=user.Id, document_id=document_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    folder_map = {folder.Id: folder.Name for folder in documents_service.ListFolders(db, owner_user_id=user.Id)}
    tags = documents_service.ListDocumentTags(
        db, document_ids=[record.Id], owner_user_id=user.Id
    ).get(record.Id, [])
    links = documents_service.ListDocumentLinks(db, document_ids=[record.Id]).get(record.Id, [])
    reminders = documents_service.ListRemindersForDocuments(
        db, owner_user_id=user.Id, document_ids=[record.Id]
    ).get(record.Id, [])
    audits = documents_service.ListDocumentAudits(db, document_id=record.Id)
    ai_suggestion = db.query(DocumentAiSuggestion).filter(
        DocumentAiSuggestion.DocumentId == record.Id
    ).first()

    return DocumentDetailOut(
        **_document_out(
            record,
            folder_name=folder_map.get(record.FolderId),
            tags=[_tag_out(tag) for tag in tags],
            link_count=len(links),
            reminder_count=len(reminders),
        ).dict(),
        StoragePath=record.StoragePath,
        OcrText=record.OcrText,
        SourceType=record.SourceType,
        SourceDetail=record.SourceDetail,
        Links=[_link_out(link) for link in links],
        Reminders=[_reminder_out(reminder) for reminder in reminders],
        Audits=[_audit_out(audit) for audit in audits],
        AiSuggestion=_ai_out(ai_suggestion) if ai_suggestion else None,
    )


@router.get("/documents/{document_id}/file")
def DownloadDocument(
    document_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> FileResponse:
    record = documents_service.GetDocument(db, owner_user_id=user.Id, document_id=document_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    try:
        path = ResolveDocumentPath(record.StoragePath)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path, media_type=record.ContentType or "application/octet-stream")


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def UpdateDocument(
    document_id: int,
    payload: DocumentUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DocumentOut:
    folder_id = payload.FolderId
    if folder_id == 0:
        folder_id = None
    if folder_id is not None:
        folder = (
            db.query(DocumentFolder)
            .filter(DocumentFolder.Id == folder_id, DocumentFolder.OwnerUserId == user.Id)
            .first()
        )
        if not folder:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder not found")
    record = documents_service.UpdateDocument(
        db,
        owner_user_id=user.Id,
        document_id=document_id,
        title=payload.Title,
        folder_id=folder_id,
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    documents_service.LogDocumentAudit(
        db,
        document_id=record.Id,
        actor_user_id=user.Id,
        action="updated",
        summary="Document updated",
    )
    tags = documents_service.ListDocumentTags(
        db, document_ids=[record.Id], owner_user_id=user.Id
    ).get(record.Id, [])
    folder_map = {folder.Id: folder.Name for folder in documents_service.ListFolders(db, owner_user_id=user.Id)}
    link_map = documents_service.ListDocumentLinks(db, document_ids=[record.Id])
    reminder_map = documents_service.ListRemindersForDocuments(
        db, owner_user_id=user.Id, document_ids=[record.Id]
    )
    return _document_out(
        record,
        folder_name=folder_map.get(record.FolderId),
        tags=[_tag_out(tag) for tag in tags],
        link_count=len(link_map.get(record.Id, [])),
        reminder_count=len(reminder_map.get(record.Id, [])),
    )


@router.post("/documents/intake/gmail", status_code=status.HTTP_200_OK)
def RunGmailIntake(
    background_tasks: BackgroundTasks,
    max_messages: int = 10,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> dict:
    try:
        result, document_ids = gmail_intake_service.RunGmailIntake(
            db,
            owner_user_id=user.Id,
            max_messages=max_messages,
            triggered_by_user_id=user.Id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gmail intake failed") from exc

    for document_id in document_ids:
        background_tasks.add_task(_run_ai_analysis, document_id)

    return result


@router.post("/documents/{document_id}/tags", response_model=list[DocumentTagOut])
def AddDocumentTags(
    document_id: int,
    payload: DocumentTagUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> list[DocumentTagOut]:
    try:
        tags = documents_service.SetDocumentTags(
            db,
            owner_user_id=user.Id,
            document_id=document_id,
            tag_names=payload.TagNames,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    documents_service.LogDocumentAudit(
        db,
        document_id=document_id,
        actor_user_id=user.Id,
        action="tags",
        summary="Tags updated",
    )
    return [_tag_out(tag) for tag in tags]


@router.delete("/documents/{document_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def RemoveDocumentTag(
    document_id: int,
    tag_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    if not documents_service.RemoveDocumentTag(
        db, owner_user_id=user.Id, document_id=document_id, tag_id=tag_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag link not found")
    documents_service.LogDocumentAudit(
        db,
        document_id=document_id,
        actor_user_id=user.Id,
        action="tag_removed",
        summary="Tag removed",
    )


@router.post("/documents/{document_id}/links", response_model=DocumentLinkOut, status_code=status.HTTP_201_CREATED)
def CreateDocumentLink(
    document_id: int,
    payload: DocumentLinkCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DocumentLinkOut:
    try:
        link = documents_service.AddDocumentLink(
            db,
            owner_user_id=user.Id,
            document_id=document_id,
            linked_entity_type=payload.LinkedEntityType,
            linked_entity_id=payload.LinkedEntityId,
            created_by_user_id=user.Id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    documents_service.LogDocumentAudit(
        db,
        document_id=document_id,
        actor_user_id=user.Id,
        action="linked",
        summary="Link added",
    )
    return _link_out(link)


@router.delete("/documents/{document_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteDocumentLink(
    document_id: int,
    link_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    if not documents_service.RemoveDocumentLink(
        db, owner_user_id=user.Id, document_id=document_id, link_id=link_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    documents_service.LogDocumentAudit(
        db,
        document_id=document_id,
        actor_user_id=user.Id,
        action="unlink",
        summary="Link removed",
    )


@router.post("/documents/bulk", status_code=status.HTTP_200_OK)
def BulkUpdateDocuments(
    payload: DocumentBulkUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> dict:
    if payload.FolderId is not None and payload.FolderId != 0:
        folder = (
            db.query(DocumentFolder)
            .filter(DocumentFolder.Id == payload.FolderId, DocumentFolder.OwnerUserId == user.Id)
            .first()
        )
        if not folder:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder not found")
    updated = documents_service.BulkUpdateDocuments(
        db,
        owner_user_id=user.Id,
        actor_user_id=user.Id,
        document_ids=payload.DocumentIds,
        folder_id=payload.FolderId,
        tag_names=payload.TagNames,
    )
    return {"Updated": updated}


@router.post("/reminders", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def CreateReminder(
    payload: ReminderCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> ReminderOut:
    if payload.SourceType not in ("life_admin_document", "life_admin_record"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reminder source type")
    if payload.SourceType == "life_admin_document":
        doc = documents_service.GetDocument(db, owner_user_id=user.Id, document_id=payload.SourceId)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if payload.SourceType == "life_admin_record":
        record = db.query(LifeRecord).filter(LifeRecord.Id == payload.SourceId).first()
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    reminder = documents_service.CreateReminder(
        db,
        owner_user_id=user.Id,
        created_by_user_id=user.Id,
        source_type=payload.SourceType,
        source_id=payload.SourceId,
        title=payload.Title,
        due_at=payload.DueAt,
        repeat_rule=payload.RepeatRule,
        assignee_user_id=payload.AssigneeUserId,
    )
    if payload.SourceType == "life_admin_document":
        documents_service.LogDocumentAudit(
            db,
            document_id=payload.SourceId,
            actor_user_id=user.Id,
            action="reminder",
            summary="Reminder created",
        )
    return _reminder_out(reminder)


@router.get("/reminders", response_model=list[ReminderOut])
def ListReminders(
    source_type: str | None = None,
    source_id: int | None = None,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[ReminderOut]:
    reminders = documents_service.ListReminders(
        db, owner_user_id=user.Id, source_type=source_type, source_id=source_id
    )
    return [_reminder_out(reminder) for reminder in reminders]


@router.patch("/reminders/{reminder_id}", response_model=ReminderOut)
def UpdateReminder(
    reminder_id: int,
    payload: ReminderUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> ReminderOut:
    record = documents_service.UpdateReminderStatus(
        db, owner_user_id=user.Id, reminder_id=reminder_id, status=payload.Status
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    if record.SourceType == "life_admin_document":
        documents_service.LogDocumentAudit(
            db,
            document_id=record.SourceId,
            actor_user_id=user.Id,
            action="reminder_update",
            summary="Reminder updated",
        )
    return _reminder_out(record)


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteReminder(
    reminder_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    record = db.query(LifeReminder).filter(
        LifeReminder.Id == reminder_id,
        LifeReminder.OwnerUserId == user.Id,
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    if not documents_service.DeleteReminder(db, owner_user_id=user.Id, reminder_id=reminder_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    if record.SourceType == "life_admin_document":
        documents_service.LogDocumentAudit(
            db,
            document_id=record.SourceId,
            actor_user_id=user.Id,
            action="reminder_removed",
            summary="Reminder removed",
        )


@router.post("/documents/{document_id}/ai/apply", response_model=DocumentOut)
def ApplyAiSuggestion(
    document_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DocumentOut:
    record = documents_service.ApplyAiSuggestion(
        db,
        owner_user_id=user.Id,
        document_id=document_id,
        actor_user_id=user.Id,
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    folder_map = {folder.Id: folder.Name for folder in documents_service.ListFolders(db, owner_user_id=user.Id)}
    tags = documents_service.ListDocumentTags(
        db, document_ids=[record.Id], owner_user_id=user.Id
    ).get(record.Id, [])
    link_map = documents_service.ListDocumentLinks(db, document_ids=[record.Id])
    reminder_map = documents_service.ListRemindersForDocuments(
        db, owner_user_id=user.Id, document_ids=[record.Id]
    )
    return _document_out(
        record,
        folder_name=folder_map.get(record.FolderId),
        tags=[_tag_out(tag) for tag in tags],
        link_count=len(link_map.get(record.Id, [])),
        reminder_count=len(reminder_map.get(record.Id, [])),
    )
