"""Gmail intake service for life-admin documents."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.integrations.gmail import service as gmail_service
from app.modules.integrations.gmail.models import GmailIntegration
from app.modules.life_admin.document_storage import SaveBytes
from app.modules.life_admin.models import DocumentFolder, GmailIntakeRun
from app.modules.life_admin import documents_service


def CanStartIntake(db: Session, *, owner_user_id: int, min_seconds: int) -> bool:
    if min_seconds <= 0:
        return True
    latest = (
        db.query(GmailIntakeRun)
        .filter(GmailIntakeRun.OwnerUserId == owner_user_id)
        .order_by(GmailIntakeRun.StartedAt.desc())
        .first()
    )
    if not latest or latest.Result != "Running":
        return True
    age_seconds = (NowUtc() - latest.StartedAt).total_seconds()
    if age_seconds < min_seconds:
        return False
    latest.Result = "Failed"
    latest.ErrorMessage = "Previous Gmail intake run did not finish."
    latest.FinishedAt = NowUtc()
    latest.UpdatedAt = NowUtc()
    db.add(latest)
    db.commit()
    return True


def RunGmailIntake(
    db: Session,
    *,
    owner_user_id: int,
    max_messages: int = 10,
    triggered_by_user_id: int | None = None,
) -> tuple[dict, list[int]]:
    record = db.query(GmailIntegration).first()
    if not record:
        raise ValueError("Gmail integration not connected. Authenticate first.")
    if not record.RefreshToken:
        raise ValueError("Missing Gmail refresh token.")

    resolved_owner_id = owner_user_id or record.ConnectedByUserId
    if not resolved_owner_id:
        raise ValueError("Owner user not resolved for Gmail intake.")

    run = _start_run(db, owner_user_id=resolved_owner_id, triggered_by_user_id=triggered_by_user_id)

    documents_created = 0
    processed_messages = 0
    attachment_errors: list[str] = []
    created_ids: list[int] = []

    try:
        config = gmail_service.LoadGmailConfig()
        token = gmail_service.RefreshAccessToken(config, record.RefreshToken)
        user_id = record.AccountEmail or config.UserId or "me"
        inbox_label_id = gmail_service.ResolveLabelId(token, user_id, config.InboxLabel)
        processed_label_id = gmail_service.ResolveLabelId(token, user_id, config.ProcessedLabel)
        if config.InboxLabel and not inbox_label_id:
            raise ValueError("Gmail inbox label not found")

        message_ids = gmail_service.ListMessages(
            token,
            user_id,
            inbox_label_id,
            max_results=max_messages,
            query=config.IntakeQuery,
        )

        for message_id in message_ids:
            message = gmail_service.FetchMessage(token, user_id, message_id)
            subject = gmail_service.ExtractSubject(message)
            snippet = gmail_service.ExtractSnippet(message)
            hints = gmail_service.ParseHints(f"{subject}\n{snippet}")
            folder_id = _resolve_folder_id(db, resolved_owner_id, hints.get("folder"))
            tags = hints.get("tags") or []
            links = hints.get("links") or []

            attachments = gmail_service.ExtractAttachments(message)
            for attachment in attachments:
                attachment_id = attachment.get("attachmentId")
                filename = attachment.get("filename")
                mime_type = attachment.get("mimeType")
                if not attachment_id:
                    continue
                try:
                    data = gmail_service.FetchAttachment(token, user_id, message_id, attachment_id)
                    stored = SaveBytes(
                        data=data,
                        owner_user_id=resolved_owner_id,
                        filename=filename,
                        content_type=mime_type,
                    )
                    document = documents_service.CreateDocument(
                        db,
                        owner_user_id=resolved_owner_id,
                        created_by_user_id=resolved_owner_id,
                        title=filename or subject or "Email attachment",
                        folder_id=folder_id,
                        storage_path=stored.StoragePath,
                        file_size_bytes=stored.FileSizeBytes,
                        content_type=stored.ContentType,
                        original_filename=stored.OriginalFileName,
                        file_hash=stored.Hash,
                        source_type="email",
                        source_detail=f"{message_id}:{attachment_id}",
                    )
                    if tags:
                        documents_service.SetDocumentTags(
                            db,
                            owner_user_id=resolved_owner_id,
                            document_id=document.Id,
                            tag_names=tags,
                        )
                    for link_id in links:
                        try:
                            documents_service.AddDocumentLink(
                                db,
                                owner_user_id=resolved_owner_id,
                                document_id=document.Id,
                                linked_entity_type=documents_service.LINK_TYPE_LIFE_RECORD,
                                linked_entity_id=link_id,
                                created_by_user_id=resolved_owner_id,
                            )
                        except ValueError:
                            continue
                    documents_service.LogDocumentAudit(
                        db,
                        document_id=document.Id,
                        actor_user_id=resolved_owner_id,
                        action="created",
                        summary="Document ingested from Gmail",
                    )
                    documents_created += 1
                    created_ids.append(document.Id)
                except Exception as exc:  # noqa: BLE001
                    attachment_errors.append(str(exc))
                    continue

            if processed_label_id:
                gmail_service.ModifyMessageLabels(
                    token,
                    user_id,
                    message_id,
                    add_label_ids=[processed_label_id],
                    remove_label_ids=[inbox_label_id] if inbox_label_id else None,
                )
            processed_messages += 1

        _finish_run(
            db,
            run,
            result="Success",
            messages_processed=processed_messages,
            documents_created=documents_created,
            attachment_errors=len(attachment_errors),
            error_message=None,
        )
    except Exception as exc:
        _finish_run(
            db,
            run,
            result="Failed",
            messages_processed=processed_messages,
            documents_created=documents_created,
            attachment_errors=len(attachment_errors),
            error_message=str(exc),
        )
        raise

    return (
        {
            "MessagesProcessed": processed_messages,
            "DocumentsCreated": documents_created,
            "AttachmentErrors": attachment_errors,
        },
        created_ids,
    )


def _resolve_folder_id(db: Session, owner_user_id: int, name: str | None) -> int | None:
    if not name:
        return None
    folder = (
        db.query(DocumentFolder)
        .filter(
            DocumentFolder.OwnerUserId == owner_user_id,
            func.lower(DocumentFolder.Name) == name.strip().lower(),
        )
        .first()
    )
    if folder:
        return folder.Id
    created = documents_service.CreateFolder(db, owner_user_id=owner_user_id, name=name.strip())
    return created.Id


def _start_run(
    db: Session,
    *,
    owner_user_id: int,
    triggered_by_user_id: int | None,
) -> GmailIntakeRun:
    now = NowUtc()
    run = GmailIntakeRun(
        OwnerUserId=owner_user_id,
        RunDate=now.date(),
        StartedAt=now,
        Result="Running",
        MessagesProcessed=0,
        DocumentsCreated=0,
        AttachmentErrors=0,
        TriggeredByUserId=triggered_by_user_id,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _finish_run(
    db: Session,
    run: GmailIntakeRun,
    *,
    result: str,
    messages_processed: int,
    documents_created: int,
    attachment_errors: int,
    error_message: str | None,
) -> None:
    now = NowUtc()
    run.Result = result
    run.MessagesProcessed = messages_processed
    run.DocumentsCreated = documents_created
    run.AttachmentErrors = attachment_errors
    run.ErrorMessage = error_message
    run.FinishedAt = now
    run.UpdatedAt = now
    db.add(run)
    db.commit()
