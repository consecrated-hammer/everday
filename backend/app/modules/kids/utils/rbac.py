from fastapi import Depends, HTTPException, status

from app.modules.auth.deps import RequireAuthenticated, UserContext

KID_ROLE = "Kid"
PARENT_ROLE = "Parent"


def RequireKidsMember():
    def _checker(user: UserContext = Depends(RequireAuthenticated)) -> UserContext:
        if user.Role != KID_ROLE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return _checker


def RequireKidsManager():
    def _checker(user: UserContext = Depends(RequireAuthenticated)) -> UserContext:
        if user.Role != PARENT_ROLE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return _checker
