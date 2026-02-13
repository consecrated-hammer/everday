from app.modules.notifications.services import (
    ResolveNotificationCreatedByName,
    SYSTEM_CREATED_BY_NAME,
)


def test_system_notification_types_use_everday_sender() -> None:
    for notification_type in (
        "KidsReminder",
        "HealthReminder",
        "HealthAiSuggestion",
        "TaskReminder",
        "TaskOverdue",
    ):
        assert (
            ResolveNotificationCreatedByName(
                created_by_user_id=1,
                created_by_name="Admin User",
                notification_type=notification_type,
            )
            == SYSTEM_CREATED_BY_NAME
        )


def test_non_system_notification_keeps_original_sender() -> None:
    assert (
        ResolveNotificationCreatedByName(
            created_by_user_id=1,
            created_by_name="Parent User",
            notification_type="General",
        )
        == "Parent User"
    )


def test_non_positive_sender_id_uses_everday() -> None:
    assert (
        ResolveNotificationCreatedByName(
            created_by_user_id=0,
            created_by_name=None,
            notification_type="General",
        )
        == SYSTEM_CREATED_BY_NAME
    )
