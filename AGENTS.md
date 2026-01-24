# AGENTS.md

## 1) General Agent Instructions (portable)

### Role
You are a coding agent operating in a VS Code + remote Linux host workflow. Deliver working increments quickly, with clean structure and a bias toward low-friction iteration.

### Working style
- Ship the smallest viable change that moves the feature forward.
- Prefer predictable, boring solutions over clever ones.
- Keep changes scoped. Avoid sprawling refactors unless explicitly requested.
- Preserve existing conventions unless they are actively harmful.
- Do not ask questions unless truly blocking. Make a reasonable assumption and proceed, stating the assumption.

### Communication (every implementation response)
Include:
- What you changed (file paths)
- How to run/verify (fast path first)
- Any follow-ups or TODOs you intentionally deferred
- Note any skipped checks (lint/tests/CI parity/audits) and why

### Modes (Build vs Discovery)

#### Automatic mode selection
- If the user prompt includes a "?" character, treat the prompt as Discovery Mode.
- If the user prompt contains no "?" character, treat the prompt as Build Mode.

#### Build Mode
- Ship the smallest viable increment.
- QuestionLimit: 2 (per task)
- AssumptionBudget: 3 (max assumptions per task). If more are needed, switch to Discovery Mode and ask a single batch.
- Prefer reversible decisions when uncertain.
- If a prompt is otherwise Build Mode but contains a direct question, answer it before any implementation and confirm any blocking assumptions.
- Always include in the response:
  - Assumptions
  - Decisions
  - OpenQuestions (only if non-blocking)
- When listing QuickNotes/Assumptions/Decisions/OpenQuestions, prefix each item with a short id (q1:, a1:, d1:, o1:).

#### Discovery Mode
- Ask questions in a single batch, grouped by:
  - MustAnswerNow (blocking)
  - CanAssume (provide 1-2 recommended defaults for each)
- QuestionLimit: 10 (total)
- Do not start feature implementation until MustAnswerNow is answered.
- You may proceed with scaffolding only if it is non-committal and clearly labelled as scaffolding.
- When listing QuickNotes/MustAnswerNow/CanAssume, prefix each item with a short id (q1:, m1:, c1:).

#### Manual override
- The user can force a mode by starting the prompt with:
  - "Build Mode:" or "Discovery Mode:"
- Optional overrides:
  - "AssumptionBudget=N"
  - "QuestionLimit=N"
  - "Discovery Mode: MustAnswerNow only"

### Dev efficiency (Codex-friendly)
- Optimise for short feedback loops.
- Use a tiered verification approach:
  - Tier 1: FastChecks (default)
  - Tier 2: FeatureChecks
  - Tier 3: ReleaseChecks
- If tests are slow, prioritise Tier 1 during implementation, then Tier 2 at the end, then Tier 3 when requested.

### Code quality baselines
- Keep functions small and composable.
- Prefer pure functions for calculations and business rules.
- Add types/schemas at boundaries (API, persistence, UI forms).
- Centralise constants and configuration.
- Avoid duplication when clearly recurring, but do not over-abstract early.

### Error handling and safety
- Fail fast with clear messages.
- Validate inputs at boundaries.
- Log actionable context (but never secrets).

### Repo hygiene
- Small commits, descriptive messages.
- Update README when behaviour or setup changes.
- Keep scripts repeatable and CI-friendly.

### Completion definition
A task is “done” when:
- The feature works end-to-end in the intended flow.
- FastChecks pass (or skipped with a stated reason).
- Lint is clean with zero warnings/errors when lint is available.
- Deferred items are captured as TODOs with clear next steps.


---

## 2) Everday Project Instructions (specific)

### Environment naming
- DEV = `scripts/dev.sh` with `docker-compose.traefik.dev.yml` using `.env.dev`
- PROD = main stack compose at `/mnt/docker/config/dockerconfigs/docker-compose.yml`

### Shared SQL (hosted in main stack)
- Single SQL Server container: `batserver-sql`
- Databases: `EVERDAY-DEV` and `EVERDAY-PROD`
- Bootstrap schema/login:
  - `scripts/sql/bootstrap-everday.sh <dev|prod>`

### Prod deployment steps (only when asked)
- Update `/mnt/docker/config/dockerconfigs/.env` for prod variables.
- Update `/mnt/docker/config/dockerconfigs/docker-compose.yml` if new env passthrough or ports are required.
- Deploy: `docker compose -f /mnt/docker/config/dockerconfigs/docker-compose.yml up -d everday`
- Run migrations after deploy: `docker exec -it everday alembic upgrade head`
- Verify: `https://everday.batserver.au/api/health` and spot-check the feature area.

### Stack expectations
- Backend: FastAPI + SQLAlchemy + Alembic
- DB: SQL Server (MSSQL)
- Frontend: React + Vite + CSS (no Tailwind)
- Deploy: Docker Compose (dev and prod)

### Documentation pointers
- Architecture rules: `docs/architecture.md`
- UI rules: `docs/style_guide.md`

### UI/UX implementation rules (must follow)
- Follow `docs/style_guide.md` for all UI work.
- Desktop-first with mobile-friendly critical flows.
- Accessibility as default (labels, focus states, contrast).
- No em dashes in UI copy.
- No unstyled controls:
  - No unstyled buttons.
  - No raw `<input>`, `<select>`, or `<textarea>` without standard styling or shared primitives.
- Overlays:
  - Dropdowns/popovers/menus must render via a portal.
  - Do not use z-index hacks to “fix” stacking/clipping.
- AppShell layout contract:
  - Sidebar and top bar must be owned by a single AppShell layout.
  - Pages must not re-implement global layout behaviour.
- Commit UX:
  - Primary commit actions are disabled until the form is dirty and valid.
  - Advanced options are collapsed by default when present.
- Progress:
  - Clamp progress bars at 100% and represent overflow explicitly (badge/secondary indicator).

### SQLAlchemy note
- SQL Server boolean comparisons should use `== True/False` instead of `.is_(True/False)` to avoid `IS 0` syntax errors.

### Data and migrations
- Any schema change requires an Alembic migration.
- Migrations and seed scripts must be idempotent and safe to rerun.
- Keep backward compatibility where practical.

### Security (RBAC + ownership)
Core principles:
- Multi-user from day one. Every record is owned by a user.
- RBAC is enforced server-side on every endpoint.
- Backend is the source of truth for calculations. Frontend shows computed results.

Authentication and authorisation:
- Required for all non-auth endpoints.
- Passwords must be hashed using a modern KDF (Argon2id preferred; bcrypt acceptable).
- JWT access tokens (short TTL) + refresh tokens with rotation.
- Refresh tokens must be stored hashed in the DB and revocable.
- Enforce per-user isolation at query boundaries (repository/service). Never rely on UI filtering.

Roles:
- Parent
- Kid

Scope model:
- Every domain record is owned by a `UserId`.
- Visibility and mutation is controlled by:
  - Role (what actions are permitted)
  - Ownership (which records are permitted)

Default permissions:
- Kid:
  - Can use the kids portal and kids APIs.
  - Cannot access non-kids modules.
- Parent:
  - Full read/write across modules and settings.
  - Can manage users/roles and link kids.

Enforcement rules:
- Never trust role claims from the client.
- Authorisation must be enforced in backend dependencies/middleware and checked per route.
- Use explicit policy helpers where applicable:
  - RequireAuthenticated
  - RequireModuleRole(module, write)
  - RequireKidsMember
  - RequireKidsManager
- Unit test policy decisions (happy + deny paths).

### Logging
- Request middleware logs method/path/status/latency and sets `X-Request-Id` on responses.
- Log to file with rotation.
- All log configuration is driven by `.env`:
  - LOG_LEVEL
  - LOG_FILE_PATH
  - FRONTEND_LOG_FILE_PATH
  - LOG_MAX_BYTES
  - LOG_BACKUP_COUNT
  - LOG_JSON_ENABLED
- Never log secrets (tokens, passwords, auth headers). Redact sensitive headers by default.

### Adhoc scripts and documentation
- Place one-off validation scripts in `./_temp/` (create if missing).
- Place dev scripts in `./scripts/`.
- Keep `./docs/` sparse. Only add docs when explicitly requested.
- When integrating any external API (including AI APIs), first create an adhoc script in `./_temp/` to validate request/response shape, auth, errors, rate limits, retries/timeouts.

### Verification targets (minimum)
- Unit tests for:
  - Schedule generation across date boundaries (month/year, leap year)
  - Range summaries
  - Allocation remainder distribution and >100% validation
  - RBAC policy checks (allow/deny)
- A simple API smoke test script or minimal e2e happy path is acceptable as FeatureChecks.

### Modularity and routing (frontend)
- App.jsx must stay thin (providers + routing only). No feature state/effects in App.jsx.
- Each route has its own page component under `/src/pages/<PageName>/`.
- Feature logic lives in hooks under `/src/hooks` (fetching, mutations, table prefs, calculations).
- Shared UI goes in `/src/components`; shared utilities/constants in `/src/lib`.
- Routing is required for top-level areas (e.g. /income, /expenses, /allocations, /settings).
