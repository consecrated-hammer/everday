from app.modules.auth.deps import UserContext


def IsParent(user: UserContext, module: str = "health") -> bool:
    return user.Role == "Parent"
