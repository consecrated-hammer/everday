import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireAuthenticated, RequireModuleRole, UserContext
from app.modules.tasks.schemas import (
    TaskCompleteResponse,
    TaskCreate,
    TaskListCreate,
    TaskListDeleteResponse,
    TaskListListResponse,
    TaskListResponse,
    TaskListOut,
    TaskListUpdate,
    TaskNotificationRunResponse,
    TaskOut,
    TaskSettingsOut,
    TaskSettingsUpdate,
    TaskSnoozeRequest,
    TaskTagCreate,
    TaskTagListResponse,
    TaskTagOut,
    TaskUpdate,
    TaskView,
    TaskRepeatType,
    TaskAssigneeOut,
)
from app.modules.tasks.services import (
    CreateTask,
    CreateTaskList,
    CreateTaskTag,
    DecorateTasks,
    DeleteTask,
    DeleteTaskList,
    ListTaskLists,
    ListTaskTags,
    ListTasks,
    RunTaskNotifications,
    SnoozeTask,
    TaskAccessError,
    TaskNotFoundError,
    UpdateTask,
    UpdateTaskList,
    CompleteTask,
    _ParseWeekdays,
    GetTaskSettings,
    ResolveTaskSettingsOutput,
    UpdateTaskSettings,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
logger = logging.getLogger("tasks")


def _handle_db_error(exc: Exception) -> None:
    logger.exception("tasks database error")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Tasks storage not initialized. Run alembic upgrade head.",
    ) from exc


def _BuildTaskOut(record) -> TaskOut:
    task = record.Task
    repeat_type_value = task.RepeatType or TaskRepeatType.None_.value
    try:
        repeat_type = TaskRepeatType(repeat_type_value)
    except ValueError:
        repeat_type = TaskRepeatType.None_
    return TaskOut(
        Id=task.Id,
        SeriesId=task.SeriesId,
        Title=task.Title,
        Description=task.Description,
        OwnerUserId=task.OwnerUserId,
        OwnerName=record.OwnerName,
        CreatedByUserId=task.CreatedByUserId,
        CreatedByName=record.CreatedByName,
        ListId=task.ListId,
        ListName=record.ListName,
        TagNames=record.TagNames,
        Assignees=[TaskAssigneeOut(**item) for item in record.Assignees],
        StartDate=task.StartDate,
        StartTime=task.StartTime,
        EndDate=task.EndDate,
        EndTime=task.EndTime,
        IsAllDay=task.IsAllDay,
        TimeZone=task.TimeZone,
        RepeatType=repeat_type,
        RepeatInterval=task.RepeatInterval or 1,
        RepeatWeekdays=_ParseWeekdays(task.RepeatWeekdays),
        RepeatMonthday=task.RepeatMonthday,
        RepeatUntilDate=task.RepeatUntilDate,
        ReminderAt=task.ReminderAt,
        ReminderOffsetMinutes=task.ReminderOffsetMinutes,
        SnoozedUntil=task.SnoozedUntil,
        IsStarred=task.IsStarred,
        IsCompleted=task.IsCompleted,
        CompletedAt=task.CompletedAt,
        CompletedByUserId=task.CompletedByUserId,
        RelatedModule=task.RelatedModule,
        RelatedRecordId=task.RelatedRecordId,
        CreatedAt=task.CreatedAt,
        UpdatedAt=task.UpdatedAt,
    )


def _BuildTaskOutList(db: Session, tasks: list) -> list[TaskOut]:
    decorated = DecorateTasks(db, tasks)
    return [_BuildTaskOut(entry) for entry in decorated]


def _handle_task_error(exc: Exception) -> None:
    detail = str(exc)
    if isinstance(exc, TaskNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail) from exc
    if isinstance(exc, TaskAccessError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail) from exc
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc


@router.get("", response_model=TaskListResponse)
def ListTaskItems(
    view: TaskView = TaskView.Today,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=False)),
) -> TaskListResponse:
    try:
        tasks = ListTasks(db, user, view.value)
        return TaskListResponse(Tasks=_BuildTaskOutList(db, tasks))
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def CreateTaskItem(
    payload: TaskCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskOut:
    try:
        record = CreateTask(db, user, payload.model_dump())
        return _BuildTaskOutList(db, [record])[0]
    except (ValueError, TaskAccessError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/settings", response_model=TaskSettingsOut)
def GetTaskSettingsItem(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> TaskSettingsOut:
    try:
        record = GetTaskSettings(db, user.Id)
        return TaskSettingsOut(**ResolveTaskSettingsOutput(record))
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/settings", response_model=TaskSettingsOut)
def UpdateTaskSettingsItem(
    payload: TaskSettingsUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireAuthenticated),
) -> TaskSettingsOut:
    try:
        record = UpdateTaskSettings(db, user.Id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ProgrammingError as exc:
        _handle_db_error(exc)
    return TaskSettingsOut(**ResolveTaskSettingsOutput(record))


@router.put("/{task_id}", response_model=TaskOut)
def UpdateTaskItem(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskOut:
    try:
        record = UpdateTask(db, user, task_id, payload.model_dump(exclude_unset=True))
        return _BuildTaskOutList(db, [record])[0]
    except (ValueError, TaskAccessError, TaskNotFoundError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/{task_id}/complete", response_model=TaskCompleteResponse)
def CompleteTaskItem(
    task_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskCompleteResponse:
    try:
        result = CompleteTask(db, user, task_id)
        tasks = [result.Task]
        if result.NextTask:
            tasks.append(result.NextTask)
        task_out_map = {task.Id: entry for entry, task in zip(_BuildTaskOutList(db, tasks), tasks)}
        return TaskCompleteResponse(
            Task=task_out_map[result.Task.Id],
            NextTask=task_out_map.get(result.NextTask.Id) if result.NextTask else None,
        )
    except (ValueError, TaskAccessError, TaskNotFoundError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/{task_id}/snooze", response_model=TaskOut)
def SnoozeTaskItem(
    task_id: int,
    payload: TaskSnoozeRequest,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskOut:
    try:
        record = SnoozeTask(db, user, task_id, payload.Minutes, payload.SnoozeUntil)
        return _BuildTaskOutList(db, [record])[0]
    except (ValueError, TaskAccessError, TaskNotFoundError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteTaskItem(
    task_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> None:
    try:
        DeleteTask(db, user, task_id)
    except (ValueError, TaskAccessError, TaskNotFoundError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/tags", response_model=TaskTagListResponse)
def ListTags(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=False)),
) -> TaskTagListResponse:
    try:
        tags = ListTaskTags(db, user)
        return TaskTagListResponse(
            Tags=[TaskTagOut(Id=tag.Id, Name=tag.Name, Slug=tag.Slug) for tag in tags]
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/tags", response_model=TaskTagOut, status_code=status.HTTP_201_CREATED)
def CreateTag(
    payload: TaskTagCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskTagOut:
    try:
        tag = CreateTaskTag(db, user, payload.Name)
        return TaskTagOut(Id=tag.Id, Name=tag.Name, Slug=tag.Slug)
    except (ValueError, TaskAccessError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.get("/lists", response_model=TaskListListResponse)
def ListLists(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=False)),
) -> TaskListListResponse:
    try:
        lists = ListTaskLists(db, user)
        return TaskListListResponse(
            Lists=[TaskListOut(Id=entry.Id, Name=entry.Name, IsShared=entry.IsShared) for entry in lists]
        )
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/lists", response_model=TaskListOut, status_code=status.HTTP_201_CREATED)
def CreateList(
    payload: TaskListCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskListOut:
    try:
        record = CreateTaskList(db, user, payload.Name, payload.IsShared)
        return TaskListOut(Id=record.Id, Name=record.Name, IsShared=record.IsShared)
    except (ValueError, TaskAccessError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.put("/lists/{list_id}", response_model=TaskListOut)
def UpdateList(
    list_id: int,
    payload: TaskListUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskListOut:
    try:
        record = UpdateTaskList(db, user, list_id, payload.Name)
        return TaskListOut(Id=record.Id, Name=record.Name, IsShared=record.IsShared)
    except (ValueError, TaskAccessError, TaskNotFoundError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.delete("/lists/{list_id}", response_model=TaskListDeleteResponse)
def DeleteList(
    list_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskListDeleteResponse:
    try:
        reassigned_count, destination = DeleteTaskList(db, user, list_id)
        return TaskListDeleteResponse(
            DeletedId=list_id,
            ReassignedCount=reassigned_count,
            DestinationListId=destination.Id if destination else None,
            DestinationListName=destination.Name if destination else None,
        )
    except (ValueError, TaskAccessError, TaskNotFoundError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)


@router.post("/notifications/run", response_model=TaskNotificationRunResponse)
def RunNotifications(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("tasks", write=True)),
) -> TaskNotificationRunResponse:
    try:
        result = RunTaskNotifications(db, user)
        return TaskNotificationRunResponse(
            RemindersSent=result.RemindersSent,
            OverdueSent=result.OverdueSent,
        )
    except (ValueError, TaskAccessError) as exc:
        _handle_task_error(exc)
    except ProgrammingError as exc:
        _handle_db_error(exc)
