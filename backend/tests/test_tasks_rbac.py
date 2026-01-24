from app.modules.auth.deps import UserContext
from app.modules.tasks.utils.rbac import CanAccessTask, CanReassignTask, IsAdmin


def test_tasks_rbac_admin():
    user = UserContext(Id=1, Username="admin", Role="Parent")
    assert IsAdmin(user)


def test_tasks_rbac_owner_access():
    user = UserContext(Id=2, Username="owner", Role="Parent")
    assert CanAccessTask(user, owner_user_id=2, assignee_user_ids=set())
    assert CanReassignTask(user, owner_user_id=2)


def test_tasks_rbac_assignee_access():
    user = UserContext(Id=3, Username="assignee", Role="Parent")
    assert CanAccessTask(user, owner_user_id=2, assignee_user_ids={3})
    assert not CanReassignTask(user, owner_user_id=2)
