from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext, NowUtc, _require_env
from app.modules.auth.models import RefreshToken, User
from app.modules.kids.models import KidLink
from app.modules.auth.schemas import (
    CreateUserRequest,
    UpdateUserPasswordRequest,
    UpdateUserProfileRequest,
    UpdateUserRoleRequest,
    UserOut,
)
from app.modules.auth.service import HashPassword

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/users", response_model=list[UserOut])
def ListUsers(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=False)),
) -> list[UserOut]:
    users = db.query(User).order_by(User.Username.asc()).all()
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
        for entry in users
    ]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def CreateUser(
    payload: CreateUserRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=True)),
) -> UserOut:
    username = payload.Username.strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username required")
    existing = db.query(User).filter(User.Username == username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    min_length = int(_require_env("AUTH_PASSWORD_MIN_LENGTH"))
    if len(payload.Password) < min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {min_length} characters",
        )

    role = payload.Role.strip() if payload.Role else "Kid"
    if role not in {"Parent", "Kid"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    record = User(
        Username=username,
        PasswordHash=HashPassword(payload.Password),
        FirstName=payload.FirstName.strip() if payload.FirstName else None,
        LastName=payload.LastName.strip() if payload.LastName else None,
        Email=payload.Email.strip().lower() if payload.Email else None,
        DiscordHandle=payload.DiscordHandle.strip() if payload.DiscordHandle else None,
        Role=role,
        RequirePasswordChange=payload.RequirePasswordChange,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return UserOut(
        Id=record.Id,
        Username=record.Username,
        FirstName=record.FirstName,
        LastName=record.LastName,
        Email=record.Email,
        DiscordHandle=record.DiscordHandle,
        Role=record.Role,
        CreatedAt=record.CreatedAt,
        RequirePasswordChange=record.RequirePasswordChange,
    )


@router.put("/users/{user_id}/roles", response_model=UserOut)
def UpdateUserRole(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=True)),
) -> UserOut:
    if payload.Role not in {"Parent", "Kid"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    target = db.query(User).filter(User.Id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.Role = payload.Role
    if payload.Role == "Kid":
        existing_link = (
            db.query(KidLink)
            .filter(KidLink.ParentUserId == user.Id, KidLink.KidUserId == target.Id)
            .first()
        )
        if not existing_link:
            db.add(KidLink(ParentUserId=user.Id, KidUserId=target.Id))
    else:
        db.query(KidLink).filter(KidLink.KidUserId == target.Id).delete()
    db.commit()

    return UserOut(
        Id=target.Id,
        Username=target.Username,
        FirstName=target.FirstName,
        LastName=target.LastName,
        Email=target.Email,
        DiscordHandle=target.DiscordHandle,
        Role=target.Role,
        CreatedAt=target.CreatedAt,
        RequirePasswordChange=target.RequirePasswordChange,
    )


@router.put("/users/{user_id}/password", response_model=UserOut)
def UpdateUserPassword(
    user_id: int,
    payload: UpdateUserPasswordRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=True)),
) -> UserOut:
    min_length = int(_require_env("AUTH_PASSWORD_MIN_LENGTH"))
    if len(payload.NewPassword) < min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {min_length} characters",
        )

    target = db.query(User).filter(User.Id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.PasswordHash = HashPassword(payload.NewPassword)
    target.RequirePasswordChange = True
    target.FailedLoginCount = 0
    target.LockedUntil = None

    tokens = db.query(RefreshToken).filter(RefreshToken.UserId == target.Id, RefreshToken.RevokedAt.is_(None)).all()
    for token in tokens:
        token.RevokedAt = NowUtc()
        db.add(token)

    db.add(target)
    db.commit()

    return UserOut(
        Id=target.Id,
        Username=target.Username,
        FirstName=target.FirstName,
        LastName=target.LastName,
        Email=target.Email,
        DiscordHandle=target.DiscordHandle,
        Role=target.Role,
        CreatedAt=target.CreatedAt,
        RequirePasswordChange=target.RequirePasswordChange,
    )


@router.put("/users/{user_id}/profile", response_model=UserOut)
def UpdateUserProfile(
    user_id: int,
    payload: UpdateUserProfileRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=True)),
) -> UserOut:
    target = db.query(User).filter(User.Id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.FirstName = payload.FirstName.strip() if payload.FirstName else None
    target.LastName = payload.LastName.strip() if payload.LastName else None
    target.Email = payload.Email.strip().lower() if payload.Email else None
    target.DiscordHandle = payload.DiscordHandle.strip() if payload.DiscordHandle else None

    db.add(target)
    db.commit()

    return UserOut(
        Id=target.Id,
        Username=target.Username,
        FirstName=target.FirstName,
        LastName=target.LastName,
        Email=target.Email,
        DiscordHandle=target.DiscordHandle,
        Role=target.Role,
        CreatedAt=target.CreatedAt,
        RequirePasswordChange=target.RequirePasswordChange,
    )
