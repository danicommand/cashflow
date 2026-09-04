# Task Removal and Accessibility Design

## Goal

Make task removal immediately discoverable from the main bill and income lists while preserving Cashflow's existing instant, undoable deletion model. Close the two accessibility gaps found during the project scan: keyboard focus escaping modal sheets and form controls that have no programmatic label.

## Product behavior

- Every standard occurrence row shows a trash icon after the amount.
- The icon deletes the underlying entry, including its recurring series and recorded occurrences, exactly as the existing Delete action in the edit sheet does.
- Deletion remains immediate and reversible through the existing Undo toast; no confirmation dialog is added.
- The control is always available on touch devices, uses the existing visual language, has a 44 by 44 pixel target, and exposes a localized accessible name containing the entry description.
- Search and cross-month summary rows remain navigation-only. A user can jump to the standard row or editor before deleting.

## Accessibility hardening

- A modal sheet keeps Tab and Shift+Tab focus inside the dialog and restores focus to the opener when closed.
- Form sheets focus their first field on open; read-only sheets fall back to the close control.
- The search field and lock-screen PIN field receive programmatic labels without adding redundant visible copy.
- Existing Escape, backdrop-close, focus-ring, and reduced-motion behavior remains unchanged.

## Responsive and motion polish

- On phones up to 520 pixels wide, the redundant wordmark is hidden so the tabs and search action remain on one header row.
- The shared settle easing uses a smooth exponential ease-out with no bounce or overshoot.

## Architecture

`App` owns deletion because it owns the ledger and Undo toast. A new entry-accepting deletion callback is passed through `MonthView` and `CalendarView` to `OccurrenceRow`. The existing edit-sheet deletion delegates to the same handler, avoiding two deletion implementations.

The generic `Sheet` component owns focus containment so every modal receives the fix. Input labels use existing translated strings.

## Verification

- Component tests cover the visible delete control, accessible name, callback payload, focus wrapping, focus restoration, and input labels.
- Run the complete test, lint, type-check, and production-build suite.
- Inspect the rendered app at desktop and phone widths, in both English and Portuguese.
- Run the project UI detector once after all UI edits.
