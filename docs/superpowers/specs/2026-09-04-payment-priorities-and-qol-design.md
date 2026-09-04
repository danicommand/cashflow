# Payment Priorities and Quality-of-Life Design

## Goal

Turn Cashflow from a passive monthly ledger into a configurable payment guide without changing its local-first, account-free character.

## Product behavior

- Expense entries have one of three priorities: Essential, Important, or Flexible. Existing entries default to Important. Income does not display a priority.
- The month screen includes a compact “Pay next” planner. Its smart order places overdue bills first, then orders by priority and date. Users can switch between Smart, Due date, Highest amount, and Priority sorting.
- Month filters offer All, Overdue, Essential, and Upcoming views without hiding income or altering stored data.
- “Safe to spend” equals the running settled balance minus all open Essential expenses in the displayed month. It may be negative and can be selected as the dashboard headline.
- Dashboard preferences let users select the headline, hide supporting metrics, and move supporting metrics up or down. The headline cannot be hidden.
- Optional reminders surface browser notifications for open bills within 0, 1, 3, or 7 days. They are checked when the app opens and never imply background push delivery.
- Viewing preferences remember the chosen sort, whether settled expenses are expanded, and whether rows use compact density.

## Architecture

- Extend `Entry` with a backwards-compatible optional priority and normalize it through ledger creation and untrusted sync/import sanitation.
- Extend local `Settings` with dashboard order/visibility, reminder, sort, settled-list, and density preferences. Invalid or older settings fall back safely.
- Keep planning and reminder calculations in pure services. Components consume already-ranked results and remain presentation-focused.
- Use existing controls, color tokens, sheet patterns, translations, and responsive structure. No new runtime dependency or remote service is introduced.

## Accessibility and privacy

- Sorting, filters, ordering, visibility, reminders, and priority selectors have explicit accessible names and keyboard-operable native controls.
- Priority is never conveyed by color alone; every priority has text.
- Notification permission is requested only from an explicit user action. Notification deduplication stays local to the device.

## Verification

- Pure tests cover ranking, filtering, safe-to-spend, reminder windows, settings migration, and priority sanitation.
- Component tests cover entry priority editing, dashboard ordering/hiding, and remembered view controls.
- Run the complete worker/UI/lint/build check, the design detector once, and one bounded desktop/mobile visual pass before deployment.
