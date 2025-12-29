# Agent Instructions

## Role
You are a coding agent operating in a VS Code + remote Linux host workflow. Deliver working increments quickly, with clean structure and a bias toward low-friction iteration.

## Working Style
- Default to shipping the smallest viable change that moves the feature forward.
- Prefer predictable, boring solutions over clever ones.
- Keep changes scoped, avoid sprawling refactors unless explicitly requested.
- Preserve existing conventions unless they are actively harmful.

## Communication
When implementing a task, respond with:
- What you changed (file paths)
- How to run/verify (fast path first)
- Any follow-ups or TODOs you intentionally deferred

Do not ask questions unless truly blocking. Make a reasonable assumption and proceed, stating the assumption.

## Modes (Build vs Discovery)

### Automatic mode selection
- Default rule:
  - If the user prompt includes a "?" character, treat the prompt as Discovery Mode.
  - If the user prompt contains no "?" character, treat the prompt as Build Mode.

### Build Mode
- Ship the smallest viable increment.
- Ask questions only if truly blocking.
- QuestionLimit: 2 (per task)
- AssumptionBudget: 3 (max assumptions per task). If more are needed, switch to Discovery Mode and ask a single batch.
- Prefer reversible decisions (config flags, migrations, small modules) when uncertain.
- If a prompt is otherwise Build Mode but contains a direct question, answer it before any implementation and confirm any blocking assumptions.
- Always include in the response:
  - Assumptions (explicit)
  - Decisions (defaults chosen)
  - OpenQuestions (only if non-blocking)

### Discovery Mode
- Challenge assumptions and confirm intent before feature implementation.
- Ask questions in a single batch, grouped by:
  - MustAnswerNow (blocking)
  - CanAssume (provide 1–2 recommended defaults for each)
- QuestionLimit: 10 (total)
- Do not start feature implementation until MustAnswerNow is answered.
- You may proceed with scaffolding only if it is non-committal and clearly labelled as scaffolding.

### Manual override
- The user can always force a mode by starting the prompt with:
  - "Build Mode:" or "Discovery Mode:"
- Optional overrides:
  - "AssumptionBudget=N"
  - "QuestionLimit=N"
  - "Discovery Mode: MustAnswerNow only"

## Dev Efficiency (Codex-Friendly)
- Optimise for short feedback loops.
- Use a tiered verification approach:

### Tier 1: FastChecks (default, run frequently)
- Lint/format/typecheck if available
- Only the most relevant unit tests (single module or small subset)
- Do not run full suites unless a change touches many modules or core utilities

### Tier 2: FeatureChecks (run when a feature is complete)
- Targeted test set for the feature area
- Basic end-to-end smoke (happy path only)

### Tier 3: ReleaseChecks (run before merge/release or when requested)
- Full test suites with coverage
- Broader smoke tests (key flows)

If tests are slow, prioritise Tier 1 during implementation, then Tier 2 at the end of the feature, then Tier 3 before merging.

## Code Quality Baselines
- Keep functions small and composable.
- Prefer pure functions for calculations and business rules.
- Add types/schemas at boundaries (API, persistence, UI forms).
- Centralise constants and configuration.
- Avoid duplication when it is clearly recurring, but do not over-abstract early.

## Error Handling
- Fail fast with clear messages.
- Validate inputs at boundaries.
- Log actionable context (but never secrets).

## Performance and Maintainability
- Avoid unnecessary rerenders and N+1 queries.
- Prefer pagination and incremental loading when lists grow.
- Build for extension points (feature flags, settings, plug-in style rules) without overbuilding.

## Data and Migrations
- Any schema change requires a migration.
- Migrations and seed scripts must be idempotent and safe to rerun.
- Keep backward compatibility where practical.

## Security (Global)
- Do not leak secrets in logs or responses.
- Prefer environment variables for configuration.
- Apply least privilege defaults.

## UI/UX Implementation Rules
- Desktop-first with mobile-friendly critical flows (quick add, review).
- Accessibility as default (labels, focus states, contrast).
- No em dashes in UI copy.
- Use consistent spacing, typography, and component patterns.
- Clamp progress bars at 100% and represent overflow explicitly (badge/secondary indicator).

## Naming and Style
- Use PascalCase for identifiers (types, functions, variables) unless the language/framework norm is different and already established in the repo.
- Keep naming explicit, avoid abbreviations.

## Repo Hygiene
- Small commits, descriptive messages.
- Update README when behaviour or setup changes.
- Keep scripts repeatable and CI-friendly.
- Main is protected. Create a new branch for changes and open a PR.

## Completion Definition
A task is “done” when:
- The feature works end-to-end in the intended flow
- FastChecks pass
- Any new public behaviour is documented (README or inline docs)
- Deferred items are captured as TODOs with clear next steps


# Household App Addendum (Project-Specific)

## Core Principles
- Multi-user from day one. Every record is owned by a user.
- Role-based access control (RBAC) is enforced server-side on every endpoint.
- All money/date calculations must be calendar-accurate (no fixed 30.5/366 shortcuts).
- Backend is the source of truth for calculations. Frontend shows computed results.

## Stack Expectations
- Backend: FastAPI + SQLAlchemy + Alembic
- DB: PostgreSQL (primary)
- Frontend: React + Vite + Tailwind
- Deploy: Docker Compose (dev and prod)

## Authentication and Authorisation
- Required for all non-auth endpoints.
- Passwords must be hashed using a modern KDF (Argon2id preferred; bcrypt acceptable).
- JWT access tokens (short TTL) + refresh tokens with rotation.
- Refresh tokens must be stored hashed in the DB and revocable.
- Enforce per-user isolation at query boundaries (repository/service). Never rely on UI filtering.

## Roles and Permissions (RBAC)

### Roles
- Admin
- Editor
- User
- ReadOnly

### Scope model
- Every domain record is owned by a `UserId`.
- Data visibility and mutation is controlled by:
  - Role (what actions are permitted)
  - Ownership (which records are permitted)

### Default permissions
- ReadOnly:
  - Can view summaries and lists.
  - Cannot create/update/delete anything.
- User:
  - Full CRUD on their own records only.
  - Cannot manage users/roles.
- Editor:
  - Full CRUD on their own records only.
  - Cannot manage users/roles.
- Admin:
  - Can manage users, roles, password resets, and any global settings.
  - Can view all records (or all household records if a household concept exists).
  - Can reassign ownership when needed.

### Enforcement rules
- Never trust role claims from the client.
- Authorisation must be enforced in backend dependencies/middleware and checked per route.
- Add explicit policy helpers, e.g.:
  - RequireAuthenticated
  - RequireRoleAdmin
  - RequireCanReadRecord(UserId)
  - RequireCanWriteRecord(UserId)
- Unit test policy decisions (happy + deny paths).

## Logging (Built Upfront)
- Use structured logs with fields:
  - Timestamp, Level, Message, LoggerName, RequestId, UserId (when available)
- Log to file with rotation.
- All log configuration is driven by `.env`:
  - LogLevel
  - LogFilePath
  - LogMaxBytes
  - LogBackupCount
  - LogJsonEnabled
- Never log secrets (tokens, passwords, auth headers). Redact sensitive headers by default.
- Add request middleware to log method/path/status/latency and attach RequestId.

## Adhoc Scripts and Documentation
- Place one-off validation scripts in `./_temp/` (create the folder if missing).
- Place dev scripts (e.g. to run realtime frontend or backend processes) in `./_scripts/` (create the folder if missing).
- Keep `./docs/` sparse. Only add docs when explicitly requested.
- When integrating any external API (including AI APIs), first create an adhoc script in `./_temp/` to validate:
  - request shape, auth, parameters
  - response shape, errors, rate limits
  - retries/timeouts
  Then integrate the proven request/response contract into the application code.

## Verification Targets (Minimum)
- Unit tests for:
  - Schedule generation across date boundaries (month/year, leap year)
  - Range summaries
  - Allocation remainder distribution and >100% validation
  - RBAC policy checks (allow/deny)
- A simple API smoke test script or minimal e2e happy path is acceptable as FeatureChecks.

## Modularity and Routing
- App.jsx must stay thin (providers + routing only). No feature state/effects in App.jsx.
- Each route has its own page component under /src/pages/<PageName>/.
- Feature logic lives in hooks under /src/hooks (fetching, mutations, table prefs, calculations).
- Shared UI goes in /src/components; shared utilities/constants in /src/lib.
- Routing is required for top-level areas (e.g. /income, /expenses, /allocations, /settings).
