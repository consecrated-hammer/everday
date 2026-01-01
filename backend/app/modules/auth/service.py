import os
import secrets
from datetime import timedelta

from passlib.context import CryptContext

from app.modules.auth.deps import NowUtc, _require_env

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def HashPassword(password: str) -> str:
    return pwd_context.hash(password)


def VerifyPassword(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def CreateAccessToken(user_id: int, username: str) -> tuple[str, int]:
    import jwt

    secret = _require_env("JWT_SECRET_KEY")
    ttl_minutes = int(_require_env("JWT_ACCESS_TTL_MINUTES"))
    now = NowUtc()
    expires = now + timedelta(minutes=ttl_minutes)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token, ttl_minutes * 60


def CreateRefreshToken() -> str:
    return secrets.token_urlsafe(48)


def HashRefreshToken(token: str) -> str:
    return pwd_context.hash(token)


def VerifyRefreshToken(token: str, token_hash: str) -> bool:
    return pwd_context.verify(token, token_hash)


def CreatePasswordResetToken() -> str:
    return secrets.token_urlsafe(32)


def HashPasswordResetToken(token: str) -> str:
    return pwd_context.hash(token)


def VerifyPasswordResetToken(token: str, token_hash: str) -> bool:
    return pwd_context.verify(token, token_hash)
