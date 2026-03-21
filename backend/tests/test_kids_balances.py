from datetime import date

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

    def add(self, entry):
        self.added.append(entry)

    def commit(self):
        self.commit_called = True

    def refresh(self, _entry):
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
