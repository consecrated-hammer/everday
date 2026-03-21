from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException

from app.modules.auth.deps import UserContext
from app.modules.kids import router as kids_router
from app.modules.kids.schemas import LedgerEntryCreate


class _FakeDb:
    def __init__(self):
        self.added = []
        self.commit_called = False
        self.refresh_called = False
        self._next_id = 1

    def add(self, entry):
        self.added.append(entry)

    def commit(self):
        self.commit_called = True

    def refresh(self, entry):
        if getattr(entry, "Id", None) is None:
            entry.Id = self._next_id
            self._next_id += 1
        now = datetime.now(timezone.utc)
        if getattr(entry, "CreatedAt", None) is None:
            entry.CreatedAt = now
        if getattr(entry, "UpdatedAt", None) is None:
            entry.UpdatedAt = now
        self.refresh_called = True


def test_clamp_non_negative_balance_returns_zero_for_negative_total():
    assert kids_router._ClampNonNegativeBalance(-74.44) == 0.0
    assert kids_router._ClampNonNegativeBalance(24.58) == 24.58


def test_build_displayed_balance_ignores_negative_prior_month_carryover():
    balance = kids_router._BuildDisplayedBalance(-74.44, 0, 12.90)

    assert balance == 12.90


def test_build_displayed_balance_clamps_current_month_overdraw_to_zero():
    balance = kids_router._BuildDisplayedBalance(-74.44, -15.99, 12.90)

    assert balance == 0.0


def test_add_withdrawal_rejects_when_request_exceeds_available_balance(monkeypatch):
    db = _FakeDb()
    payload = LedgerEntryCreate(
        Amount=15.99,
        EntryDate=date(2026, 3, 21),
        Narrative="Amazon laser torch",
        Notes=None,
    )
    user = UserContext(Id=1, Username="parent", Role="Parent")

    monkeypatch.setattr(kids_router, "_EnsureParentKidAccess", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(kids_router, "EnsurePocketMoneyCredits", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(kids_router, "_KidBalance", lambda *_args, **_kwargs: 0.0)

    with pytest.raises(HTTPException) as exc_info:
        kids_router.AddWithdrawal(5, payload, db=db, user=user)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "Kid has reached their balance limit. Add a deposit or adjust the starting balance."
    )
    assert db.added == []
    assert db.commit_called is False
    assert db.refresh_called is False


def test_add_withdrawal_allows_amount_within_available_balance(monkeypatch):
    db = _FakeDb()
    payload = LedgerEntryCreate(
        Amount=12.34,
        EntryDate=date(2026, 3, 21),
        Narrative="Pocket money spend",
        Notes="within limit",
    )
    user = UserContext(Id=1, Username="parent", Role="Parent")

    monkeypatch.setattr(kids_router, "_EnsureParentKidAccess", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(kids_router, "EnsurePocketMoneyCredits", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(kids_router, "_KidBalance", lambda *_args, **_kwargs: 24.58)
    monkeypatch.setattr(kids_router, "_LoadUserNames", lambda *_args, **_kwargs: {1: "Parent User"})

    result = kids_router.AddWithdrawal(3, payload, db=db, user=user)

    assert len(db.added) == 1
    assert float(db.added[0].Amount) == -12.34
    assert db.added[0].KidUserId == 3
    assert db.commit_called is True
    assert db.refresh_called is True
    assert result.Amount == -12.34
    assert result.CreatedByName == "Parent User"


def test_add_withdrawal_uses_requested_entry_date_for_balance_check(monkeypatch):
    db = _FakeDb()
    payload = LedgerEntryCreate(
        Amount=8.00,
        EntryDate=date(2026, 3, 5),
        Narrative="Backdated spend",
        Notes=None,
    )
    user = UserContext(Id=1, Username="parent", Role="Parent")
    captured: dict[str, object] = {}

    monkeypatch.setattr(kids_router, "_EnsureParentKidAccess", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(kids_router, "EnsurePocketMoneyCredits", lambda *_args, **_kwargs: None)

    def _fake_kid_balance(_db, _kid_id, anchor_date=None):
        captured["anchor_date"] = anchor_date
        return 12.0

    monkeypatch.setattr(kids_router, "_KidBalance", _fake_kid_balance)
    monkeypatch.setattr(kids_router, "_LoadUserNames", lambda *_args, **_kwargs: {1: "Parent User"})

    result = kids_router.AddWithdrawal(3, payload, db=db, user=user)

    assert captured["anchor_date"] == payload.EntryDate
    assert result.Amount == -8.0


def test_add_starting_balance_uses_raw_ledger_total(monkeypatch):
    db = _FakeDb()
    payload = LedgerEntryCreate(
        Amount=10.0,
        EntryDate=date(2026, 3, 21),
        Narrative="Set current balance",
        Notes=None,
    )
    user = UserContext(Id=1, Username="parent", Role="Parent")
    called: dict[str, object] = {"display_balance_used": False}

    monkeypatch.setattr(kids_router, "_EnsureParentKidAccess", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(kids_router, "EnsurePocketMoneyCredits", lambda *_args, **_kwargs: None)

    def _fail_if_display_balance_used(*_args, **_kwargs):
        called["display_balance_used"] = True
        raise AssertionError("_KidBalance should not be used for starting balance adjustments")

    monkeypatch.setattr(kids_router, "_KidBalance", _fail_if_display_balance_used)
    monkeypatch.setattr(kids_router, "_KidRawBalance", lambda *_args, **_kwargs: -15.0)
    monkeypatch.setattr(kids_router, "_LoadUserNames", lambda *_args, **_kwargs: {1: "Parent User"})

    result = kids_router.AddStartingBalance(3, payload, db=db, user=user)

    assert called["display_balance_used"] is False
    assert len(db.added) == 1
    assert float(db.added[0].Amount) == 25.0
    assert result.Amount == 25.0
