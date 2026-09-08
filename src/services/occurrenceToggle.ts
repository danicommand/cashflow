import type { Ledger, Occurrence } from "../types.ts";
import { settleOccurrence, unsettleOccurrence, unskipOccurrence } from "./ledger.ts";

/** Apply the check-circle action without interrupting the user with a sheet. */
export function toggleOccurrenceDirect(
  ledger: Ledger,
  occurrence: Occurrence,
  paidOn: string,
): Ledger {
  if (occurrence.payment) {
    return unsettleOccurrence(ledger, occurrence.entry.id, occurrence.date);
  }
  if (occurrence.skipped) {
    return unskipOccurrence(ledger, occurrence.entry.id, occurrence.date);
  }
  return settleOccurrence(
    ledger,
    occurrence.entry.id,
    occurrence.date,
    occurrence.amount,
    paidOn,
  );
}
