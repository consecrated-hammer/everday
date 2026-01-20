from app.modules.auth.deps import UserContext
from app.modules.notifications.utils.rbac import CanAccessNotification, IsAdmin


def test_notifications_access_owner():
    user = UserContext(Id=5, Username="kid", Role="Kid")
    assert CanAccessNotification(user, 5)


def test_notifications_access_denied_for_non_owner():
    user = UserContext(Id=5, Username="kid", Role="Kid")
    assert not CanAccessNotification(user, 8)


def test_notifications_access_admin_role():
    user = UserContext(Id=5, Username="parent", Role="Parent")
    assert CanAccessNotification(user, 8)


def test_notifications_access_admin_alias():
    user = UserContext(Id=5, Username="admin", Role="Admin")
    assert IsAdmin(user)
