from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext, NowUtc, _require_env
from app.modules.auth.models import RefreshToken, User, UserModuleRole
from app.modules.auth.schemas import (
    UpdateUserPasswordRequest,
    UpdateUserProfileRequest,
    UpdateUserRoleRequest,
    UserOut,
    UserRoleOut,
)
from app.modules.auth.service import HashPassword

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/users", response_model=list[UserOut])
def ListUsers(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=False)),
) -> list[UserOut]:
    users = db.query(User).order_by(User.Username.asc()).all()
    role_map = {}
    for role in db.query(UserModuleRole).all():
        role_map.setdefault(role.UserId, []).append(role)

    results = []
    for entry in users:
        roles = [
            UserRoleOut(ModuleName=role.ModuleName, Role=role.Role)
            for role in role_map.get(entry.Id, [])
        ]
        results.append(
            UserOut(
                Id=entry.Id,
                Username=entry.Username,
                FirstName=entry.FirstName,
                LastName=entry.LastName,
                Email=entry.Email,
                DiscordHandle=entry.DiscordHandle,
                Roles=roles,
                CreatedAt=entry.CreatedAt,
                RequirePasswordChange=entry.RequirePasswordChange,
            )
        )
    return results


@router.put("/users/{user_id}/roles", response_model=UserOut)
def UpdateUserRole(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("settings", write=True)),
) -> UserOut:
    if payload.Role not in {"Admin", "Edit", "Editor", "User", "ReadOnly"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    target = db.query(User).filter(User.Id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    role = (
        db.query(UserModuleRole)
        .filter(UserModuleRole.UserId == target.Id, UserModuleRole.ModuleName == payload.ModuleName)
        .first()
    )
    now = NowUtc()
    if role:
        role.Role = payload.Role
        role.UpdatedAt = now
    else:
        role = UserModuleRole(
            UserId=target.Id,
            ModuleName=payload.ModuleName,
            Role=payload.Role,
            CreatedAt=now,
            UpdatedAt=now,
        )
        db.add(role)
    db.commit()

    roles = [
        UserRoleOut(ModuleName=entry.ModuleName, Role=entry.Role)
        for entry in db.query(UserModuleRole).filter(UserModuleRole.UserId == target.Id).all()
    ]
    return UserOut(
        Id=target.Id,
        Username=target.Username,
        FirstName=target.FirstName,
        LastName=target.LastName,
        Email=target.Email,
        DiscordHandle=target.DiscordHandle,
        Roles=roles,
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

    roles = [
        UserRoleOut(ModuleName=entry.ModuleName, Role=entry.Role)
        for entry in db.query(UserModuleRole).filter(UserModuleRole.UserId == target.Id).all()
    ]
    return UserOut(
        Id=target.Id,
        Username=target.Username,
        FirstName=target.FirstName,
        LastName=target.LastName,
        Email=target.Email,
        DiscordHandle=target.DiscordHandle,
        Roles=roles,
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

    roles = [
        UserRoleOut(ModuleName=entry.ModuleName, Role=entry.Role)
        for entry in db.query(UserModuleRole).filter(UserModuleRole.UserId == target.Id).all()
    ]
    return UserOut(
        Id=target.Id,
        Username=target.Username,
        FirstName=target.FirstName,
        LastName=target.LastName,
        Email=target.Email,
        DiscordHandle=target.DiscordHandle,
        Roles=roles,
        CreatedAt=target.CreatedAt,
        RequirePasswordChange=target.RequirePasswordChange,
    )
