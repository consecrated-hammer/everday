# Everday Style Guide (UI Refresh)

This document is the source of truth for UI and visual style decisions. Use it for all frontend work.

## Visual Direction
- Aim for calm, “Dockhand-clean” layouts (neutral surfaces, subtle borders, minimal chrome).
- Prefer clarity and scanability over “surprising” layouts.
- Use a standard, readable UI font stack (system/Inter) to reduce styling variance and agent churn.
- Define CSS variables for palette and spacing; avoid ad-hoc colours.
- Avoid purple bias and avoid dark-mode bias.
- Prefer flat fills with subtle elevation. Avoid textured or busy backgrounds.
- Use subtle transitions (150ms colour/opacity). Avoid large page-load animations.

## Colour System (Blue + Teal)
Never rely on “slightly different grey” to show state. Active vs disabled must be obvious.

### Blue (Active / Navigation)
Use blue for:
- Active module in the left rail (selected item)
- Active tabs when tabs represent navigation
- “You are here” indicators (selected row if used for navigation context)

### Teal (Primary / Commit + Focus)
Use teal for:
- Primary commit actions (Save/Update/Create/Confirm)
- Focus rings and focus outlines (keyboard focus)
- Key “actionable emphasis” states
Teal must be strong enough to stand apart from disabled greys.

### Neutral (Default)
Neutral colours handle:
- Backgrounds, surfaces, borders
- Default text, muted text, disabled states
- Secondary controls and non-selected icons

### Status colours (Semantic)
- Success, Warning, Danger remain semantic and distinct from blue/teal.
- Do not repurpose teal for “success”. Teal is “primary action”.

## Layout & Density
- Desktop-first, mobile-friendly.
- Dense, scannable desktop defaults:
  - Table rows are compact (avoid tall rows).
  - Forms use controlled widths (avoid full-bleed stretched inputs on desktop).
- Use available width for data-dense views (tables), but keep form-heavy pages constrained to improve readability.
- Keep gutters consistent and avoid “roomy” spacing. Prefer fewer, clearer sections.
- App shell provides consistent navigation and predictable content padding.
- Constrained settings layout (use across similar pages):
  - For settings or preferences sections with simple option rows, constrain the card to a mobile-width max (about 520px) on desktop.
  - Controls should sit close to their labels; avoid wide empty gaps in the option column.

## Navigation (Left Rail)
- Left rail is the primary navigation; collapse/expand toggle sits at the bottom.
- Keep icons in a fixed column; labels fade/clip without shifting icon alignment.
- Avoid layout jumps when collapsing; do not remove elements that change alignment.
- Keep the rail border consistent (no overlap/ghost border when collapsed).
- Active module must be unmistakable:
  - light blue background tint (row/pill)
  - blue icon + blue text (or stronger weight)
- Disabled modules:
  - muted text + muted icon (never teal), no hover highlight
- Use the account menu for Settings and logout; keep the rail focused on modules.

## Overlays (Dropdowns, Popovers, Menus)
- All dropdowns/popovers/menus must render via a portal to a root overlay container.
- Do not use z-index hacks to “fix” stacking issues.
- Overlays must be keyboard accessible (focus order, Escape to close).

## Components
### Inputs and form controls (no unstyled controls)
- No raw `<input>`, `<select>`, or `<textarea>` without standard styling.
- Use shared primitives (`<Input />`, `<Select />`, `<TextArea />`, `<Checkbox />`, etc.) where available.
- If primitives are not available in a context, apply the standard classes (do not leave controls unstyled).
- Error, disabled, and focus states must be consistent across all controls.

### Tables
- Sortable columns, filterable category columns, resizable widths.
- Icon-only row actions, clearer on hover.
- Use a compact “+ Add <item>” action near the table header/toolbar.
- Default table density should be compact (tight row height, small header type, minimal padding) to maximize information on screen.
- Table row kebab menus must render via a portal/fixed overlay so they never resize the table container.

### Manage Columns
- Dropdown with checkboxes.
- Include “Reset to default” in overflow menu.

### Modals
- Modals are preferred for edit/create forms where focus matters.
- Modal pattern:
  - header: title + optional subtle inline rename affordance
  - body: sectioned with dividers (avoid nested cards)
  - footer: Cancel + Primary commit
- Commit rule:
  - Primary commit button is disabled until the form is dirty and valid.
  - Only enable when changes exist.

### Advanced options
- Advanced sections are collapsed by default (accordion/expander).
- Use clear section titles and concise helper text.

### Key-value editors
Use for environment-like settings, metadata, flexible lists.
- Row layout: Key | Value | optional toggle/segmented | remove
- Provide a small “+ Add” at the end of the section.
- Remove is an icon button; confirm when destructive/irreversible.
- Toggles:
  - ON is teal (enabled)
  - OFF is neutral and clearly muted

### Icons
- Use a single icon set.
- Prefer crisp outline icons.
- 16–18px in lists/tables, 20px in headers.

### Checkboxes
- Do not wrap inputs in a `<label>` inside grid layouts.
- Use a wrapper container with `<input>` and a `<label htmlFor="...">` to avoid alignment issues. This is the default pattern.

## Buttons & Actions
- Default buttons are compact with clear hover/active states.
- Avoid icons on text buttons; reserve icon-only buttons for obvious actions (edit, delete, filter, overflow).
- Buttons should not wrap or resize; keep labels on one line.
- Use standard button classes (no unstyled buttons):
  - `primary-button` for main commit actions (teal).
  - `button-secondary` for secondary/neutral actions.
  - `primary-button button-danger` for destructive actions (solid red background, white text).
  - `button-secondary button-danger` for secondary destructive actions (outlined).
  - `icon-button` for icon-only actions.

## Themes
- Support Light, Dark, and Auto (system).
- Use CSS variables for surfaces, text, borders, and accents to keep theme switching consistent.
- Palette direction:
  - Neutral surfaces
  - Blue for active navigation
  - Teal for primary commit + focus
- Status pills should be secondary, not the visual focal point.

## Typography & Copy
- Keep hierarchy clear: eyebrow, h1, section titles, body.
- No em dashes in UI copy. Use commas or periods instead.
- Use concise labels and avoid abbreviations.

## Accessibility
- Provide labels for inputs and controls.
- Maintain keyboard focus states and visible focus (teal ring).
- Ensure contrast remains readable on light backgrounds.

## Progress & Status
- Clamp progress bars at 100%.
- If a value exceeds 100%, represent overflow explicitly (badge or secondary indicator).

## Consistency
- Reuse spacing, corner radii, and button styles across modules.
- Keep icon style consistent (stroke weight, size).
- Prefer shared primitives over page-specific UI patterns.
