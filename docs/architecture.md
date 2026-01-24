# Architecture

## Overview
Everday is a multi-user household app with a FastAPI backend, SQL Server database, and a React + Vite frontend. The backend is the source of truth for calculations and access control. The frontend follows a strict UI primitives and layout contract to ensure consistent theming and predictable behaviour.

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
- Authorisation is enforced server-side:
  - per route (module role)
  - per record (ownership)

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

## Frontend UI Architecture (Refresh Contract)
The UI refresh is implemented without changing the backend stack. To prevent layout drift and theming inconsistencies, the following constraints apply.

### AppShell is the single source of truth for layout
- All authenticated pages render inside a single `AppShell` component that owns:
  - Docked left navigation (desktop)
  - Collapsible sidebar behaviour
  - Top bar (page title, search, global actions)
  - Content padding and desktop density defaults
- Pages must not re-implement global layout behaviour.

### UI primitives are mandatory
All modules must use shared primitives. Do not introduce one-off styling for core controls.
Required primitives:
- `Button` (primary, secondary, ghost, destructive, icon)
- `Input`, `TextArea`
- `Select` / `DropdownMenu`
- `Modal` / `Dialog`
- `Popover`
- `Drawer`
- `Tabs` / `SegmentedControl`
- `DataTable` (dense defaults)
- `StatusPill` / `Badge`
- `ConfirmDialog`
- `Toast` / notifications

### Overlay and z-index rules (no clipping bugs)
- Dropdowns, popovers, and menus must render via a portal to a root overlay container.
- Do not “fix” overlay issues with arbitrary z-index values in page CSS.
- All overlays must be keyboard accessible and focus-managed (trap focus in modals).

### Commit UX pattern (Dockhand-style)
- Primary commit actions (Save/Update/Create) are disabled until:
  - the form is dirty (a change has been made), and
  - the form is valid
- “Advanced options” are collapsed by default (accordion/expander).

### Visual system alignment
- UI styling must follow `STYLE_GUIDE.md`, including:
  - Blue for active navigation/selection states
  - Teal for primary commit actions and focus rings
  - Dense desktop spacing rules for tables and forms

## Documentation
- UI rules: `STYLE_GUIDE.md`
- Agent rules: `AGENTS.md`
- This architecture document is evergreen and describes intended design constraints.
