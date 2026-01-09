import pytest
from fastapi import HTTPException

from app.modules.auth.deps import UserContext
from app.modules.kids.utils.rbac import RequireKidsManager, RequireKidsMember


def test_kids_member_allows_kid():
    checker = RequireKidsMember()
    user = UserContext(Id=1, Username="kid", Roles={"kids": "Kid"})
    assert checker(user) == user


def test_kids_member_denies_non_kid():
    checker = RequireKidsMember()
    user = UserContext(Id=1, Username="user", Roles={"kids": "Admin"})
    with pytest.raises(HTTPException):
        checker(user)


def test_kids_manager_allows_admin():
    checker = RequireKidsManager()
    user = UserContext(Id=1, Username="parent", Roles={"kids": "Admin"})
    assert checker(user) == user


def test_kids_manager_allows_settings_admin():
    checker = RequireKidsManager()
    user = UserContext(Id=1, Username="parent", Roles={"settings": "Admin"})
    assert checker(user) == user
