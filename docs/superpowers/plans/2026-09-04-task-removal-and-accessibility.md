# Task Removal and Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add discoverable, undoable row deletion and close the related modal/input accessibility gaps found in the full project scan.

**Architecture:** Keep ledger mutation and Undo toast ownership in `App`, pass a typed deletion callback to standard occurrence rows, and centralize modal focus containment in `Sheet`. Reuse current translations, tokens, icons, and responsive list patterns.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, CSS, Vite

**Spec:** `docs/superpowers/specs/2026-09-04-task-removal-and-accessibility-design.md`

## Global Constraints

- Preserve instant deletion and the existing Undo toast; do not add a confirmation dialog.
- Deleting a recurring occurrence deletes its underlying entry and series.
- Keep English and Portuguese dictionaries type-complete.
- Use a 44 by 44 pixel row action target and a localized accessible name.
- Preserve the incumbent visual system and all existing keyboard and reduced-motion behavior.

---

### Task 1: Row removal control

**Files:**
- Create: `src/components/OccurrenceRow.test.tsx`
- Modify: `src/components/OccurrenceRow.tsx`
- Modify: `src/components/MonthView.tsx`
- Modify: `src/components/CalendarView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n.ts`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: the existing `Entry`, `Occurrence`, `deleteEntry`, `restoreEntry`, and toast APIs.
- Produces: `onDelete(entry: Entry): void` from `OccurrenceRow` through its parent views.

- [x] Write a component test that renders a real occurrence and expects a localized `Delete Rent` button whose click sends the underlying entry to `onDelete`.
- [x] Run `npm run test:ui -- src/components/OccurrenceRow.test.tsx` and confirm the missing control causes the failure.
- [x] Add the typed callback, authored trash SVG, localized label, shared App handler, and responsive token-based styling.
- [x] Run the focused test and confirm it passes.

### Task 2: Modal and input accessibility

**Files:**
- Create: `src/components/Sheet.test.tsx`
- Create: `src/components/AccessibleInputs.test.tsx`
- Modify: `src/components/Sheet.tsx`
- Modify: `src/components/SearchSheet.tsx`
- Modify: `src/components/LockScreen.tsx`

**Interfaces:**
- Consumes: existing `Sheet` props and translated search/PIN strings.
- Produces: contained Tab navigation, opener focus restoration, and programmatic input names.

- [x] Write tests proving Tab wraps from the last focusable control to the first and Shift+Tab wraps back.
- [x] Write tests proving the search and PIN fields are queryable by localized accessible name.
- [x] Run the focused tests and confirm they fail for the missing behavior.
- [x] Implement focus containment in `Sheet` and add `aria-label` to the two inputs.
- [x] Run the focused tests and confirm they pass.

### Task 3: Full verification and visual QA

**Files:**
- Modify only files with verified defects from the inspection.

**Interfaces:**
- Consumes: the completed behavior from Tasks 1 and 2.
- Produces: a release-ready local working tree with no detector, test, lint, or build regressions.

- [x] Run `npm run check` and require zero failures.
- [x] Run the UI detector once over all changed UI targets and address verified findings.
- [x] Inspect desktop and mobile renders, keyboard operation, English/Portuguese labels, and long descriptions.
- [x] Review `git diff --check`, `git diff --stat`, and the final source diff for accidental churn.
