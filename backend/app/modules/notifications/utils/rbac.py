from app.modules.auth.deps import UserContext


AdminRoles = {"Parent", "Admin"}


def IsAdmin(user: UserContext) -> bool:
    return user.Role in AdminRoles


def CanAccessNotification(user: UserContext, notification_user_id: int) -> bool:
    if user.Id == notification_user_id:
        return True
    return IsAdmin(user)
