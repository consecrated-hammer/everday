from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from app.modules.auth.deps import UserContext
from app.modules.tasks import services


def _QueryReturning(value):
    query = Mock()
    query.filter.return_value = query
    query.first.return_value = value
    return query


def test_delete_task_uses_list_id_for_shared_list_lookup():
    task = SimpleNamespace(Id=17, ListId=9)
    task_query = _QueryReturning(task)
    list_query = _QueryReturning(SimpleNamespace(IsShared=False))
    tag_link_query = _QueryReturning(None)
    assignee_query = _QueryReturning(None)
    db = Mock()
    db.query.side_effect = [task_query, list_query, tag_link_query, assignee_query]
    user = UserContext(Id=1, Username="parent", Role="Parent")

    with patch.object(services, "_EnsureCanReassign") as ensure_can_reassign:
        services.DeleteTask(db, user, 17)

    assert db.query.call_args_list == [
        call(services.Task),
        call(services.TaskList),
        call(services.TaskTagLink),
        call(services.TaskAssignee),
    ]
    ensure_can_reassign.assert_called_once_with(user, task)
    db.delete.assert_called_once_with(task)
    db.commit.assert_called_once()
