import pytest
from fastapi import HTTPException

from app.modules.auth.deps import RequireModuleRole, UserContext


def test_rbac_allows_admin_write():
    checker = RequireModuleRole("health", write=True)
    user = UserContext(Id=1, Username="user", Roles={"health": "Admin"})
    assert checker(user) == user


def test_rbac_allows_edit_write():
    checker = RequireModuleRole("health", write=True)
    user = UserContext(Id=1, Username="user", Roles={"health": "Edit"})
    assert checker(user) == user


def test_rbac_denies_readonly_write():
    checker = RequireModuleRole("health", write=True)
    user = UserContext(Id=1, Username="user", Roles={"health": "ReadOnly"})
    with pytest.raises(HTTPException):
        checker(user)


def test_rbac_denies_missing_role():
    checker = RequireModuleRole("health", write=False)
    user = UserContext(Id=1, Username="user", Roles={})
    with pytest.raises(HTTPException):
        checker(user)


def test_rbac_allows_kid_read():
    checker = RequireModuleRole("kids", write=False)
    user = UserContext(Id=1, Username="kid", Roles={"kids": "Kid"})
    assert checker(user) == user
