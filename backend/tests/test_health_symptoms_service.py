from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.modules.health.models import HeadacheEvent, MedicationDose
from app.modules.health.schemas import UpsertHeadacheEventInput, UpsertMedicationDoseInput
from app.modules.health.services.symptoms_service import UpsertDose, UpsertHeadache
from app.modules.integrations.health_mcp import router as health_mcp_router


class _Query:
    def __init__(self, db):
        self.db = db

    def filter(self, *_conditions):
        return self

    def first(self):
        return self.db.query_rows.pop(0) if self.db.query_rows else None


class _Db:
    def __init__(self, query_rows=None, commit_error=None):
        self.query_rows = list(query_rows or [])
        self.commit_error = commit_error
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    def query(self, _model):
        return _Query(self)

    def add(self, row):
        self.added.append(row)

    def commit(self):
        self.commits += 1
        if self.commit_error is not None:
            error = self.commit_error
            self.commit_error = None
            raise error

    def rollback(self):
        self.rollbacks += 1

    def refresh(self, _row):
        return None


def test_headache_create_preserves_caller_supplied_id():
    db = _Db()

    result = UpsertHeadache(
        db,
        7,
        UpsertHeadacheEventInput(
            HeadacheEventId="11111111-1111-4111-8111-111111111111",
            LogDate="2026-08-10",
            Severity=2,
        ),
    )

    assert result.HeadacheEventId == "11111111-1111-4111-8111-111111111111"
    assert db.added[0].HeadacheEventId == result.HeadacheEventId
    assert db.commits == 1


def test_medication_create_preserves_caller_supplied_id_and_headache_link():
    db = _Db()

    result = UpsertDose(
        db,
        7,
        UpsertMedicationDoseInput(
            MedicationDoseId="22222222-2222-4222-8222-222222222222",
            HeadacheEventId="11111111-1111-4111-8111-111111111111",
            LogDate="2026-08-10",
            MedicationName="Panadol",
            Dose="2 tablets",
        ),
    )

    assert result.MedicationDoseId == "22222222-2222-4222-8222-222222222222"
    assert result.HeadacheEventId == "11111111-1111-4111-8111-111111111111"
    assert db.added[0].MedicationDoseId == result.MedicationDoseId
    assert db.commits == 1


def test_concurrent_headache_retry_returns_the_winning_record():
    winning = HeadacheEvent(
        HeadacheEventId="11111111-1111-4111-8111-111111111111",
        UserId=7,
        LogDate="2026-08-10",
        EventType="headache",
        Severity=2,
    )
    db = _Db(
        query_rows=[None, winning],
        commit_error=IntegrityError("INSERT", {}, Exception("duplicate key")),
    )

    result = UpsertHeadache(
        db,
        7,
        UpsertHeadacheEventInput(
            HeadacheEventId=winning.HeadacheEventId,
            LogDate="2026-08-10",
            Severity=2,
        ),
    )

    assert result.HeadacheEventId == winning.HeadacheEventId
    assert db.rollbacks == 1


def test_concurrent_medication_retry_returns_the_winning_record():
    winning = MedicationDose(
        MedicationDoseId="22222222-2222-4222-8222-222222222222",
        HeadacheEventId="11111111-1111-4111-8111-111111111111",
        UserId=7,
        LogDate="2026-08-10",
        MedicationName="Panadol",
        Dose="2 tablets",
    )
    db = _Db(
        query_rows=[None, winning],
        commit_error=IntegrityError("INSERT", {}, Exception("duplicate key")),
    )

    result = UpsertDose(
        db,
        7,
        UpsertMedicationDoseInput(
            MedicationDoseId=winning.MedicationDoseId,
            HeadacheEventId=winning.HeadacheEventId,
            LogDate="2026-08-10",
            MedicationName="Panadol",
            Dose="2 tablets",
        ),
    )

    assert result.MedicationDoseId == winning.MedicationDoseId
    assert db.rollbacks == 1


@pytest.mark.parametrize(
    ("schema", "field"),
    [
        (UpsertHeadacheEventInput, "HeadacheEventId"),
        (UpsertMedicationDoseInput, "MedicationDoseId"),
        (UpsertMedicationDoseInput, "HeadacheEventId"),
    ],
)
def test_symptom_record_ids_require_canonical_uuid_shape(schema, field):
    values = {"LogDate": "2026-08-10", "MedicationName": "Panadol", field: "not-a-uuid"}

    with pytest.raises(ValidationError):
        schema(**values)


@pytest.mark.parametrize(
    ("route", "service_name", "payload"),
    [
        (
            health_mcp_router.UpsertHeadacheRoute,
            "UpsertHeadache",
            UpsertHeadacheEventInput(LogDate="2026-08-10"),
        ),
        (
            health_mcp_router.UpsertMedicationDoseRoute,
            "UpsertDose",
            UpsertMedicationDoseInput(LogDate="2026-08-10", MedicationName="Panadol"),
        ),
    ],
)
def test_symptom_routes_translate_id_collisions_to_bad_request(monkeypatch, route, service_name, payload):
    def raise_collision(*_args, **_kwargs):
        raise ValueError("record id is already in use")

    monkeypatch.setattr(health_mcp_router, service_name, raise_collision)

    with pytest.raises(HTTPException) as exc_info:
        route(payload, db=object(), user=SimpleNamespace(Id=7))

    assert exc_info.value.status_code == 400
    assert "already in use" in exc_info.value.detail
