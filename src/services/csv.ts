/**
 * Turning the ledger into a spreadsheet.
 *
 * The JSON backup is for this app to read back into itself; this is for
 * everything else — taxes, a personal spreadsheet, a spouse who wants the
 * numbers without the app. It is one row per real transaction (a settled
 * payment), because that is what a spreadsheet actually wants: what moved,
 * and when — not the recurring rule behind it.
 */

import type { Entry, Payment } from "../types.ts";

const HEADER = ["Date", "Description", "Category", "Type", "Amount"];

/**
 * RFC 4180 escaping: a field touching a comma, quote, or newline is wrapped
 * in quotes with its own quotes doubled. Left alone otherwise, so the common
 * case reads as plain text in anything that opens it.
 */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function row(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/**
 * One row per live, settled payment, oldest first — chronological, the way
 * a bank or card statement reads. Cents are rendered as a plain decimal
 * (`120.00`, never `1,200.00`) so a spreadsheet parses the column as a
 * number rather than as region-formatted text.
 */
export function toCsv(entries: Entry[], payments: Payment[]): string {
  const kindOf = new Map<string, Entry>();
  for (const entry of entries) {
    if (!entry.deletedAt) kindOf.set(entry.id, entry);
  }

  const rows = payments
    .filter((payment) => !payment.deletedAt && kindOf.has(payment.entryId))
    .toSorted((a, b) => (a.paidOn < b.paidOn ? -1 : a.paidOn > b.paidOn ? 1 : 0))
    .map((payment) => {
      const entry = kindOf.get(payment.entryId)!;
      const signed = entry.kind === "income" ? payment.amount : -payment.amount;
      return row([
        payment.paidOn,
        entry.description,
        entry.category,
        entry.kind,
        (signed / 100).toFixed(2),
      ]);
    });

  return [row(HEADER), ...rows].join("\r\n");
}
