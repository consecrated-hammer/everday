import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import NowUtc, RequireAuthenticated, RequireModuleRole, _require_env
from app.modules.auth.models import User
from app.modules.integrations.gmail.models import GmailIntegration
from app.modules.integrations.gmail.service import (
    BuildGmailAuthUrl,
    CreateGmailStateToken,
    ExchangeGmailCode,
    FetchProfileEmail,
    LoadGmailConfig,
    ParseGmailStateToken,
    RefreshAccessToken,
)

router = APIRouter(prefix="/api/integrations/gmail", tags=["integrations"])
logger = logging.getLogger("integrations.gmail")


@router.get("/oauth/start")
def GmailOauthStart(
    user=Depends(RequireModuleRole("settings", write=True)),
) -> dict:
    config = LoadGmailConfig()
    state_token = CreateGmailStateToken(user.Id)
    auth_url = BuildGmailAuthUrl(config, state_token)
    return {"Url": auth_url}


@router.get("/status")
def GmailIntegrationStatus(
    validate: bool = Query(default=False),
    db: Session = Depends(GetDb),
    user=Depends(RequireAuthenticated),
) -> dict:
    record = db.query(GmailIntegration).first()
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
        "AccountEmail": record.AccountEmail,
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

    config = LoadGmailConfig()
    try:
        RefreshAccessToken(config, record.RefreshToken)
        response["ValidatedAt"] = NowUtc()
    except Exception as exc:  # noqa: BLE001
        response["NeedsReauth"] = True
        response["ValidatedAt"] = NowUtc()
        response["ValidationError"] = str(exc)
    return response


@router.get("/oauth/callback")
def GmailOauthCallback(
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
        user_id = ParseGmailStateToken(state)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user = db.query(User).filter(User.Id == user_id).first()
    if not user or user.Role != "Parent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    config = LoadGmailConfig()
    try:
        token_payload = ExchangeGmailCode(config, code)
    except ValueError as exc:
        logger.warning("Gmail token exchange failed", extra={"user_id": user.Id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    refresh_token = token_payload.get("refresh_token")
    token_type = token_payload.get("token_type")
    scope = token_payload.get("scope")
    access_token = token_payload.get("access_token")
    account_email = None
    if access_token:
        try:
            account_email = FetchProfileEmail(access_token)
        except Exception:  # noqa: BLE001
            account_email = None
    now = NowUtc()

    record = db.query(GmailIntegration).first()
    if record:
        if refresh_token:
            record.RefreshToken = refresh_token
        elif not record.RefreshToken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gmail did not return a refresh token. Revoke access and try again.",
            )
        record.TokenType = token_type or record.TokenType
        record.Scope = scope or record.Scope
        record.AccountEmail = account_email or record.AccountEmail
        record.ConnectedByUserId = user.Id
        record.UpdatedAt = now
        db.add(record)
    else:
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gmail did not return a refresh token. Revoke access and try again.",
            )
        record = GmailIntegration(
            RefreshToken=refresh_token,
            TokenType=token_type,
            Scope=scope,
            AccountEmail=account_email,
            ConnectedByUserId=user.Id,
            ConnectedAt=now,
            UpdatedAt=now,
        )
        db.add(record)

    db.commit()

    base_url = _require_env("APP_PUBLIC_URL").rstrip("/")
    redirect_url = f"{base_url}/settings/integrations?connected=gmail"
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
