"""Manage scoped Everday API tokens from inside the Everday container.

Plaintext tokens are printed only by the create command. Do not redirect its
output to a committed file or paste it into logs.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import app.db as db_module
from app.modules.auth.api_tokens import CreateApiToken, HEALTH_DASHBOARD_READ_SCOPE, ListApiTokens, RevokeApiToken
from app.modules.auth.models import User


def _UserId(db, username: str) -> int:
    user = db.query(User).filter(User.Username == username).first()
    if user is None:
        raise SystemExit("User not found.")
    return int(user.Id)


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage scoped Everday API tokens.")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--user", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--expires-at", help="Optional ISO-8601 timestamp.")
    listing = commands.add_parser("list")
    listing.add_argument("--user", required=True)
    revoke = commands.add_parser("revoke")
    revoke.add_argument("--user", required=True)
    revoke.add_argument("--token-id", required=True)
    args = parser.parse_args()

    db_module._ensure_engine()
    if db_module.SessionLocal is None:
        raise RuntimeError("Database session factory is unavailable.")
    db = db_module.SessionLocal()
    try:
        user_id = _UserId(db, args.user)
        if args.command == "create":
            expires_at = datetime.fromisoformat(args.expires_at) if args.expires_at else None
            if expires_at is not None and expires_at.tzinfo is None:
                raise SystemExit("--expires-at must include an explicit timezone offset.")
            if expires_at is not None:
                expires_at = expires_at.astimezone(timezone.utc)
            record, plaintext = CreateApiToken(
                db, user_id, args.name, {HEALTH_DASHBOARD_READ_SCOPE}, expires_at=expires_at
            )
            print(f"Token ID: {record.Id}")
            print(f"Token: {plaintext}")
            return
        if args.command == "list":
            for record in ListApiTokens(db, user_id):
                print(
                    f"{record.Id}\t{record.Name}\t{record.Scopes}\t"
                    f"created={record.CreatedAt}\texpires={record.ExpiresAt}\t"
                    f"last_used={record.LastUsedAt}\trevoked={record.RevokedAt}"
                )
            return
        if not RevokeApiToken(db, args.token_id, user_id):
            raise SystemExit("Active token not found.")
        print("Token revoked.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
