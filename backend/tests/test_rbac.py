import pytest
from fastapi import HTTPException

from app.modules.auth.deps import RequireModuleRole, UserContext


def test_rbac_allows_parent_write():
    checker = RequireModuleRole("health", write=True)
    user = UserContext(Id=1, Username="user", Role="Parent")
    assert checker(user) == user


def test_rbac_denies_kid_write():
    checker = RequireModuleRole("health", write=True)
    user = UserContext(Id=1, Username="kid", Role="Kid")
    with pytest.raises(HTTPException):
        checker(user)


def test_rbac_denies_missing_role():
    checker = RequireModuleRole("health", write=False)
    user = UserContext(Id=1, Username="user", Role="Unknown")
    with pytest.raises(HTTPException):
        checker(user)


def test_rbac_allows_kid_read():
    checker = RequireModuleRole("kids", write=False)
    user = UserContext(Id=1, Username="kid", Role="Kid")
    assert checker(user) == user


def test_rbac_denies_kid_non_kids_module():
    checker = RequireModuleRole("health", write=False)
    user = UserContext(Id=1, Username="kid", Role="Kid")
    with pytest.raises(HTTPException):
        checker(user)
