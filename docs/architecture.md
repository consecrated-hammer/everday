# Architecture

## Overview
Everyday is a multi-user household app with a FastAPI backend, SQL Server database, and a React + Vite frontend. The backend is the source of truth for all calculations and access control.

## Stack
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: MSSQL
- Frontend: React, Vite, CSS (no Tailwind)
- Deploy: Docker Compose (dev and prod)

## Topology
- Frontend calls backend APIs over HTTP.
- Backend enforces auth and RBAC on every non-auth route.
- Backend reads/writes MSSQL via SQLAlchemy.

## Data Ownership and RBAC
- Every record is owned by a `UserId`.
- Roles: Parent, Kid (global; kids are restricted to the kids portal).
- Authorization is enforced server-side per route and per record using policy helpers.

## Authentication
- JWT access tokens (short TTL) + refresh tokens with rotation.
- Refresh tokens are stored hashed and are revocable.

## Logging
- Structured logs with RequestId and UserId when available.
- File logging with rotation; configuration via `.env`.
- Sensitive headers and secrets are redacted.

## Environments
- DEV: `scripts/dev.sh` with `docker-compose.traefik.dev.yml` and `.env.dev`.
- PROD: `/mnt/docker/config/dockerconfigs/docker-compose.yml`.

## Data and Migrations
- All schema changes go through Alembic migrations.
- Migrations and seed scripts must be idempotent.
