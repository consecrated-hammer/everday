# Everday Style Guide

This document is the source of truth for UI and visual style decisions. Use it for all frontend work.

## Visual Direction
- Aim for intentional, bold, and slightly surprising layouts, not generic templates.
- Use expressive fonts and avoid default UI stacks (Inter, Roboto, Arial, system).
- Define CSS variables for palette and spacing; avoid ad-hoc colors.
- Avoid purple-on-white defaults and avoid dark-mode bias.
- Use layered or textured backgrounds (gradients, subtle shapes) instead of flat fills.
- Use a few meaningful animations (page-load, staggered reveals) rather than micro-animations everywhere.

## Layout & Density
- Desktop-first, but ensure mobile flows remain usable.
- Preserve existing visual language when extending established layouts.
- Full-width layouts are encouraged on desktop when content benefits from space.
- Data-dense views (Expenses, tables) should use available desktop width; avoid narrow max-widths on 1920px.
- Keep gutters consistent and avoid cramped cards.
- App shell should provide clear navigation and a consistent return to dashboard.
- Ensure pages render correctly on both desktop and mobile breakpoints.

## Navigation (Left Rail)
- Left rail is the primary navigation; collapse/expand toggle sits at the bottom.
- Keep icons in a fixed column; labels should fade/clip without shifting icon alignment.
- Avoid layout jumps when collapsing; do not remove elements that change alignment.
- Keep the rail border consistent (no overlap/ghost border when collapsed).
- Use the account menu for Settings and logout; keep the rail focused on modules.

## Components
- Tables: sortable columns, filterable category columns, resizable widths, icon-only row actions, "+ Add <item>" button.
- Manage Columns: dropdown with checkboxes; include "Reset to default" in overflow menu.
- Modals: reserved for complex forms; standard forms should be inline.
- Icons: use a single icon set per theme selection; avoid circled glyphs and prefer crisp outline icons.
- Checkboxes: do not wrap inputs in a `<label>` inside grid layouts. Use a wrapper container with `<input>` and a `<label htmlFor="...">` to avoid alignment issues. This is the default pattern.

## Buttons & Actions
- Default buttons are compact pill styles with clear hover/active states.
- Avoid icons on text buttons; reserve icon-only buttons for obvious actions (edit, delete, filter, overflow).
- Buttons should not wrap or resize; keep labels on one line.

## Themes
- Support Light, Dark, and Auto (system) themes.
- Use CSS variables for surfaces, text, borders, and accents to keep theme switching consistent.
- Primary palette is white/blue with subtle neutral surfaces; avoid purple bias.
- Status pills should be secondary, not the visual focal point.

## Typography & Copy
- Keep type hierarchy clear: eyebrow, h1, section titles, body.
- No em dashes in UI copy. Use commas or periods instead.
- Use concise labels and avoid abbreviations.

## Accessibility
- Provide labels for inputs and controls.
- Maintain keyboard focus states and visible focus.
- Ensure contrast remains readable on light backgrounds.

## Progress & Status
- Clamp progress bars at 100%.
- If a value exceeds 100%, represent overflow explicitly (badge or secondary indicator).

## Consistency
- Reuse spacing, corner radii, and button styles across modules.
- Keep icon style consistent (stroke weight, size).
