from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireAuthenticated, UserContext
from app.modules.auth.schemas import UserOut
from app.modules.notes.schemas import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteTagCreate,
    NoteTaskLinkCreate,
    NoteAssociationCreate,
    NoteItemsReorder
)
from app.modules.notes.services import notes_service


router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("", response_model=List[NoteResponse])
def GetNotes(
    scope: str = Query("personal", regex="^(personal|family|shared)$"),
    archived: bool = Query(False),
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Get notes for user in specified scope."""
    return notes_service.GetNotes(db, user, scope, archived)


@router.get("/share-users", response_model=list[UserOut])
def ListShareUsers(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
):
    """List users available for note sharing."""
    return notes_service.ListShareUsers(db, user)


@router.post("", response_model=NoteResponse, status_code=201)
def CreateNote(
    data: NoteCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Create a new note."""
    return notes_service.CreateNote(db, user, data)


@router.get("/{note_id}", response_model=NoteResponse)
def GetNote(
    note_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Get a single note by ID."""
    return notes_service.GetNoteById(db, user, note_id)


@router.put("/{note_id}", response_model=NoteResponse)
def UpdateNote(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Update an existing note."""
    return notes_service.UpdateNote(db, user, note_id, data)


@router.delete("/{note_id}", status_code=204)
def DeleteNote(
    note_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Delete a note."""
    notes_service.DeleteNote(db, user, note_id)


@router.post("/{note_id}/archive", response_model=NoteResponse)
def ArchiveNote(
    note_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Archive a note."""
    return notes_service.ArchiveNote(db, user, note_id)


@router.post("/{note_id}/unarchive", response_model=NoteResponse)
def UnarchiveNote(
    note_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Unarchive a note."""
    return notes_service.UnarchiveNote(db, user, note_id)


@router.post("/{note_id}/toggle-pin", response_model=NoteResponse)
def TogglePin(
    note_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Toggle note pin status."""
    return notes_service.TogglePin(db, user, note_id)


@router.post("/{note_id}/tags", status_code=204)
def AddTag(
    note_id: int,
    data: NoteTagCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Add a user tag (@mention) to a note."""
    notes_service.AddTag(db, user, note_id, data.UserId)


@router.delete("/{note_id}/tags/{user_id}", status_code=204)
def RemoveTag(
    note_id: int,
    user_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Remove a user tag from a note."""
    notes_service.RemoveTag(db, user, note_id, user_id)


@router.post("/{note_id}/tasks", status_code=204)
def LinkTask(
    note_id: int,
    data: NoteTaskLinkCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Link a task to a note."""
    notes_service.LinkTask(db, user, note_id, data.TaskId)


@router.delete("/{note_id}/tasks/{task_id}", status_code=204)
def UnlinkTask(
    note_id: int,
    task_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Unlink a task from a note."""
    notes_service.UnlinkTask(db, user, note_id, task_id)


@router.post("/{note_id}/associations", status_code=204)
def AddAssociation(
    note_id: int,
    data: NoteAssociationCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Add a module association to a note."""
    notes_service.AddAssociation(db, user, note_id, data.ModuleName, data.RecordId)


@router.delete("/{note_id}/associations/{association_id}", status_code=204)
def RemoveAssociation(
    note_id: int,
    association_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Remove a module association from a note."""
    notes_service.RemoveAssociation(db, user, note_id, association_id)


@router.post("/{note_id}/items/reorder", status_code=204)
def ReorderItems(
    note_id: int,
    data: NoteItemsReorder,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated)
):
    """Reorder note items."""
    notes_service.ReorderItems(db, user, note_id, data.ItemOrders)
