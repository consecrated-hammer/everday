# iOS Style Guide (Apple HIG aligned)

## Scope and source of truth
- This guide applies to all work under /apps/ios.
- Follow Apple Human Interface Guidelines (HIG) and the latest Apple design updates.
- When guidance conflicts, prefer the most recent Apple guidance.

## Core principles
- Clarity: prioritize content and legibility.
- Deference: avoid ornamental UI that competes with content.
- Depth: use hierarchy, layering, and motion to communicate structure.

## Layout
- Design for iPhone first, then scale to iPad and other sizes.
- Use safe areas and system spacing; avoid horizontal scrolling for primary content.
- Keep primary content visible without zooming.

## Typography
- Use the system font (San Francisco) and text styles.
- Support Dynamic Type across all screens and avoid fixed font sizes.
- Keep text at least 11 points for default body text.

## Color and contrast
- Use system colors for text, fills, and backgrounds.
- Support light and dark appearances.
- Meet contrast requirements and respect Increase Contrast settings.
- Do not rely on color alone to convey meaning.

## Controls and touch targets
- Prefer standard UIKit and SwiftUI controls.
- Touch targets must be at least 44 by 44 points.
- Avoid custom controls unless required by the product or platform gap.

## Navigation and presentation
- Use standard patterns such as navigation stacks, tab bars, and sheets.
- Preserve system gestures and expected back behavior.
- Use sheets and popovers for secondary tasks and brief flows.

## Icons and imagery
- Use SF Symbols where possible.
- Keep icons aligned to the SF Symbols grid and weights.
- Provide @2x and @3x assets for custom images.

## Visual identity
- Brand mark usage:
  - Wide logo on login: target 70–80% of screen width on iPhone, max 320pt.
  - iPad wide logo max 360pt.
  - Do not use the app icon as a background or watermark.
- Color palette:
  - Primary accent is teal (system teal or a fixed brand teal).
  - Secondary accent is mint for soft emphasis only.
  - Base surfaces use system background and grouped background.
  - Avoid purple or heavy saturation.
- Backgrounds:
  - Login uses a subtle teal-to-mint gradient.
  - All other screens use solid system backgrounds.
- Material and depth:
  - Use system materials for cards and tab bars only.
  - Keep shadows soft (4–8pt blur, low opacity).
- Typography:
  - Use system text styles only.
  - Title weight is bold only at level 1.
  - Avoid all-caps except for small badges.
- Iconography:
  - Use filled SF Symbols for tabs, outline for list rows.
- Spacing rhythm:
  - Large section padding: 24pt.
  - Card padding: 16pt, vertical gaps: 12pt.
- Buttons:
  - Primary actions use .borderedProminent with teal accent.
  - Secondary actions use .bordered with neutral tint.
- Tone:
  - Calm and minimal, with two levels of emphasis max per screen.

## Motion and feedback
- Use system animations and transitions.
- Respect Reduce Motion.
- Use haptics sparingly and only for meaningful feedback.

## Accessibility
- Provide VoiceOver labels for all interactive elements and meaningful images.
- Group related content for predictable VoiceOver order.
- Test with VoiceOver, Larger Text, Differentiate Without Color Alone, and Sufficient Contrast.

## Liquid Glass and new design language
- Prefer system materials and components that adopt Liquid Glass automatically.
- Avoid faking glass effects with custom blurs or gradients.
- Follow the latest Apple guidance for colors and buttons.

## Verification checklist
- Dynamic Type works across the full range without truncation.
- All interactive elements have a VoiceOver label.
- Hit targets meet minimum size.
- Color contrast passes and meaning is not color-only.
- Light and dark appearances both look correct.
