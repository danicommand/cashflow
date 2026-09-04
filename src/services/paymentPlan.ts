import type { BillPriority, Entry, MonthFilter, MonthSort, Occurrence } from "../types.ts";

const PRIORITY_RANK: Record<BillPriority, number> = {
  essential: 0,
  important: 1,
  flexible: 2,
};

export function priorityOf(entry: Entry): BillPriority {
  return entry.priority ?? "important";
}

export function sortOpenExpenses(
  occurrences: Occurrence[],
  sort: MonthSort,
  today: string,
): Occurrence[] {
  return occurrences.toSorted((left, right) => {
    if (sort === "amount") return right.amount - left.amount || left.date.localeCompare(right.date);
    if (sort === "date") return left.date.localeCompare(right.date) || right.amount - left.amount;
    if (sort === "priority") {
      return (
        PRIORITY_RANK[priorityOf(left.entry)] - PRIORITY_RANK[priorityOf(right.entry)] ||
        left.date.localeCompare(right.date)
      );
    }
    const leftOverdue = left.date < today ? 0 : 1;
    const rightOverdue = right.date < today ? 0 : 1;
    return (
      leftOverdue - rightOverdue ||
      PRIORITY_RANK[priorityOf(left.entry)] - PRIORITY_RANK[priorityOf(right.entry)] ||
      left.date.localeCompare(right.date) ||
      right.amount - left.amount
    );
  });
}

export function filterOpenExpenses(
  occurrences: Occurrence[],
  filter: MonthFilter,
  today: string,
): Occurrence[] {
  if (filter === "overdue") return occurrences.filter((item) => item.date < today);
  if (filter === "essential") {
    return occurrences.filter((item) => priorityOf(item.entry) === "essential");
  }
  if (filter === "upcoming") return occurrences.filter((item) => item.date >= today);
  return occurrences;
}

export function safeToSpend(balance: number, occurrences: Occurrence[]): number {
  return (
    balance -
    occurrences
      .filter(
        (item) =>
          item.entry.kind === "expense" &&
          !item.payment &&
          !item.skipped &&
          priorityOf(item.entry) === "essential",
      )
      .reduce((total, item) => total + item.amount, 0)
  );
}
