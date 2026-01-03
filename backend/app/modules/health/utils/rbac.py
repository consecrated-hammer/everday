from app.modules.auth.deps import UserContext


def IsAdmin(user: UserContext, module: str = "health") -> bool:
    return user.Roles.get(module) == "Admin"
