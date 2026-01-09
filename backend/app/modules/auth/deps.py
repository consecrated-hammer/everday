import os
from dataclasses import dataclass
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.models import User, UserModuleRole

ALLOWED_ROLES = {"Admin", "Edit", "Editor", "User", "ReadOnly", "Kid"}


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _decode_access_token(token: str) -> dict:
    secret = _require_env("JWT_SECRET_KEY")
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


@dataclass
class UserContext:
    Id: int
    Username: str
    Roles: dict[str, str]


def RequireAuthenticated(
    request: Request,
    db: Session = Depends(GetDb),
) -> UserContext:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = auth_header.replace("Bearer ", "", 1).strip()
    payload = _decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id = int(user_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = db.query(User).filter(User.Id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    roles = {
        role.ModuleName: role.Role
        for role in db.query(UserModuleRole).filter(UserModuleRole.UserId == user.Id).all()
    }
    return UserContext(Id=user.Id, Username=user.Username, Roles=roles)


def RequireModuleRole(module_name: str, write: bool = False):
    def _checker(user: UserContext = Depends(RequireAuthenticated)) -> UserContext:
        role = user.Roles.get(module_name)
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if write and role == "ReadOnly":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return _checker


def NowUtc() -> datetime:
    return datetime.now(tz=timezone.utc)
