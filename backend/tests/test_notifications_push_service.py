import base64

from app.modules.notifications.push_service import (
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
