from datetime import datetime
from typing import List
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.modules.auth.deps import UserContext
from app.modules.notes.models import Note, NoteItem, NoteTag, NoteTaskLink, NoteAssociation
from app.modules.auth.models import User
from app.modules.auth.schemas import UserOut
from app.modules.notes.schemas import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteItemResponse,
    NoteAssociationResponse
)
from app.modules.notes.services import label_service
from app.modules.notes.utils import rbac
from app.modules.notifications.services import CreateNotification


def _ResolveShareUserIds(db: Session, user_ids: List[int]) -> List[int]:
    unique_ids = sorted({int(value) for value in (user_ids or []) if value})
    if not unique_ids:
        return []
    found = db.query(User.Id).filter(User.Id.in_(unique_ids)).all()
    found_ids = {row.Id for row in found}
    if found_ids != set(unique_ids):
        raise HTTPException(status_code=400, detail="User not found")
    return unique_ids


def _BuildNoteQuery(db: Session, user: UserContext):
    query = db.query(Note)
    if rbac.IsAdmin(user):
        return query
    return (
        query.join(
            NoteTag,
            NoteTag.NoteId == Note.Id,
            isouter=True,
        )
        .filter(or_(Note.UserId == user.Id, NoteTag.UserId == user.Id))
        .distinct()
    )


def _NotifySharedUsers(
    db: Session,
    *,
    note_id: int,
    note_title: str,
    share_user_ids: List[int],
    created_by_user_id: int,
    created_by_username: str | None,
    labels_json: str | None,
) -> None:
    if not share_user_ids:
        return
    labels = label_service.ParseLabels(labels_json)
    scope = label_service.GetScope(labels)
    for user_id in share_user_ids:
        if user_id == created_by_user_id:
            continue
        actor_name = created_by_username or f"User {created_by_user_id}"
        CreateNotification(
            db,
            user_id=user_id,
            created_by_user_id=created_by_user_id,
            title="Note shared with you",
            body=f'{actor_name} shared "{note_title or "Note"}"',
            notification_type="General",
            link_url=f"/notes/{scope}",
            source_module="notes",
            source_id=str(note_id),
            meta={"NoteId": note_id},
        )


def _BuildNoteResponse(note: Note) -> NoteResponse:
    """Build NoteResponse from Note model."""
    labels = label_service.ParseLabels(note.Labels)
    
    items = [
        NoteItemResponse(
            Id=item.Id,
            Text=item.Text,
            Checked=item.Checked,
            OrderIndex=item.OrderIndex,
            CreatedAt=item.CreatedAt,
            UpdatedAt=item.UpdatedAt
        )
        for item in sorted(note.items, key=lambda x: x.OrderIndex)
    ]
    
    tags = [tag.UserId for tag in note.tags]
    task_ids = [link.TaskId for link in note.task_links]
    associations = [
        {"Id": assoc.Id, "ModuleName": assoc.ModuleName, "RecordId": assoc.RecordId}
        for assoc in note.associations
    ]
    
    return NoteResponse(
        Id=note.Id,
        UserId=note.UserId,
        Title=note.Title,
        Content=note.Content,
        Labels=labels,
        IsPinned=note.IsPinned,
        Items=items,
        Tags=tags,
        TaskIds=task_ids,
        Associations=associations,
        ArchivedAt=note.ArchivedAt,
        CreatedAt=note.CreatedAt,
        UpdatedAt=note.UpdatedAt
    )


def GetNotes(
    db: Session,
    user: UserContext,
    scope: str = "personal",
    archived: bool = False
) -> List[NoteResponse]:
    """Get notes for user in specified scope."""
    query = _BuildNoteQuery(db, user)
    
    # Filter by scope
    if scope == "personal":
        tagged_note_ids = db.query(NoteTag.NoteId)
        query = query.filter(
            or_(
                Note.Labels.is_(None),
                and_(
                    ~Note.Labels.like('%"everday:family"%'),
                    ~Note.Labels.like('%"everday:shared"%')
                )
            )
        ).filter(~Note.Id.in_(tagged_note_ids))
    elif scope == "family":
        # Family: any parent can access
        query = query.filter(Note.Labels.like('%"everday:family"%'))
    elif scope == "shared":
        # Shared: owner, tagged, or any user
        shared_tag_ids = db.query(NoteTag.NoteId)
        query = query.filter(
            or_(
                Note.Labels.like('%"everday:shared"%'),
                Note.Id.in_(shared_tag_ids)
            )
        )
    
    # Filter by archived status
    if archived:
        query = query.filter(Note.ArchivedAt.isnot(None))
    else:
        query = query.filter(Note.ArchivedAt.is_(None))
    
    # Order by pinned, then updated
    query = query.order_by(Note.IsPinned.desc(), Note.UpdatedAt.desc())
    
    notes = query.all()
    return [_BuildNoteResponse(note) for note in notes if rbac.CanViewNote(user, note)]


def GetNoteById(db: Session, user: UserContext, note_id: int) -> NoteResponse:
    """Get single note by ID."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanViewNote(user, note):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _BuildNoteResponse(note)


def CreateNote(db: Session, user: UserContext, data: NoteCreate) -> NoteResponse:
    """Create a new note."""
    labels = data.Labels or []
    share_user_ids = _ResolveShareUserIds(db, data.SharedUserIds)
    if share_user_ids:
        labels = label_service.SetScope(labels, "shared")
    scope = label_service.GetScope(labels)
    
    if not rbac.CanCreateInScope(user, scope):
        raise HTTPException(status_code=403, detail=f"Cannot create {scope} notes")
    
    # Ensure owner label
    labels = label_service.AddOwnerLabel(labels, user.Id)
    
    note = Note(
        UserId=user.Id,
        Title=data.Title,
        Content=data.Content,
        Labels=label_service.SerializeLabels(labels),
        IsPinned=data.IsPinned
    )
    
    db.add(note)
    db.flush()
    
    # Add items
    for item_data in data.Items:
        item = NoteItem(
            NoteId=note.Id,
            Text=item_data.Text,
            Checked=item_data.Checked,
            OrderIndex=item_data.OrderIndex
        )
        db.add(item)

    for user_id in share_user_ids:
        db.add(NoteTag(NoteId=note.Id, UserId=user_id))
    
    db.commit()
    db.refresh(note)
    if share_user_ids:
        _NotifySharedUsers(
            db,
            note_id=note.Id,
            note_title=note.Title,
            share_user_ids=share_user_ids,
            created_by_user_id=user.Id,
            created_by_username=user.Username,
            labels_json=note.Labels,
        )
    return _BuildNoteResponse(note)


def UpdateNote(db: Session, user: UserContext, note_id: int, data: NoteUpdate) -> NoteResponse:
    """Update an existing note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot edit this note")
    
    # Update basic fields
    note.Title = data.Title
    note.Content = data.Content
    note.IsPinned = data.IsPinned
    note.UpdatedAt = datetime.utcnow()
    
    # Update labels with scope validation
    new_labels = data.Labels or []
    share_user_ids = None
    if data.SharedUserIds is not None:
        share_user_ids = _ResolveShareUserIds(db, data.SharedUserIds)
        if share_user_ids:
            new_labels = label_service.SetScope(new_labels, "shared")
        elif label_service.GetScope(new_labels) == "shared":
            new_labels = label_service.SetScope(new_labels, "personal")
    new_scope = label_service.GetScope(new_labels)
    if not rbac.CanCreateInScope(user, new_scope):
        raise HTTPException(status_code=403, detail=f"Cannot change to {new_scope} scope")
    
    new_labels = label_service.AddOwnerLabel(new_labels, note.UserId)
    note.Labels = label_service.SerializeLabels(new_labels)
    
    # Update items: delete removed, update existing, add new
    existing_item_ids = {item.Id for item in note.items}
    updated_item_ids = {item.Id for item in data.Items if item.Id}
    
    # Delete removed items
    for item in note.items:
        if item.Id not in updated_item_ids:
            db.delete(item)
    
    # Update or add items
    for item_data in data.Items:
        if item_data.Id and item_data.Id in existing_item_ids:
            # Update existing
            item = db.query(NoteItem).filter(NoteItem.Id == item_data.Id).first()
            item.Text = item_data.Text
            item.Checked = item_data.Checked
            item.OrderIndex = item_data.OrderIndex
            item.UpdatedAt = datetime.utcnow()
        else:
            # Add new
            item = NoteItem(
                NoteId=note.Id,
                Text=item_data.Text,
                Checked=item_data.Checked,
                OrderIndex=item_data.OrderIndex
            )
            db.add(item)

    newly_shared_ids: List[int] = []
    if share_user_ids is not None:
        existing_ids = {tag.UserId for tag in note.tags}
        db.query(NoteTag).filter(NoteTag.NoteId == note.Id).delete()
        for user_id in share_user_ids:
            db.add(NoteTag(NoteId=note.Id, UserId=user_id))
        newly_shared_ids = sorted(set(share_user_ids) - existing_ids)
    
    db.commit()
    db.refresh(note)
    if newly_shared_ids:
        _NotifySharedUsers(
            db,
            note_id=note.Id,
            note_title=note.Title,
            share_user_ids=newly_shared_ids,
            created_by_user_id=user.Id,
            created_by_username=user.Username,
            labels_json=note.Labels,
        )
    return _BuildNoteResponse(note)


def DeleteNote(db: Session, user: UserContext, note_id: int) -> None:
    """Delete a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanDeleteNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot delete this note")
    
    db.delete(note)
    db.commit()


def ArchiveNote(db: Session, user: UserContext, note_id: int) -> NoteResponse:
    """Archive a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot archive this note")
    
    note.ArchivedAt = datetime.utcnow()
    note.UpdatedAt = datetime.utcnow()
    
    db.commit()
    db.refresh(note)
    
    return _BuildNoteResponse(note)


def UnarchiveNote(db: Session, user: UserContext, note_id: int) -> NoteResponse:
    """Unarchive a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot unarchive this note")
    
    note.ArchivedAt = None
    note.UpdatedAt = datetime.utcnow()
    
    db.commit()
    db.refresh(note)
    
    return _BuildNoteResponse(note)


def TogglePin(db: Session, user: UserContext, note_id: int) -> NoteResponse:
    """Toggle note pin status."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot pin/unpin this note")
    
    note.IsPinned = not note.IsPinned
    note.UpdatedAt = datetime.utcnow()
    
    db.commit()
    db.refresh(note)
    
    return _BuildNoteResponse(note)


def AddTag(db: Session, user: UserContext, note_id: int, tagged_user_id: int) -> None:
    """Add a user tag (@mention) to a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot tag users in this note")
    
    existing_ids = {tag.UserId for tag in note.tags}
    share_user_ids = sorted(existing_ids | {tagged_user_id})
    share_user_ids = _ResolveShareUserIds(db, share_user_ids)
    new_ids = sorted(set(share_user_ids) - existing_ids)

    db.query(NoteTag).filter(NoteTag.NoteId == note.Id).delete()
    for user_id in share_user_ids:
        db.add(NoteTag(NoteId=note.Id, UserId=user_id))
    labels = label_service.ParseLabels(note.Labels)
    labels = label_service.SetScope(labels, "shared")
    note.Labels = label_service.SerializeLabels(labels)
    note.UpdatedAt = datetime.utcnow()
    db.commit()

    if new_ids:
        _NotifySharedUsers(
            db,
            note_id=note.Id,
            note_title=note.Title,
            share_user_ids=new_ids,
            created_by_user_id=user.Id,
            created_by_username=user.Username,
            labels_json=note.Labels,
        )


def RemoveTag(db: Session, user: UserContext, note_id: int, tagged_user_id: int) -> None:
    """Remove a user tag from a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot untag users in this note")
    
    existing_ids = {tag.UserId for tag in note.tags}
    if tagged_user_id not in existing_ids:
        return
    share_user_ids = sorted({user_id for user_id in existing_ids if user_id != tagged_user_id})

    db.query(NoteTag).filter(NoteTag.NoteId == note.Id).delete()
    for user_id in share_user_ids:
        db.add(NoteTag(NoteId=note.Id, UserId=user_id))
    labels = label_service.ParseLabels(note.Labels)
    if share_user_ids:
        labels = label_service.SetScope(labels, "shared")
    elif label_service.GetScope(labels) == "shared":
        labels = label_service.SetScope(labels, "personal")
    note.Labels = label_service.SerializeLabels(labels)
    note.UpdatedAt = datetime.utcnow()
    db.commit()


def LinkTask(db: Session, user: UserContext, note_id: int, task_id: int) -> None:
    """Link a task to a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot link tasks to this note")
    
    # Check if link already exists
    existing = db.query(NoteTaskLink).filter(
        and_(NoteTaskLink.NoteId == note_id, NoteTaskLink.TaskId == task_id)
    ).first()
    
    if existing:
        return  # Already linked
    
    link = NoteTaskLink(NoteId=note_id, TaskId=task_id)
    db.add(link)
    db.commit()


def UnlinkTask(db: Session, user: UserContext, note_id: int, task_id: int) -> None:
    """Unlink a task from a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot unlink tasks from this note")
    
    link = db.query(NoteTaskLink).filter(
        and_(NoteTaskLink.NoteId == note_id, NoteTaskLink.TaskId == task_id)
    ).first()
    
    if link:
        db.delete(link)
        db.commit()


def AddAssociation(
    db: Session,
    user: UserContext,
    note_id: int,
    module_name: str,
    record_id: int
) -> None:
    """Add a module association to a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot add associations to this note")
    
    # Check if association already exists
    existing = db.query(NoteAssociation).filter(
        and_(
            NoteAssociation.NoteId == note_id,
            NoteAssociation.ModuleName == module_name,
            NoteAssociation.RecordId == record_id
        )
    ).first()
    
    if existing:
        return  # Already associated
    
    assoc = NoteAssociation(
        NoteId=note_id,
        ModuleName=module_name,
        RecordId=record_id
    )
    db.add(assoc)
    db.commit()


def RemoveAssociation(db: Session, user: UserContext, note_id: int, association_id: int) -> None:
    """Remove a module association from a note."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot remove associations from this note")
    
    assoc = db.query(NoteAssociation).filter(
        and_(
            NoteAssociation.Id == association_id,
            NoteAssociation.NoteId == note_id
        )
    ).first()
    
    if assoc:
        db.delete(assoc)
        db.commit()


def ReorderItems(db: Session, user: UserContext, note_id: int, item_orders: List[dict]) -> None:
    """Reorder note items."""
    note = db.query(Note).filter(Note.Id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not rbac.CanEditNote(user, note):
        raise HTTPException(status_code=403, detail="Cannot reorder items in this note")
    
    for order_data in item_orders:
        item_id = order_data.get("Id")
        new_order = order_data.get("OrderIndex")
        
        if item_id is None or new_order is None:
            continue
        
        item = db.query(NoteItem).filter(
            and_(NoteItem.Id == item_id, NoteItem.NoteId == note_id)
        ).first()
        
        if item:
            item.OrderIndex = new_order
            item.UpdatedAt = datetime.utcnow()
    
    note.UpdatedAt = datetime.utcnow()
    db.commit()


def ListShareUsers(db: Session, user: UserContext) -> List[UserOut]:
    """List users available for sharing notes."""
    records = db.query(User).order_by(User.Username.asc()).all()
    return [
        UserOut(
            Id=entry.Id,
            Username=entry.Username,
            FirstName=entry.FirstName,
            LastName=entry.LastName,
            Email=entry.Email,
            DiscordHandle=entry.DiscordHandle,
            Role=entry.Role,
            CreatedAt=entry.CreatedAt,
            RequirePasswordChange=entry.RequirePasswordChange,
        )
        for entry in records
    ]
