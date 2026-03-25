from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.auth import router as auth_router
from app.modules.auth.models import RefreshToken, User
from app.modules.auth.schemas import RefreshRequest


class _FakeRefreshTokenQuery:
    def __init__(self, db):
        self._db = db
        self._mode = "unknown"

    def filter(self, *args, **kwargs):
        rendered = " ".join(str(arg) for arg in args)
        if "LookupHash" in rendered and " IS NULL" not in rendered:
            self._mode = "exact"
        elif "LookupHash IS NULL" in rendered:
            self._mode = "legacy"
        else:
            self._mode = "other"
        return self

    def first(self):
        if self._mode == "exact":
            self._db.exact_first_calls += 1
            return self._db.exact_token
        return None

    def all(self):
        if self._mode == "legacy":
            self._db.legacy_all_calls += 1
            return list(self._db.legacy_tokens)
        return []


class _FakeUserQuery:
    def __init__(self, db):
        self._db = db

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._db.user


class _FakeDb:
    def __init__(self, exact_token=None, legacy_tokens=None, user=None):
        self.exact_token = exact_token
        self.legacy_tokens = legacy_tokens or []
        self.user = user
        self.added = []
        self.commit_count = 0
        self.exact_first_calls = 0
        self.legacy_all_calls = 0

    def query(self, model):
        if model is RefreshToken:
            return _FakeRefreshTokenQuery(self)
        if model is User:
            return _FakeUserQuery(self)
        raise AssertionError(f"Unexpected model query: {model}")

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.commit_count += 1


def test_refresh_uses_exact_lookup_for_hashed_tokens(monkeypatch):
    now = datetime(2026, 3, 24, tzinfo=timezone.utc)
    current = SimpleNamespace(
        UserId=7,
        TokenHash="hash:current-refresh",
        LookupHash="lookup:current-refresh",
        RevokedAt=None,
        ExpiresAt=now + timedelta(days=7),
    )
    user = SimpleNamespace(
        Id=7,
        Username="kevin",
        IsApproved=True,
        RequirePasswordChange=False,
        Role="Parent",
        FirstName="Kevin",
        LastName="Hammer",
        Email="kevin@example.com",
        DiscordHandle=None,
    )
    db = _FakeDb(exact_token=current, legacy_tokens=[SimpleNamespace(TokenHash="hash:legacy")], user=user)

    monkeypatch.setattr(auth_router, "NowUtc", lambda: now)
    monkeypatch.setattr(auth_router, "VerifyRefreshToken", lambda raw, token_hash: token_hash == f"hash:{raw}")
    monkeypatch.setattr(auth_router, "ComputeRefreshTokenLookupHash", lambda raw: f"lookup:{raw}")
    monkeypatch.setattr(auth_router, "CreateAccessToken", lambda user_id, username: ("access-123", 1800))
    monkeypatch.setattr(auth_router, "CreateRefreshToken", lambda: "next-refresh")
    monkeypatch.setattr(auth_router, "HashRefreshToken", lambda raw: f"hash:{raw}")
    monkeypatch.setattr(auth_router, "_require_env", lambda name: "30")

    response = auth_router.Refresh(RefreshRequest(RefreshToken="current-refresh"), db=db)

    assert response.AccessToken == "access-123"
    assert response.RefreshToken == "next-refresh"
    assert current.RevokedAt == now
    assert db.exact_first_calls == 1
    assert db.legacy_all_calls == 0
    assert db.commit_count == 1

    created_tokens = [value for value in db.added if isinstance(value, RefreshToken)]
    assert len(created_tokens) == 1
    assert created_tokens[0].LookupHash == "lookup:next-refresh"


def test_refresh_falls_back_to_legacy_scan_once_and_backfills_lookup_hash(monkeypatch):
    now = datetime(2026, 3, 24, tzinfo=timezone.utc)
    legacy = SimpleNamespace(
        UserId=4,
        TokenHash="hash:legacy-refresh",
        LookupHash=None,
        RevokedAt=None,
        ExpiresAt=now + timedelta(days=7),
    )
    user = SimpleNamespace(
        Id=4,
        Username="bianca",
        IsApproved=True,
        RequirePasswordChange=False,
        Role="Parent",
        FirstName="Bianca",
        LastName="Hammer",
        Email="bianca@example.com",
        DiscordHandle=None,
    )
    db = _FakeDb(exact_token=None, legacy_tokens=[legacy], user=user)

    monkeypatch.setattr(auth_router, "NowUtc", lambda: now)
    monkeypatch.setattr(auth_router, "VerifyRefreshToken", lambda raw, token_hash: token_hash == f"hash:{raw}")
    monkeypatch.setattr(auth_router, "ComputeRefreshTokenLookupHash", lambda raw: f"lookup:{raw}")
    monkeypatch.setattr(auth_router, "CreateAccessToken", lambda user_id, username: ("access-456", 1800))
    monkeypatch.setattr(auth_router, "CreateRefreshToken", lambda: "rotated-refresh")
    monkeypatch.setattr(auth_router, "HashRefreshToken", lambda raw: f"hash:{raw}")
    monkeypatch.setattr(auth_router, "_require_env", lambda name: "30")

    response = auth_router.Refresh(RefreshRequest(RefreshToken="legacy-refresh"), db=db)

    assert response.AccessToken == "access-456"
    assert response.RefreshToken == "rotated-refresh"
    assert legacy.LookupHash == "lookup:legacy-refresh"
    assert legacy.RevokedAt == now
    assert db.exact_first_calls == 1
    assert db.legacy_all_calls == 1
    assert db.commit_count == 1


def test_logout_rejects_token_owned_by_another_user(monkeypatch):
    now = datetime(2026, 3, 24, tzinfo=timezone.utc)
    db = _FakeDb()
    token = SimpleNamespace(UserId=9, RevokedAt=None)

    monkeypatch.setattr(auth_router, "NowUtc", lambda: now)
    monkeypatch.setattr(auth_router, "_FindRefreshTokenRecord", lambda db_session, raw_token, current_now: token)

    with pytest.raises(HTTPException) as exc_info:
        auth_router.Logout(
            RefreshRequest(RefreshToken="shared-refresh"),
            user=SimpleNamespace(Id=1, Username="kevin", Role="Parent"),
            db=db,
        )

    assert exc_info.value.status_code == 404
    assert token.RevokedAt is None
