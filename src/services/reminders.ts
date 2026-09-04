import type { Occurrence } from "../types.ts";
import { addDays } from "./dates.ts";

export function remindersDue(
  occurrences: Occurrence[],
  today: string,
  leadDays: number,
): Occurrence[] {
  const end = addDays(today, leadDays);
  return occurrences
    .filter(
      (item) =>
        item.entry.kind === "expense" && !item.payment && !item.skipped && item.date <= end,
    )
    .toSorted((left, right) => left.date.localeCompare(right.date));
}

export function reminderKey(occurrence: Occurrence, today: string): string {
  return `cashflow.reminder.${today}.${occurrence.key}`;
}
