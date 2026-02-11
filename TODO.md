# iOS Porting TODO

## Route Parity Snapshot (Web -> iOS)

### Implemented (route-level)
- `/health/*` (Today, Log, Foods, History, Insights) -> iOS Health module views
- `/kids` (KidsHome, KidsHistory) -> iOS Kids views
- `/kids-admin` -> iOS KidsAdmin view
- `/login` -> iOS Login view
- `/settings` -> iOS Settings (Appearance, Account, Health, Tasks, Integrations, Users, System)
- `/shopping` -> iOS Shopping list (CRUD)
- `/notifications` -> iOS Notifications list (read, dismiss, mark all read)
- `/tasks` -> iOS Tasks (lists, filters, CRUD, assignments)
- `/notes/*` (personal, family, shared) -> iOS Notes (list, search, CRUD, tags, share)
- `/budget/*` (Income, Expenses, Allocations, Settings) -> iOS Budget module (Settings placeholder)
- `/life-admin/*` (Records, Library, Builder) -> iOS Life Admin module
- `/reset` (Reset password) -> iOS Reset password view
- `/` (Home/Dashboard) -> iOS Dashboard (partial layout parity)

### Missing (no iOS module yet)
- None identified

## Settings Gaps (Web vs iOS)
- None identified

## Recommended Next Module
**Polish**
- Revisit Budget settings placeholder on iOS
- Improve iPad layouts for budget and life-admin views

## Optional Alternate Next Module
**Polish**
- Extra UI parity work on Life Admin and Budget
