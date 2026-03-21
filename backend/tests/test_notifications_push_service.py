import base64

from app.modules.notifications.push_service import (
    GetApnsHealthStatus,
    _NormalizePrivateKey,
    _NormalizePushEnvironment,
    _ShouldDeactivateToken,
)


def test_normalize_private_key_accepts_escaped_pem():
    key = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"
    normalized = _NormalizePrivateKey(key)
    assert "BEGIN PRIVATE KEY" in normalized
    assert "\\n" not in normalized


def test_normalize_private_key_accepts_base64_pem():
    raw = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
    encoded = base64.b64encode(raw.encode("utf-8")).decode("utf-8")
    normalized = _NormalizePrivateKey(encoded)
    assert normalized == raw


def test_normalize_push_environment_defaults_to_production():
    assert _NormalizePushEnvironment(None) == "production"
    assert _NormalizePushEnvironment("production") == "production"
    assert _NormalizePushEnvironment("development") == "development"
    assert _NormalizePushEnvironment("DEV") == "production"


def test_should_deactivate_token_only_for_expected_cases():
    assert _ShouldDeactivateToken(400, "BadDeviceToken")
    assert _ShouldDeactivateToken(410, "Unregistered")
    assert not _ShouldDeactivateToken(403, "TopicDisallowed")
    assert not _ShouldDeactivateToken(400, "TopicDisallowed")


def test_get_apns_health_status_reports_disabled(monkeypatch):
    monkeypatch.delenv("APNS_ENABLED", raising=False)
    monkeypatch.delenv("APNS_TEAM_ID", raising=False)
    monkeypatch.delenv("APNS_KEY_ID", raising=False)
    monkeypatch.delenv("APNS_BUNDLE_ID", raising=False)
    monkeypatch.delenv("APNS_PRIVATE_KEY", raising=False)

    health = GetApnsHealthStatus()

    assert health == {"enabled": False, "configured": False, "missing": []}


def test_get_apns_health_status_reports_missing_values(monkeypatch):
    monkeypatch.setenv("APNS_ENABLED", "true")
    monkeypatch.delenv("APNS_TEAM_ID", raising=False)
    monkeypatch.setenv("APNS_KEY_ID", "abc123")
    monkeypatch.setenv("APNS_BUNDLE_ID", "au.batserver.everday.ios")
    monkeypatch.delenv("APNS_PRIVATE_KEY", raising=False)

    health = GetApnsHealthStatus()

    assert health["enabled"] is True
    assert health["configured"] is False
    assert health["missing"] == ["APNS_TEAM_ID", "APNS_PRIVATE_KEY"]


def test_get_apns_health_status_reports_configured(monkeypatch):
    monkeypatch.setenv("APNS_ENABLED", "true")
    monkeypatch.setenv("APNS_TEAM_ID", "team123")
    monkeypatch.setenv("APNS_KEY_ID", "key123")
    monkeypatch.setenv("APNS_BUNDLE_ID", "au.batserver.everday.ios")
    monkeypatch.setenv(
        "APNS_PRIVATE_KEY",
        "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    )

    health = GetApnsHealthStatus()

    assert health == {
        "enabled": True,
        "configured": True,
        "missing": [],
        "bundle_id": "au.batserver.everday.ios",
    }
