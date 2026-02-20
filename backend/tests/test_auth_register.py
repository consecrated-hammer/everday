import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.modules.auth import router as auth_router
from app.modules.auth.schemas import RegisterRequest


class _FakeQuery:
    def __init__(self, existing_user):
        self._existing_user = existing_user

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._existing_user


class _FakeDb:
    def __init__(self, existing_user=None, raise_integrity_on_commit=False):
        self._existing_user = existing_user
        self._raise_integrity_on_commit = raise_integrity_on_commit
        self.rollback_called = False
        self.refresh_called = False

    def query(self, *args, **kwargs):
        return _FakeQuery(self._existing_user)

    def add(self, *_args, **_kwargs):
        return None

    def commit(self):
        if self._raise_integrity_on_commit:
            raise IntegrityError(
                "INSERT INTO Users ...",
                {"Username": "racekid"},
                Exception("duplicate username"),
            )

    def rollback(self):
        self.rollback_called = True

    def refresh(self, *_args, **_kwargs):
        self.refresh_called = True


def test_register_returns_conflict_when_insert_hits_unique_constraint(monkeypatch):
    monkeypatch.setattr(auth_router, "_require_env", lambda _key: "8")
    monkeypatch.setattr(auth_router, "HashPassword", lambda _value: "hashed-password")
    monkeypatch.setattr(auth_router, "_NotifyPendingApproval", lambda _db, _user: None)

    db = _FakeDb(existing_user=None, raise_integrity_on_commit=True)
    payload = RegisterRequest(Username="racekid", Password="password123")

    with pytest.raises(HTTPException) as exc_info:
        auth_router.Register(payload, db=db)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Username already exists"
    assert db.rollback_called is True
    assert db.refresh_called is False
