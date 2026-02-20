from types import SimpleNamespace

from app.modules.auth import router as auth_router


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, rows):
        self._rows = rows

    def query(self, *args, **kwargs):
        return _FakeQuery(self._rows)


def test_pending_approval_notification_uses_settings_access_link(monkeypatch):
    captured = {}

    def _fake_create_notifications_for_users(
        db,
        user_ids,
        created_by_user_id,
        title,
        body,
        notification_type,
        link_url,
        action_label,
        source_module,
        source_id,
        meta,
    ):
        captured["user_ids"] = user_ids
        captured["title"] = title
        captured["link_url"] = link_url
        captured["action_label"] = action_label

    monkeypatch.setattr(auth_router, "CreateNotificationsForUsers", _fake_create_notifications_for_users)

    pending_user = SimpleNamespace(Id=15, Username="pendingkid", FirstName="Pending", LastName="Kid")
    db = _FakeDb([SimpleNamespace(Id=2), SimpleNamespace(Id=3)])

    auth_router._NotifyPendingApproval(db, pending_user)

    assert captured["user_ids"] == [2, 3]
    assert captured["title"] == "Account approval requested"
    assert captured["link_url"] == "/settings/access"
    assert captured["action_label"] == "Review users"
