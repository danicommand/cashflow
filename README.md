# Cashflow

A small personal money tracker: log what you owe and what you earn, tick things
off as you pay them, and see what is still left for the month and when it is
due. No accounts, no ads, nothing to buy.

English and Portuguese, light and dark, USD / BRL / EUR / GBP.

## What it does

- **Log a bill or an income** with an amount, a date and an optional category.
- **Repeat it** weekly, monthly or yearly — forever, or for a fixed number of
  instalments. A repeating bill is stored once; each month's instance is
  computed, so editing it fixes every month at once.
- **Tick it off** when it is paid. The amount and the date default to the full
  amount paid today, and both can be changed — a 1200 bill settled for 1180
  counts as 1180.
- **See the month**: what is left to pay, how much is already paid, what is
  overdue, what is still ahead, what came in, and where the money goes by
  category.
- **See your balance carry over.** The Balance tile is a running total —
  income minus expenses across every month you've used the app, not just the
  one on screen — so a surplus in August is still there when September opens.
- **See what needs attention in other months.** A "Not this month" panel
  surfaces anything overdue or due in the next two weeks that belongs to a
  different month than the one you're looking at, with one tap to jump there.
- **See the calendar**: which days the bills land on, with the unpaid total
  under each date.
- **See recent months compared**, as a small chart of what was actually paid
  each month — tap a bar to jump straight to that month.
- **Delete without a confirm dialog.** Removing a bill is instant and
  reversible: a toast offers Undo for a few seconds, because the record is
  already just a tombstone the moment it disappears.
- **A couple of keyboard shortcuts**: `N` adds a bill, the arrow keys change
  the month — never the only way to do either, since a phone has no keyboard.
- **Sync across devices** with a personal code (optional, see below).
- **Back up and restore** a JSON file. Restoring merges rather than replaces.

## Running it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite plus a local Worker and a local D1 |
| `npm run test` | Worker tests (`node:test`) |
| `npm run test:ui` | App and service tests (vitest) |
| `npm run lint` | oxlint |
| `npm run build` | `tsc -b && vite build` |
| `npm run check` | All of the above, in order |
| `npm run deploy` | `check`, then deploy to Cloudflare |

The local database needs its migration once: `npm run db:migrate:local`.

## How it is put together

```
src/services/   pure logic, one concern per file, each with a sibling test
src/components/ presentation
src/hooks/      useSync
worker/         the Cloudflare Worker: one API route
migrations/     D1 schema
```

**Two record types, and that is the whole data model.** An `Entry` is the rule
("rent, 1200, the 5th, every month"). A `Payment` is the fact ("the September
5th instance was settled on the 4th for 1180"). Keeping them apart is what lets
a recurring bill stay a single row while every month still remembers its own
state, with no job to roll the ledger forward when a month ticks over.

**The Balance tile is keyed on `payment.paidOn`, not on any occurrence's due
date.** `runningBalance` in `src/services/summary.ts` sums every settled
payment, income minus expense, up to a cutoff — so a bill due August 30 but
paid September 2 spends September's balance, which is when the money actually
left. A month view's own totals (what's left to pay, what's overdue *this
month*) stay scoped to the month on screen; only Balance and the "Overdue"
stat tile are deliberately global, because those two are the ones a person
expects to be true no matter which month they happen to be looking at.

**Money is integer cents everywhere**, converted to a decimal only to be shown
or typed. `parseMoney` reads both `1.234,56` and `1,234.56` by looking at the
last separator rather than trusting the interface language.

**Dates are `YYYY-MM-DD` strings** handled by `src/services/dates.ts`.
`new Date("2026-09-05")` parses as UTC midnight, which is the 4th for anyone
west of Greenwich — so dates are split and rebuilt by hand and only ever become
a `Date` through the local `(y, m, d)` constructor.

**The device is the source of truth.** Every edit is saved to `localStorage`
first and the app works with no connection at all. Sync is a background
reconciliation, never a prerequisite.

**Delete is undo-able because the ledger already tombstones.** `deleteEntry`
never removes a record; it sets `deletedAt`. `restoreEntry` (in the same
file, `src/services/ledger.ts`) just clears it again — matched to the exact
timestamp the delete wrote, so undoing a delete from a few seconds ago can't
also resurrect an unrelated record that happened to be removed earlier. That
match is what makes it safe to skip the native confirm dialog: the toast's
"Undo" button is calling the same machinery sync already depends on, not a
new deletion mode bolted on for the toast.

**The trend chart reads `paidTotal` for a trailing window of months**
(`spendHistory` in `src/services/trend.ts`), computed the same way each
month's own numbers are — there is no separate aggregate table to keep in
sync, just the existing `occurrencesInMonth` → `summarise` pipeline called
six times.

## Motion

There is one authored moment, and it is paying a bill. The amount lifts off its
row, arcs to the month total, and the total catches it: the digits roll like a
meter, and only the wheels whose digit actually changed turn. The progress bar
then advances and catches a single pass of light. Those two halves of the event
sit far apart on screen, and the travel is what makes them one event rather
than two unrelated changes.

Everything else is quiet and explains something:

- **The tick** draws its check rather than switching it on, and the
  strikethrough wipes across the title instead of appearing.
- **Months** travel in the direction you asked for, so stepping back is
  visibly the inverse of stepping forward.
- **The calendar** assembles as a diagonal wave from the first of the month —
  a month is a shape, not a list of cells.
- **Sheets** rise and their fields resolve in order, leading to the field to
  fill first.

Implementation notes worth knowing before editing:

- No animation library. CSS for declarative state, the Web Animations API for
  the one effect that has to measure real elements.
- `src/motion/flight.ts` is the only module that touches the DOM directly, and
  the comment at the top says why it has to. It skips the flight when the total
  is off screen, because an amount that flies somewhere nobody can see is
  worse than no flight.
- Nothing animates a layout property. The progress bar is `scaleX` on a
  clipped track, not `width`.
- Nothing loops. The only repeating animation in the app is the sync dot while
  a sync is actually in flight.
- `prefers-reduced-motion` has a real alternative rather than an off switch:
  the odometer still lands on its value, the tick still fills, the bar still
  advances, and the total still marks an arrival — with light instead of
  movement. The travel is what goes.

## Sync, and what it does and does not protect

Sync is off until a personal code is set. Typing the same code on two devices
puts them in the same space.

The code never leaves the device. What is sent is the SHA-256 of the code with
a fixed prefix, and that hash is the only thing the server stores or indexes
on. So a copy of the database gives up a ledger only to someone who has already
guessed the code — but **anyone who knows the code can read and write that
ledger**, and a forgotten code cannot be recovered. That is the honest trade for
having no accounts to sign into. Use the suggested codes, which are random.

Merging is last-write-wins per record by `updatedAt`, with tombstones for
deletes so an offline device cannot resurrect what another one removed. The
same merge runs in the browser and in the Worker, so a round trip cannot
produce a state the client would not have produced itself. Payment ids are
derived from the entry and the occurrence, so two devices ticking off the same
bill offline produce one record rather than two.

Housekeeping is in the same place as the growth: tombstones older than 90 days
are dropped on every sync, and spaces untouched for 400 days are deleted by a
sweep that runs on roughly one request in a hundred.

## Deploying

`npm run deploy` runs the full check and then `wrangler deploy`. The D1 schema
goes out separately with `npm run db:migrate:remote`.
