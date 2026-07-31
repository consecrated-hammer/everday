from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import NowUtc
from app.modules.auth.models import ApiToken, User
from app.modules.auth.service import HashApiKey, VerifyApiKey


HEALTH_DASHBOARD_READ_SCOPE = "health:dashboard:read"


class ApiTokenRequestError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass(frozen=True)
class ApiTokenContext:
    TokenId: str
    UserId: int
    Scopes: frozenset[str]


def _LookupHash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _ParseScopes(value: str) -> frozenset[str]:
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return frozenset()
    if not isinstance(parsed, list):
        return frozenset()
    return frozenset(str(item) for item in parsed if isinstance(item, str))


def CreateApiToken(
    db: Session,
    user_id: int,
    name: str,
    scopes: set[str],
    expires_at: datetime | None = None,
) -> tuple[ApiToken, str]:
    cleaned_name = " ".join(name.split())
    if not cleaned_name or len(cleaned_name) > 100:
        raise ValueError("Token name must be between 1 and 100 characters.")
    if not scopes:
        raise ValueError("At least one scope is required.")

    plaintext = f"evd_{secrets.token_urlsafe(32)}"
    record = ApiToken(
        Id=str(uuid.uuid4()),
        UserId=user_id,
        Name=cleaned_name,
        TokenHash=HashApiKey(plaintext),
        LookupHash=_LookupHash(plaintext),
        Scopes=json.dumps(sorted(scopes)),
        CreatedAt=NowUtc(),
        ExpiresAt=expires_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, plaintext


def RevokeApiToken(db: Session, token_id: str, user_id: int | None = None) -> bool:
    query = db.query(ApiToken).filter(ApiToken.Id == token_id)
    if user_id is not None:
        query = query.filter(ApiToken.UserId == user_id)
    record = query.first()
    if record is None or record.RevokedAt is not None:
        return False
    record.RevokedAt = NowUtc()
    db.add(record)
    db.commit()
    return True


def ListApiTokens(db: Session, user_id: int) -> list[ApiToken]:
    return db.query(ApiToken).filter(ApiToken.UserId == user_id).order_by(ApiToken.CreatedAt.desc()).all()


def _Unauthorized() -> ApiTokenRequestError:
    return ApiTokenRequestError(status.HTTP_401_UNAUTHORIZED, "unauthorised", "A valid API token is required.")


def RequireApiToken(required_scope: str):
    def _checker(request: Request, db: Session = Depends(GetDb)) -> ApiTokenContext:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise _Unauthorized()
        plaintext = auth_header.removeprefix("Bearer ").strip()
        if not plaintext.startswith("evd_") or not plaintext:
            raise _Unauthorized()

        record = db.query(ApiToken).filter(ApiToken.LookupHash == _LookupHash(plaintext)).first()
        now = NowUtc()
        if (
            record is None
            or record.RevokedAt is not None
            or (record.ExpiresAt is not None and record.ExpiresAt <= now)
            or not VerifyApiKey(plaintext, record.TokenHash)
        ):
            raise _Unauthorized()

        scopes = _ParseScopes(record.Scopes)
        if required_scope not in scopes:
            raise ApiTokenRequestError(
                status.HTTP_403_FORBIDDEN, "forbidden", "API token lacks the required scope."
            )

        user = db.query(User).filter(User.Id == record.UserId).first()
        if user is None or user.IsApproved == False:
            raise _Unauthorized()

        record.LastUsedAt = now
        db.add(record)
        db.commit()
        return ApiTokenContext(TokenId=record.Id, UserId=user.Id, Scopes=scopes)

    return _checker
