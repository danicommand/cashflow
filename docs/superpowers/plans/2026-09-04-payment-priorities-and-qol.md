# Payment Priorities and Quality-of-Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bill priorities, payment planning, safe-to-spend, configurable dashboard cards, reminders, and remembered month-view preferences.

**Architecture:** Backwards-compatible fields extend the existing `Entry` and local `Settings` models. Pure planning/reminder services feed existing React surfaces, preserving local-first storage and the incumbent visual system.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, Web Notifications API, Cloudflare Worker deployment.

**Spec:** `docs/superpowers/specs/2026-09-04-payment-priorities-and-qol-design.md`

## Global Constraints

- No new runtime dependencies.
- Existing entries read as Important priority.
- Notification permission is requested only from an explicit action.
- English and Portuguese remain complete.
- Every behavioral change follows a failing-test-first cycle.

---

### Task 1: Priority and preference models

**Files:** `src/types.ts`, `src/services/ledger.ts`, `src/services/merge.ts`, `src/services/storage.ts`, and sibling tests.

- [ ] Add failing tests for entry priority normalization, sync/import sanitation, and settings migration.
- [ ] Add the `BillPriority`, expanded dashboard metric, sort/filter, reminder, visibility, ordering, density, and settled-view fields.
- [ ] Run the focused service tests and refactor only after green.

### Task 2: Payment planning calculations

**Files:** Create `src/services/paymentPlan.ts` and `src/services/paymentPlan.test.ts`.

- [ ] Add failing literal-fixture tests for smart/date/amount/priority order, filters, safe-to-spend, and reminder windows.
- [ ] Implement pure ranking and calculation functions.
- [ ] Run focused tests and refactor only after green.

### Task 3: Entry priority editing

**Files:** `src/components/EntrySheet.tsx`, `src/components/OccurrenceRow.tsx`, component tests, translations, and CSS.

- [ ] Add a failing component test showing an expense priority can be saved.
- [ ] Add the accessible priority selector and visible priority label.
- [ ] Run focused tests and refactor only after green.

### Task 4: Planner, filters, and remembered list behavior

**Files:** `src/components/MonthView.tsx`, `src/App.tsx`, `src/i18n.ts`, `src/styles/app.css`, and `src/components/MonthView.test.tsx`.

- [ ] Add failing tests for Pay next ordering, filters, sorting, compact rows, and the settled default.
- [ ] Render the planner and controls using the pure payment-plan service.
- [ ] Persist control changes through settings and run focused tests.

### Task 5: Dashboard customization

**Files:** `src/components/MonthView.tsx`, `src/components/SettingsView.tsx`, `src/App.tsx`, translations, CSS, and component tests.

- [ ] Add failing tests for safe-to-spend, hidden support metrics, and custom card order.
- [ ] Add dashboard visibility and accessible move controls, keeping the headline always visible.
- [ ] Run focused tests and refactor only after green.

### Task 6: Due reminders

**Files:** Create `src/services/reminders.ts` and tests; modify `src/App.tsx`, `src/components/SettingsView.tsx`, translations, and CSS.

- [ ] Add failing tests for reminder selection and local once-per-day deduplication keys.
- [ ] Add explicit permission handling and app-open notification delivery.
- [ ] Add reminder lead-time controls and limitation copy, then run focused tests.

### Task 7: Verification and release

**Files:** All changed files and README.

- [ ] Update README behavior documentation.
- [ ] Run the full project check.
- [ ] Run the UI detector once against changed UI targets.
- [ ] Inspect desktop and mobile in one bounded browser pass and make one correction batch if necessary.
- [ ] Re-run the full check, commit, push `main`, deploy, and verify the live URL returns HTTP 200.
