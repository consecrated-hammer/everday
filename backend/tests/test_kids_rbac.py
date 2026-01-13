import pytest
from fastapi import HTTPException

from app.modules.auth.deps import UserContext
from app.modules.kids.utils.rbac import RequireKidsManager, RequireKidsMember


def test_kids_member_allows_kid():
    checker = RequireKidsMember()
    user = UserContext(Id=1, Username="kid", Role="Kid")
    assert checker(user) == user


def test_kids_member_denies_non_kid():
    checker = RequireKidsMember()
    user = UserContext(Id=1, Username="user", Role="Parent")
    with pytest.raises(HTTPException):
        checker(user)


def test_kids_manager_allows_parent():
    checker = RequireKidsManager()
    user = UserContext(Id=1, Username="parent", Role="Parent")
    assert checker(user) == user


def test_kids_manager_denies_kid():
    checker = RequireKidsManager()
    user = UserContext(Id=1, Username="kid", Role="Kid")
    with pytest.raises(HTTPException):
        checker(user)
