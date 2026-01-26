from app.modules.auth.deps import UserContext
from app.modules.notes.models import Note
AdminRoles = {"Parent"}


def IsAdmin(user: UserContext) -> bool:
    return user.Role in AdminRoles


def CanViewNote(user: UserContext, note: Note) -> bool:
    """Check if user can view note."""
    # Admin can view all
    if IsAdmin(user):
        return True

    # Owner can always view
    if note.UserId == user.Id:
        return True
    
    # Check if user is tagged
    for tag in note.tags:
        if tag.UserId == user.Id:
            return True
    
    return False


def CanEditNote(user: UserContext, note: Note) -> bool:
    """Check if user can edit note."""
    # Owner can always edit
    return note.UserId == user.Id


def CanDeleteNote(user: UserContext, note: Note) -> bool:
    """Check if user can delete note."""
    # Only owner can delete notes in all scopes
    return note.UserId == user.Id


def CanCreateInScope(user: UserContext, scope: str) -> bool:
    """Check if user can create notes in specified scope."""
    if scope == "personal":
        return True  # Anyone can create personal notes
    elif scope == "family":
        return user.Role == "Parent"  # Only parents can create family notes
    elif scope == "shared":
        return True  # Anyone can create shared notes
    
    return False
