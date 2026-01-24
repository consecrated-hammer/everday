# Everday v1 Frontend Inventory

Summary
Current approach: React 18 + Vite with a single global stylesheet and CSS variables for theming; UI patterns are mostly bespoke with lightweight helpers (Iconify + Recharts) and inlined modal/dropdown markup.
Recommendation for UI refresh: keep the global CSS + token approach but introduce a small, documented component layer (buttons/forms/modals) and a clear z-index scale to reduce duplication and drift.

## 1) Framework + Build Tooling
- React 18.2 (JS/JSX, no TypeScript)
  - `frontend/package.json`
  - Entry: `frontend/src/main.jsx` uses `createRoot` + `React.StrictMode`.
- Vite 7.x with `@vitejs/plugin-react`
  - `frontend/vite.config.js`
- Routing: React Router v6
  - `frontend/src/App.jsx`

## 2) UI Libraries Detected (and where used)
- Recharts (charts)
  - Example: kids portal line chart in `frontend/src/pages/Kids/KidsHome.jsx`.
- Iconify web component (icons)
  - Script load: `frontend/index.html`
  - Usage wrapper: `frontend/src/components/Icon.jsx`.
- No MUI, Chakra, Ant, Radix, Headless UI, or styled-system libraries detected.

## 3) Styling Approach
- Plain global CSS (no CSS modules, no CSS-in-JS, no Sass).
  - Styles live in `frontend/src/styles.css`.
  - Imported once in `frontend/src/main.jsx`.
- Component markup uses class names directly (e.g. `.primary-button`, `.modal`, `.dropdown`).
- Fonts loaded from Google Fonts at the top of `frontend/src/styles.css`.

## 4) Global Theme / Tokens
- CSS variables define color, surfaces, and accents.
  - Light theme: `:root` in `frontend/src/styles.css`.
  - Dark theme: `[data-theme="dark"]` in `frontend/src/styles.css`.
- Theme application and persistence:
  - `frontend/src/lib/uiSettings.js` writes `data-theme` and `data-icon-set` on `document.documentElement`.
  - Initialized in `frontend/src/main.jsx`.
- Spacing/size tokens are not centralized; spacing is mostly direct values in CSS.

## 5) Reusable UI Components (paths)
- Layout + navigation
  - `frontend/src/components/AppShell.jsx`
  - `frontend/src/components/MobileAppBar.jsx`
  - `frontend/src/components/NavFlyout.jsx`
  - `frontend/src/lib/navItems.js`
- Core UI helpers
  - `frontend/src/components/Icon.jsx` (Iconify wrapper + icon set selection)
  - `frontend/src/components/AccountMenu.jsx` (dropdown)
  - `frontend/src/components/NotificationsMenu.jsx` (dropdown)
- Tables
  - `frontend/src/components/DataTable.jsx`
  - `frontend/src/components/ExpenseTable.jsx`
- Modals / prompts
  - `frontend/src/components/PasswordChangePrompt.jsx`
  - `frontend/src/components/HealthProfilePrompt.jsx`
- Interaction helpers
  - `frontend/src/components/SwipeableEntryRow.jsx`
- Buttons / inputs are CSS classes rather than components
  - Classes in `frontend/src/styles.css`: `.primary-button`, `.button-secondary`, `.icon-button`, `.text-button`, input styling, etc.

## 6) Overlay Implementation Details (dropdowns / popovers / modals)
- Portal usage: none detected (no `createPortal`); overlays are rendered inline in component trees.
- Modals
  - Structure: `.modal-backdrop` + `.modal` (fixed backdrop, centered panel).
  - Example usage: `frontend/src/pages/Budget/Expenses.jsx`, `frontend/src/pages/Kids/KidsAdmin.jsx`, `frontend/src/pages/Health/Log.jsx`.
  - CSS: `frontend/src/styles.css` (`.modal-backdrop` z-index 200).
- Dropdowns / menus
  - Structure: `.dropdown` + position with absolute/fixed; close on outside click.
  - Examples: `frontend/src/components/AccountMenu.jsx`, `frontend/src/components/NotificationsMenu.jsx`.
  - CSS: `frontend/src/styles.css` (`.dropdown` z-index 10, `.dropdown.life-admin-context-menu` z-index 180).
- Drawers
  - Kids admin drawer uses `.kids-admin-drawer-backdrop` with z-index 220.
  - CSS: `frontend/src/styles.css`.
- Z-index conventions (current, not centralized)
  - Base UI: topbar and mobile app bar around 15–20.
  - Dropdowns: 10 (standard), 180 (context menu).
  - Modals: 200.
  - Drawers: 220.

## 7) Layout Implementation (routing + shell)
- Routing + layout composition
  - `frontend/src/App.jsx` defines routes and uses `AppShell` for authenticated app routes.
  - Kids portal uses `KidsLayout` with nested routes.
  - Budget/Health/Life Admin have their own layout components:
    - `frontend/src/pages/Budget/BudgetLayout.jsx`
    - `frontend/src/pages/Health/HealthLayout.jsx`
    - `frontend/src/pages/LifeAdmin/LifeAdminLayout.jsx`
- Sidebar + main shell
  - `frontend/src/components/AppShell.jsx` provides left rail, topbar actions, and `Outlet`.
  - Mobile navigation uses `MobileAppBar` + `NavFlyout`.

## 8) Lint / Format Tooling (UI-relevant)
- ESLint only (no Prettier).
  - Config: `frontend/.eslintrc.cjs`.
  - Script: `npm run lint` in `frontend/package.json`.

