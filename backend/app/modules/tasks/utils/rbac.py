from app.modules.auth.deps import UserContext


AdminRoles = {"Parent"}


def IsAdmin(user: UserContext) -> bool:
    return user.Role in AdminRoles


def CanAccessTask(user: UserContext, owner_user_id: int, assignee_user_ids: set[int]) -> bool:
    if IsAdmin(user):
        return True
    if user.Id == owner_user_id:
        return True
    return user.Id in assignee_user_ids


def CanReassignTask(user: UserContext, owner_user_id: int) -> bool:
    if IsAdmin(user):
        return True
    return user.Id == owner_user_id
