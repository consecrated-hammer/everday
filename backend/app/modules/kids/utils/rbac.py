from fastapi import Depends, HTTPException, status

from app.modules.auth.deps import RequireAuthenticated, UserContext

KIDS_MODULE = "kids"
SETTINGS_MODULE = "settings"
KID_ROLE = "Kid"
PARENT_ROLES = {"Admin", "Edit", "Editor"}


def RequireKidsMember():
    def _checker(user: UserContext = Depends(RequireAuthenticated)) -> UserContext:
        role = user.Roles.get(KIDS_MODULE)
        if role != KID_ROLE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return _checker


def RequireKidsManager():
    def _checker(user: UserContext = Depends(RequireAuthenticated)) -> UserContext:
        role = user.Roles.get(KIDS_MODULE)
        settings_role = user.Roles.get(SETTINGS_MODULE)
        if role not in PARENT_ROLES and settings_role != "Admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return _checker
