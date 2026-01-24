import logging
import os
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireAuthenticated, RequireModuleRole, NowUtc, _require_env
from app.modules.auth.models import User
from app.modules.integrations.google.models import (
    GoogleIntegration,
    GoogleTaskOverdueNotification,
    GoogleTaskShare,
)
from app.modules.notifications.services import CreateNotificationsForUsers
from app.modules.tasks.services import (
    EnsureTaskSettings,
    ResolveOverdueReminderTime,
    ResolveOverdueReminderTimeZone,
)
from app.modules.integrations.google.service import (
    BuildGoogleAuthUrl,
    CreateGoogleStateToken,
    CreateGoogleTask,
    DeleteGoogleTask,
    ExchangeGoogleCode,
    FetchGoogleTasks,
    LoadGoogleConfig,
    FormatGoogleDueDate,
    ParseGoogleStateToken,
    ParseGoogleDueDate,
    RefreshGoogleAccessToken,
    UpdateGoogleTask,
)
from app.modules.integrations.google.tasks_schemas import (
    GoogleTaskCreate,
    GoogleTaskDeleteResponse,
    GoogleTaskListResponse,
    GoogleTaskListsResponse,
    GoogleTaskOut,
    GoogleTaskOverdueRunResponse,
    GoogleTaskUpdate,
    GoogleTaskListOut,
)

router = APIRouter(prefix="/api/integrations/google", tags=["integrations"])
logger = logging.getLogger("integrations.google")
_TASKS_CACHE: dict[str, dict] = {}


def _cache_ttl_seconds() -> int:
    raw = os.getenv("GOOGLE_TASKS_CACHE_SECONDS", "").strip()
    if not raw:
        return 30
    try:
        return max(5, int(raw))
    except ValueError:
        return 30


def _cache_key(user_id: int, list_key: str) -> str:
    return f"{user_id}:{list_key}"


def _get_cached_tasks(cache_key: str) -> list[GoogleTaskOut] | None:
    entry = _TASKS_CACHE.get(cache_key)
    if not entry:
        return None
    if entry["expires_at"] < NowUtc():
        _TASKS_CACHE.pop(cache_key, None)
        return None
    return entry["tasks"]


def _set_cached_tasks(cache_key: str, tasks: list[GoogleTaskOut]) -> None:
    ttl_seconds = _cache_ttl_seconds()
    _TASKS_CACHE[cache_key] = {
        "tasks": tasks,
        "expires_at": NowUtc().replace(microsecond=0) + timedelta(seconds=ttl_seconds),
    }


def _invalidate_cache(*keys: str) -> None:
    for key in keys:
        _TASKS_CACHE.pop(key, None)


def _resolve_user_list_id(user_id: int) -> str:
    key = f"GOOGLE_LIST_ID_USER{user_id}"
    value = os.getenv(key, "").strip()
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required env var: {key}",
        )
    return value


def _resolve_shared_list_id() -> str:
    return _require_env("GOOGLE_LIST_ID_SHARED").strip()


def _resolve_access_token(db: Session) -> str:
    record = db.query(GoogleIntegration).first()
    if not record or not record.RefreshToken:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google integration not connected. Authenticate first.",
        )
    config = LoadGoogleConfig()
    payload = RefreshGoogleAccessToken(config, record.RefreshToken)
    access_token = payload.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google token refresh failed.",
        )
    return access_token


def _resolve_display_name(user: User) -> str:
    parts = [user.FirstName or "", user.LastName or ""]
    joined = " ".join([part for part in parts if part]).strip()
    return joined or user.Username


def _parse_google_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _parse_google_due_date(value: str | None) -> date | None:
    parsed = ParseGoogleDueDate(value)
    if not parsed:
        return None
    try:
        return datetime.strptime(parsed, "%Y-%m-%d").date()
    except ValueError:
        return None


def _map_google_task(
    item: dict,
    list_key: str,
    list_id: str,
    assigned_to_name: str | None = None,
    assigned_to_user_id: int | None = None,
) -> GoogleTaskOut:
    return GoogleTaskOut(
        Id=item.get("id", ""),
        Title=item.get("title") or "",
        Notes=item.get("notes") or None,
        DueDate=ParseGoogleDueDate(item.get("due")),
        IsCompleted=item.get("status") == "completed",
        ListKey=list_key,
        ListId=list_id,
        UpdatedAt=_parse_google_datetime(item.get("updated")),
        AssignedToUserId=assigned_to_user_id,
        AssignedToName=assigned_to_name,
    )


def _build_update_payload(payload: GoogleTaskUpdate) -> dict:
    update: dict = {}
    if payload.Title is not None:
        update["title"] = payload.Title
    if payload.Notes is not None:
        update["notes"] = payload.Notes
    if payload.DueDate is not None:
        if payload.DueDate:
            update["due"] = FormatGoogleDueDate(payload.DueDate)
        else:
            update["due"] = None
    if payload.IsCompleted is not None:
        if payload.IsCompleted:
            update["status"] = "completed"
            update["completed"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        else:
            update["status"] = "needsAction"
            update["completed"] = None
    return update


def _should_run_overdue(settings, now: datetime, force: bool) -> bool:
    if force:
        return True
    tz = ResolveOverdueReminderTimeZone(settings.OverdueReminderTimeZone)
    local_now = now.astimezone(tz)
    local_today = local_now.date()
    if settings.OverdueLastNotifiedDate == local_today:
        return False
    reminder_time = ResolveOverdueReminderTime(settings.OverdueReminderTime)
    return local_now.time() >= reminder_time


def _send_overdue_notifications(
    db: Session,
    *,
    items: list[dict],
    list_id: str,
    target_user_ids: list[int],
    created_by_user_id: int,
    now: datetime,
) -> tuple[int, int]:
    if not items or not target_user_ids:
        return 0, 0
    today = now.date()
    overdue_items: list[tuple[dict, date]] = []
    for item in items:
        if item.get("status") == "completed":
            continue
        due_date = _parse_google_due_date(item.get("due"))
        if not due_date or due_date >= today:
            continue
        overdue_items.append((item, due_date))

    if not overdue_items:
        return 0, 0

    task_ids = [item.get("id") for item, _ in overdue_items if item.get("id")]
    existing_rows = (
        db.query(GoogleTaskOverdueNotification)
        .filter(
            GoogleTaskOverdueNotification.GoogleTaskListId == list_id,
            GoogleTaskOverdueNotification.GoogleTaskId.in_(task_ids),
            GoogleTaskOverdueNotification.UserId.in_(target_user_ids),
        )
        .all()
    )
    existing_map = {(row.GoogleTaskId, row.UserId): row for row in existing_rows}

    notifications_sent = 0
    overdue_count = 0
    for item, due_date in overdue_items:
        task_id = item.get("id")
        if not task_id:
            continue
        eligible_user_ids = []
        for user_id in target_user_ids:
            entry = existing_map.get((task_id, user_id))
            if entry and entry.NotifiedAt.date() == today:
                continue
            eligible_user_ids.append(user_id)

        if not eligible_user_ids:
            continue

        task_title = item.get("title") or "Task overdue"
        CreateNotificationsForUsers(
            db,
            user_ids=eligible_user_ids,
            created_by_user_id=created_by_user_id,
            title="Task overdue",
            body=f"{task_title} was due {due_date.isoformat()}.",
            notification_type="TaskOverdue",
            link_url="/tasks",
            source_module="google_tasks",
            source_id=f"{list_id}:{task_id}",
        )

        for user_id in eligible_user_ids:
            entry = existing_map.get((task_id, user_id))
            if entry:
                entry.NotifiedAt = now
                entry.UpdatedAt = now
                db.add(entry)
            else:
                entry = GoogleTaskOverdueNotification(
                    GoogleTaskId=task_id,
                    GoogleTaskListId=list_id,
                    UserId=user_id,
                    NotifiedAt=now,
                    CreatedAt=now,
                    UpdatedAt=now,
                )
                db.add(entry)
                existing_map[(task_id, user_id)] = entry

        notifications_sent += len(eligible_user_ids)
        overdue_count += 1

    return notifications_sent, overdue_count


@router.get("/oauth/start")
def GoogleOauthStart(
    user=Depends(RequireModuleRole("settings", write=True)),
) -> dict:
    config = LoadGoogleConfig()
    state_token = CreateGoogleStateToken(user.Id)
    auth_url = BuildGoogleAuthUrl(config, state_token)
    return {"Url": auth_url}


@router.get("/status")
def GoogleIntegrationStatus(
    validate: bool = Query(default=False),
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> dict:
    record = db.query(GoogleIntegration).first()
    if not record:
        return {
            "Connected": False,
            "NeedsReauth": False,
            "ValidatedAt": None,
            "ValidationError": None,
        }

    connected_by = db.query(User).filter(User.Id == record.ConnectedByUserId).first()
    response = {
        "Connected": True,
        "NeedsReauth": False,
        "CalendarId": record.CalendarId,
        "TaskListId": record.TaskListId,
        "Scope": record.Scope,
        "ConnectedAt": record.ConnectedAt,
        "UpdatedAt": record.UpdatedAt,
        "ConnectedBy": {
            "Id": connected_by.Id,
            "Username": connected_by.Username,
            "FirstName": connected_by.FirstName,
            "LastName": connected_by.LastName,
            "Role": connected_by.Role,
        }
        if connected_by
        else None,
        "ValidatedAt": None,
        "ValidationError": None,
    }

    if not record.RefreshToken:
        response["NeedsReauth"] = True
        response["ValidationError"] = "Missing refresh token."
        return response

    if not validate:
        return response

    config = LoadGoogleConfig()
    try:
        RefreshGoogleAccessToken(config, record.RefreshToken)
        response["ValidatedAt"] = NowUtc()
    except Exception as exc:
        response["NeedsReauth"] = True
        response["ValidatedAt"] = NowUtc()
        response["ValidationError"] = str(exc)
    return response


@router.get("/tasks/lists", response_model=GoogleTaskListsResponse)
def GoogleTaskLists(
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> GoogleTaskListsResponse:
    user_record = db.query(User).filter(User.Id == user.Id).first()
    if not user_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    first_name = user_record.FirstName or ""
    display_name = _resolve_display_name(user_record)
    list_label = f"{first_name.strip()}'s list" if first_name.strip() else f"{display_name}'s list"
    lists = [
        GoogleTaskListOut(
            Key="user",
            Name=list_label,
            ListId=_resolve_user_list_id(user_record.Id),
            Type="user",
        ),
        GoogleTaskListOut(
            Key="family",
            Name="Family tasks",
            ListId=_resolve_shared_list_id(),
            Type="shared",
        ),
        GoogleTaskListOut(
            Key="shared",
            Name="Shared tasks",
            ListId=None,
            Type="assigned",
        ),
    ]
    return GoogleTaskListsResponse(Lists=lists)


@router.get("/tasks", response_model=GoogleTaskListResponse)
def GoogleTaskList(
    list_key: str = Query(..., min_length=1),
    refresh: bool = Query(default=False),
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> GoogleTaskListResponse:
    cache_key = _cache_key(user.Id, list_key)
    if not refresh:
        cached = _get_cached_tasks(cache_key)
        if cached is not None:
            return GoogleTaskListResponse(Tasks=cached)

    access_token = _resolve_access_token(db)
    if list_key == "shared":
        shares = (
            db.query(GoogleTaskShare)
            .filter(GoogleTaskShare.AssignedByUserId == user.Id)
            .all()
        )
        if not shares:
            _set_cached_tasks(cache_key, [])
            return GoogleTaskListResponse(Tasks=[])
        assigned_ids = {entry.AssignedToUserId for entry in shares}
        assigned_users = (
            db.query(User).filter(User.Id.in_(assigned_ids)).all() if assigned_ids else []
        )
        assigned_name_by_id = {entry.Id: _resolve_display_name(entry) for entry in assigned_users}
        shares_by_list: dict[str, list[GoogleTaskShare]] = {}
        for share in shares:
            shares_by_list.setdefault(share.GoogleTaskListId, []).append(share)
        results: list[GoogleTaskOut] = []
        stale_ids: list[int] = []
        for list_id, entries in shares_by_list.items():
            items = FetchGoogleTasks(access_token, list_id)
            task_by_id = {item.get("id"): item for item in items}
            for entry in entries:
                task_item = task_by_id.get(entry.GoogleTaskId)
                if not task_item:
                    stale_ids.append(entry.Id)
                    continue
                results.append(
                    _map_google_task(
                        task_item,
                        "shared",
                        list_id,
                        assigned_name_by_id.get(entry.AssignedToUserId),
                        entry.AssignedToUserId,
                    )
                )
        if stale_ids:
            db.query(GoogleTaskShare).filter(GoogleTaskShare.Id.in_(stale_ids)).delete(
                synchronize_session=False
            )
            db.commit()
        _set_cached_tasks(cache_key, results)
        return GoogleTaskListResponse(Tasks=results)

    if list_key == "user":
        list_id = _resolve_user_list_id(user.Id)
    elif list_key == "family":
        list_id = _resolve_shared_list_id()
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid list key.")

    items = FetchGoogleTasks(access_token, list_id)
    tasks = [_map_google_task(item, list_key, list_id) for item in items]
    _set_cached_tasks(cache_key, tasks)
    return GoogleTaskListResponse(Tasks=tasks)


@router.post("/tasks", response_model=GoogleTaskOut, status_code=status.HTTP_201_CREATED)
def GoogleTaskCreateItem(
    payload: GoogleTaskCreate,
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> GoogleTaskOut:
    access_token = _resolve_access_token(db)
    assigned_to_user_id = payload.AssignedToUserId
    list_key = payload.ListKey

    assigned_user = None
    if assigned_to_user_id and assigned_to_user_id != user.Id:
        assigned_user = db.query(User).filter(User.Id == assigned_to_user_id).first()
        if not assigned_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned user not found")
        list_id = _resolve_user_list_id(assigned_user.Id)
        list_key = "shared"
    else:
        if list_key == "shared":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a user to share this task with.",
            )
        if list_key == "user":
            list_id = _resolve_user_list_id(user.Id)
        elif list_key == "family":
            list_id = _resolve_shared_list_id()
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid list key.")

    create_payload: dict = {"title": payload.Title}
    if payload.Notes is not None:
        create_payload["notes"] = payload.Notes
    if payload.DueDate:
        create_payload["due"] = FormatGoogleDueDate(payload.DueDate)

    try:
        created = CreateGoogleTask(access_token, list_id, create_payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if assigned_user:
        share = GoogleTaskShare(
            GoogleTaskId=created.get("id"),
            GoogleTaskListId=list_id,
            AssignedToUserId=assigned_user.Id,
            AssignedByUserId=user.Id,
            CreatedAt=NowUtc(),
            UpdatedAt=NowUtc(),
        )
        db.add(share)
        db.commit()
        _invalidate_cache(
            _cache_key(user.Id, "shared"),
            _cache_key(assigned_user.Id, "user"),
        )
        return _map_google_task(
            created,
            list_key,
            list_id,
            _resolve_display_name(assigned_user),
            assigned_user.Id,
        )

    _invalidate_cache(_cache_key(user.Id, list_key))
    return _map_google_task(created, list_key, list_id)


@router.put("/tasks/{task_id}", response_model=GoogleTaskOut)
def GoogleTaskUpdateItem(
    task_id: str,
    payload: GoogleTaskUpdate,
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> GoogleTaskOut:
    access_token = _resolve_access_token(db)
    list_key = payload.ListKey
    assigned_to_name = None
    assigned_to_user_id = None

    if list_key == "shared":
        share = (
            db.query(GoogleTaskShare)
            .filter(
                GoogleTaskShare.GoogleTaskId == task_id,
                GoogleTaskShare.AssignedByUserId == user.Id,
            )
            .first()
        )
        if not share:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared task not found")
        list_id = share.GoogleTaskListId
        assigned_to_user_id = share.AssignedToUserId
        assigned_user = db.query(User).filter(User.Id == assigned_to_user_id).first()
        assigned_to_name = _resolve_display_name(assigned_user) if assigned_user else None
        share.UpdatedAt = NowUtc()
        db.add(share)
    elif list_key == "user":
        list_id = _resolve_user_list_id(user.Id)
    elif list_key == "family":
        list_id = _resolve_shared_list_id()
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid list key.")

    update_payload = _build_update_payload(payload)
    try:
        updated = UpdateGoogleTask(access_token, list_id, task_id, update_payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    db.commit()
    if list_key == "shared" and assigned_to_user_id:
        _invalidate_cache(
            _cache_key(user.Id, "shared"),
            _cache_key(assigned_to_user_id, "user"),
        )
    else:
        _invalidate_cache(_cache_key(user.Id, list_key))
    return _map_google_task(updated, list_key, list_id, assigned_to_name, assigned_to_user_id)


@router.delete("/tasks/{task_id}", response_model=GoogleTaskDeleteResponse)
def GoogleTaskDeleteItem(
    task_id: str,
    list_key: str = Query(..., min_length=1),
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> GoogleTaskDeleteResponse:
    access_token = _resolve_access_token(db)
    share = None
    if list_key == "shared":
        share = (
            db.query(GoogleTaskShare)
            .filter(
                GoogleTaskShare.GoogleTaskId == task_id,
                GoogleTaskShare.AssignedByUserId == user.Id,
            )
            .first()
        )
        if not share:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared task not found")
        list_id = share.GoogleTaskListId
    elif list_key == "user":
        list_id = _resolve_user_list_id(user.Id)
    elif list_key == "family":
        list_id = _resolve_shared_list_id()
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid list key.")

    try:
        DeleteGoogleTask(access_token, list_id, task_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if share:
        db.delete(share)
    db.commit()
    if share:
        _invalidate_cache(_cache_key(user.Id, "shared"), _cache_key(share.AssignedToUserId, "user"))
    else:
        _invalidate_cache(_cache_key(user.Id, list_key))
    return GoogleTaskDeleteResponse()


@router.post("/tasks/overdue/run", response_model=GoogleTaskOverdueRunResponse)
def RunGoogleTaskOverdueNotifications(
    force: bool = Query(default=False),
    db: Session = Depends(GetDb),
    user=Depends(RequireModuleRole("settings", write=True)),
) -> GoogleTaskOverdueRunResponse:
    access_token = _resolve_access_token(db)
    now = NowUtc()
    users = db.query(User).all()

    eligible_users: list[User] = []
    user_list_targets: list[tuple[int, str]] = []
    for user_record in users:
        settings = EnsureTaskSettings(db, user_record.Id, now)
        if not _should_run_overdue(settings, now, force):
            continue
        tz = ResolveOverdueReminderTimeZone(settings.OverdueReminderTimeZone)
        settings.OverdueLastNotifiedDate = now.astimezone(tz).date()
        settings.UpdatedAt = now
        db.add(settings)
        eligible_users.append(user_record)
        list_id = os.getenv(f"GOOGLE_LIST_ID_USER{user_record.Id}", "").strip()
        if list_id:
            user_list_targets.append((user_record.Id, list_id))

    notifications_sent = 0
    overdue_tasks = 0

    for user_id, list_id in user_list_targets:
        try:
            items = FetchGoogleTasks(access_token, list_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        sent, overdue = _send_overdue_notifications(
            db,
            items=items,
            list_id=list_id,
            target_user_ids=[user_id],
            created_by_user_id=user.Id,
            now=now,
        )
        notifications_sent += sent
        overdue_tasks += overdue

    if eligible_users:
        shared_list_id = _resolve_shared_list_id()
        try:
            shared_items = FetchGoogleTasks(access_token, shared_list_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        sent, overdue = _send_overdue_notifications(
            db,
            items=shared_items,
            list_id=shared_list_id,
            target_user_ids=[entry.Id for entry in eligible_users],
            created_by_user_id=user.Id,
            now=now,
        )
        notifications_sent += sent
        overdue_tasks += overdue

    db.commit()
    return GoogleTaskOverdueRunResponse(
        UsersProcessed=len(eligible_users),
        NotificationsSent=notifications_sent,
        OverdueTasks=overdue_tasks,
    )


@router.get("/oauth/callback")
def GoogleOauthCallback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(GetDb),
):
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    if not code or not state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth response.")

    try:
        user_id = ParseGoogleStateToken(state)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user = db.query(User).filter(User.Id == user_id).first()
    if not user or user.Role != "Parent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    config = LoadGoogleConfig()
    try:
        token_payload = ExchangeGoogleCode(config, code)
    except ValueError as exc:
        logger.warning("Google token exchange failed", extra={"user_id": user.Id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    refresh_token = token_payload.get("refresh_token")
    token_type = token_payload.get("token_type")
    scope = token_payload.get("scope")
    now = NowUtc()

    record = db.query(GoogleIntegration).first()
    if record:
        if refresh_token:
            record.RefreshToken = refresh_token
        elif not record.RefreshToken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google did not return a refresh token. Revoke access and try again.",
            )
        record.TokenType = token_type or record.TokenType
        record.Scope = scope or record.Scope
        record.CalendarId = config.CalendarId or record.CalendarId
        record.TaskListId = config.TaskListId or record.TaskListId
        record.ConnectedByUserId = user.Id
        record.UpdatedAt = now
        db.add(record)
    else:
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google did not return a refresh token. Revoke access and try again.",
            )
        record = GoogleIntegration(
            RefreshToken=refresh_token,
            TokenType=token_type,
            Scope=scope,
            CalendarId=config.CalendarId,
            TaskListId=config.TaskListId,
            ConnectedByUserId=user.Id,
            ConnectedAt=now,
            UpdatedAt=now,
        )
        db.add(record)

    db.commit()

    base_url = _require_env("APP_PUBLIC_URL").rstrip("/")
    redirect_url = f"{base_url}/settings/integrations?connected=google"
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
