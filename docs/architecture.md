# Architecture

## Overview
Everday is a multi-user household app with a FastAPI backend, SQL Server database, and a React + Vite frontend. The backend is the source of truth for calculations and access control.

## Stack
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: MSSQL
- Frontend: React, Vite, CSS (no Tailwind)
- Deploy: Docker Compose (dev and prod)

## Topology
- Frontend calls backend APIs over HTTP.
- Backend enforces auth and role checks on every non-auth route.
- Backend reads/writes MSSQL via SQLAlchemy.
- The backend can serve the built SPA from `backend/app/static` when present.

## Data Ownership and Access Control
- Every record is owned by a `UserId`.
- Global roles: `Parent`, `Kid`.
- Module gating uses `RequireModuleRole(module, write=...)`:
  - `Kid` can only access the `kids` module.
  - `Parent` can access all modules; write endpoints require `Parent`.
- Authorization is enforced server-side per route and per record.

## Authentication
- Passwords are hashed with Argon2id.
- JWT access tokens (short TTL) + refresh tokens with rotation.
- Refresh tokens are stored hashed and are revocable.

## Logging
- Request middleware logs method/path/status/latency and sets `X-Request-Id` on responses.
- File logging with rotation; configuration via env vars:
  - `LOG_LEVEL`, `LOG_FILE_PATH`, `FRONTEND_LOG_FILE_PATH`
  - `LOG_MAX_BYTES`, `LOG_BACKUP_COUNT`, `LOG_JSON_ENABLED`
- Avoid logging sensitive headers or secrets.

## Environments
- DEV: `scripts/dev.sh` with `docker-compose.traefik.dev.yml` and `.env.dev`.
- PROD: `/mnt/docker/config/dockerconfigs/docker-compose.yml`.

## Data and Migrations
- All schema changes go through Alembic migrations.
- Migrations and seed scripts must be idempotent.
