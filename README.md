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
- **See the calendar**: which days the bills land on, with the unpaid total
  under each date.
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
