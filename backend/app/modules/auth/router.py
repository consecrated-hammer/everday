from datetime import timedelta
import logging

import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import NowUtc, RequireAuthenticated, UserContext, _require_env
from app.modules.auth.email import SendPasswordResetEmail
from app.modules.auth.models import PasswordResetToken, RefreshToken, User
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.modules.auth.service import (
    CreateAccessToken,
    CreatePasswordResetToken,
    CreateRefreshToken,
    HashPasswordResetToken,
    HashRefreshToken,
    HashPassword,
    VerifyPassword,
    VerifyPasswordResetToken,
    VerifyRefreshToken,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("app.auth")


@router.post("/login", response_model=TokenResponse)
def Login(payload: LoginRequest, db: Session = Depends(GetDb)) -> TokenResponse:
    user = db.query(User).filter(User.Username == payload.Username).first()
    now = NowUtc()
    if user and user.LockedUntil and user.LockedUntil > now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account locked. Try again later.")

    if not user or not VerifyPassword(payload.Password, user.PasswordHash):
        if user:
            max_attempts = int(_require_env("AUTH_LOGIN_MAX_ATTEMPTS"))
            lockout_minutes = int(_require_env("AUTH_LOGIN_LOCKOUT_MINUTES"))
            user.FailedLoginCount += 1
            if user.FailedLoginCount >= max_attempts:
                user.LockedUntil = now + timedelta(minutes=lockout_minutes)
                user.FailedLoginCount = 0
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.FailedLoginCount = 0
    user.LockedUntil = None

    access_token, expires_in = CreateAccessToken(user.Id, user.Username)
    refresh_token = CreateRefreshToken()
    refresh_hash = HashRefreshToken(refresh_token)
    refresh_ttl_days = int(_require_env("JWT_REFRESH_TTL_DAYS"))
    expires_at = now + timedelta(days=refresh_ttl_days)

    record = RefreshToken(
        UserId=user.Id,
        TokenHash=refresh_hash,
        ExpiresAt=expires_at,
    )
    db.add(record)
    db.commit()

    return TokenResponse(
        AccessToken=access_token,
        RefreshToken=refresh_token,
        ExpiresIn=expires_in,
        Username=user.Username,
        RequirePasswordChange=user.RequirePasswordChange,
        Role=user.Role,
        FirstName=user.FirstName,
        LastName=user.LastName,
        Email=user.Email,
        DiscordHandle=user.DiscordHandle,
    )


@router.post("/refresh", response_model=TokenResponse)
def Refresh(payload: RefreshRequest, db: Session = Depends(GetDb)) -> TokenResponse:
    now = NowUtc()
    tokens = (
        db.query(RefreshToken)
        .filter(RefreshToken.RevokedAt.is_(None), RefreshToken.ExpiresAt > now)
        .all()
    )
    matched = None
    for token in tokens:
        if VerifyRefreshToken(payload.RefreshToken, token.TokenHash):
            matched = token
            break

    if not matched:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.Id == matched.UserId).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    matched.RevokedAt = now
    access_token, expires_in = CreateAccessToken(user.Id, user.Username)
    refresh_token = CreateRefreshToken()
    refresh_hash = HashRefreshToken(refresh_token)
    refresh_ttl_days = int(_require_env("JWT_REFRESH_TTL_DAYS"))
    expires_at = now + timedelta(days=refresh_ttl_days)

    db.add(
        RefreshToken(
            UserId=user.Id,
            TokenHash=refresh_hash,
            ExpiresAt=expires_at,
        )
    )
    db.commit()

    return TokenResponse(
        AccessToken=access_token,
        RefreshToken=refresh_token,
        ExpiresIn=expires_in,
        Username=user.Username,
        RequirePasswordChange=user.RequirePasswordChange,
        Role=user.Role,
        FirstName=user.FirstName,
        LastName=user.LastName,
        Email=user.Email,
        DiscordHandle=user.DiscordHandle,
    )


@router.post("/logout")
def Logout(payload: RefreshRequest, user: UserContext = Depends(RequireAuthenticated), db: Session = Depends(GetDb)) -> dict:
    tokens = db.query(RefreshToken).filter(RefreshToken.UserId == user.Id, RefreshToken.RevokedAt.is_(None)).all()
    for token in tokens:
        if VerifyRefreshToken(payload.RefreshToken, token.TokenHash):
            token.RevokedAt = NowUtc()
            db.add(token)
            db.commit()
            return {"status": "ok"}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Refresh token not found")


@router.post("/change-password")
def ChangePassword(
    payload: ChangePasswordRequest,
    user: UserContext = Depends(RequireAuthenticated),
    db: Session = Depends(GetDb),
) -> dict:
    min_length = int(_require_env("AUTH_PASSWORD_MIN_LENGTH"))
    if len(payload.NewPassword) < min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {min_length} characters",
        )

    record = db.query(User).filter(User.Id == user.Id).first()
    if not record or not VerifyPassword(payload.CurrentPassword, record.PasswordHash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    record.PasswordHash = HashPassword(payload.NewPassword)
    record.RequirePasswordChange = False
    record.FailedLoginCount = 0
    record.LockedUntil = None

    tokens = db.query(RefreshToken).filter(RefreshToken.UserId == record.Id, RefreshToken.RevokedAt.is_(None)).all()
    for token in tokens:
        token.RevokedAt = NowUtc()
        db.add(token)

    db.add(record)
    db.commit()
    return {"status": "ok"}


@router.post("/forgot")
def ForgotPassword(payload: ForgotPasswordRequest, db: Session = Depends(GetDb)) -> dict:
    identifier = payload.Identifier.strip()
    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter your username or email.")

    identifier_lower = identifier.lower()
    user = (
        db.query(User)
        .filter((User.Username == identifier) | (User.Email == identifier_lower))
        .first()
    )
    if not user:
        return {"status": "ok"}

    if not user.Email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address not set for this user.",
        )

    ttl_minutes = int(_require_env("AUTH_RESET_TTL_MINUTES"))
    token = CreatePasswordResetToken()
    token_hash = HashPasswordResetToken(token)
    expires_at = NowUtc() + timedelta(minutes=ttl_minutes)

    record = PasswordResetToken(
        UserId=user.Id,
        TokenHash=token_hash,
        ExpiresAt=expires_at,
    )
    db.add(record)
    db.commit()

    base_url = _require_env("APP_PUBLIC_URL").rstrip("/")
    reset_link = f"{base_url}/reset?token={token}"
    try:
        SendPasswordResetEmail(user.Email, reset_link)
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        logger.warning(
            "password reset email rejected",
            extra={"status": status_code, "user_id": user.Id, "username": user.Username},
        )
        detail = "Failed to send reset email. Try again later."
        if status_code in {401, 403}:
            detail = "Email provider rejected the request. Check API credentials and sender."
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
    except Exception:
        logger.exception(
            "password reset email failed",
            extra={"user_id": user.Id, "username": user.Username},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send reset email. Try again later.",
        )

    return {"status": "ok"}


@router.post("/reset-password")
def ResetPassword(payload: ResetPasswordRequest, db: Session = Depends(GetDb)) -> dict:
    min_length = int(_require_env("AUTH_PASSWORD_MIN_LENGTH"))
    if len(payload.NewPassword) < min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {min_length} characters",
        )

    now = NowUtc()
    tokens = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.UsedAt.is_(None), PasswordResetToken.ExpiresAt > now)
        .all()
    )
    matched = None
    for token in tokens:
        if VerifyPasswordResetToken(payload.Token, token.TokenHash):
            matched = token
            break
    if not matched:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or expired.")

    user = db.query(User).filter(User.Id == matched.UserId).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or expired.")

    user.PasswordHash = HashPassword(payload.NewPassword)
    user.RequirePasswordChange = False
    user.FailedLoginCount = 0
    user.LockedUntil = None
    matched.UsedAt = now

    refresh_tokens = (
        db.query(RefreshToken)
        .filter(RefreshToken.UserId == user.Id, RefreshToken.RevokedAt.is_(None))
        .all()
    )
    for token in refresh_tokens:
        token.RevokedAt = now
        db.add(token)

    db.add(user)
    db.add(matched)
    db.commit()
    return {"status": "ok"}
