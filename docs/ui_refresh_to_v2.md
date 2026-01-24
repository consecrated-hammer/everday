# UI Refresh Implementation Plan (Everday v2)

## Scope + goals
- Incrementally refresh the **existing React + Vite + global CSS** UI (no Tailwind). 
- Avoid big-bang rewrites (keep routes, API contracts, RBAC unchanged). RBAC and record ownership stay enforced server-side. 
- Achieve consistent patterns for:
  - Page headers and top action bars
  - Filters/search/toolbars for table pages
  - Sub-navigation (tabs/segments)
  - Buttons/inputs always styled via shared primitives (no “unstyled new control” regressions)

## Current state (constraints)
- Styling is **single global stylesheet + CSS variables**, with class-based patterns like `.primary-button`, `.modal`, `.dropdown`. 
- No MUI/Chakra/etc detected today. 
- Overlays are rendered inline (no portals) and z-index conventions are not centralised. 

## Target layout system (what “new layout” means)
### 1) App shell (global)
- Keep existing `AppShell.jsx`, but formalise:
  - Left sidebar: active module highlight uses **Blue**.
  - Teal becomes a strong secondary accent (focus rings, subtle selected states), but not confused with disabled.
- Top-right global actions remain consistent (notifications, account menu).

### 2) Page header (per route)
Standardise a `PageHeader` pattern:
- Left: title + optional description/breadcrumb.
- Right: primary actions (e.g. “Add”, “New”, “Save”), always in the same spot.
- Optional secondary row: `SubNav` (tabs/pills) or `FilterBar`.

### 3) FilterBar (tables and list-heavy pages)
A single pattern used everywhere:
- Left cluster: Search input + key filters (chips/selects/date range).
- Right cluster: table actions (Columns, Export, Bulk actions).
- Mobile: collapses to a “Filters” button opening a drawer/panel.

### 4) SubNav (module-level tabs)
Use one consistent component for:
- Budget (Allocations/Expenses/Income/Settings)
- Health (Today/Log/Foods/Insights)
- Settings sections

## Phasing plan (start with /settings)
### Phase 0: tokens + primitives foundation (1 PR)
**Goal:** Make it hard to create unstyled UI.
1) Add/confirm semantic CSS tokens in `styles.css`:
- `--ColorBlueActive`, `--ColorTealAccent`, `--ColorText`, `--ColorMuted`, `--ColorBorder`, `--ColorSurface`, `--ColorBg`, `--ColorDanger`, etc.
2) Create a tiny component layer (no library migration):
- `Button.jsx` (primary/secondary/ghost/destructive)
- `Input.jsx`, `Select.jsx`, `Toggle.jsx`
- `Card.jsx`, `Divider.jsx`
- `IconButton.jsx`
Rules:
- New pages/components must use these primitives, not raw `<button>`/`<input>`.
- If raw elements are unavoidable, enforce the “base classes” via shared helpers.

### Phase 1: Settings shell rebuild (lowest risk)
**Goal:** Prove the layout system on a low-risk/low-use page.
1) Create `SettingsLayout.jsx`:
- Two-column layout:
  - Left: settings nav list
  - Right: content card with `PageHeader` inside
2) Convert `/settings` landing:
- Replace plain link list with a `SettingsIndex` using `Card` + `ListItem` rows.
3) Convert `/settings/appearance`:
- Use `PageHeader` (“Appearance”) + a single `Card` containing form rows.
- Ensure every control uses primitives (Input/Select/Toggle).
4) Add a `SettingsSubNav` component shared across all settings pages.

Acceptance checks:
- No unstyled inputs/buttons.
- Keyboard focus visible (teal ring) and active selection (blue) clearly distinct from disabled. (Aligns with your updated style intent and avoids teal-grey confusion.)

### Phase 2: Overlay correctness (needed for consistent toolbars)
**Goal:** Stop dropdown/menu clipping and z-index drift.
- Introduce a simple `Portal.jsx` helper using `createPortal`.
- Move dropdowns/popovers/context menus to portals.
- Create a single z-index scale in CSS (`--ZDropdown`, `--ZModal`, `--ZDrawer`) and update existing usage. 

### Phase 3: Roll out PageHeader + FilterBar across modules (incremental)
Order (least risky to most):
1) Shopping (clear FilterBar needs: search, bulk actions, columns)
2) Life admin records (search, columns, actions)
3) Budget (subnav + data tables)
4) Tasks (list + filters)
5) Health (charts + subnav)
6) Kids portal/admin (most custom UI)

For each module:
- Add `PageHeader` first (visual consistency).
- Then unify subnav (tabs/pills).
- Then implement `FilterBar` where tables exist.

## Done definition (per page)
- Uses `PageHeader` (+ `SubNav` and/or `FilterBar` where relevant)
- All controls are from primitives (no raw unstyled elements)
- Blue = active navigation/selected module; Teal = focus/secondary accent, clearly visible
- No overlay clipping (menus/popovers use portal)
- Lint passes (`npm run lint`) and UI smoke via your dev compose workflow
