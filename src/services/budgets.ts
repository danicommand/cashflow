/**
 * Reading budgets against what a month actually spent.
 *
 * A budget caps a category, not an entry — "Food" covers every bill tagged
 * Food, however many there are. So this is a query over the same category
 * totals the "Where it goes" breakdown already computes, cross-referenced
 * with whichever budgets are still live.
 */

import type { Budget, Occurrence } from "../types.ts";
import { totalsByCategory } from "./summary.ts";

export interface CategoryBudget {
  category: string;
  limit: number;
  spent: number;
  /** 0-1+; can exceed 1 when a category has gone over its cap. */
  share: number;
  overBudget: boolean;
}

/** The live budget for one category, or `null` if it has none. */
export function budgetFor(budgets: Budget[], category: string): Budget | null {
  const trimmed = category.trim();
  return budgets.find((budget) => !budget.deletedAt && budget.category === trimmed) ?? null;
}

/**
 * Every budgeted category that appears in this month's occurrences, spent
 * highest-share first — the ones closest to (or past) their cap are the ones
 * worth seeing without scrolling.
 */
export function monthBudgets(occurrences: Occurrence[], budgets: Budget[]): CategoryBudget[] {
  const spending = totalsByCategory(occurrences);
  const results: CategoryBudget[] = [];

  for (const budget of budgets) {
    if (budget.deletedAt) continue;
    const bucket = spending.find((entry) => entry.category === budget.category);
    const spent = bucket?.total ?? 0;
    results.push({
      category: budget.category,
      limit: budget.limit,
      spent,
      share: budget.limit > 0 ? spent / budget.limit : spent > 0 ? 1 : 0,
      overBudget: spent > budget.limit,
    });
  }

  return results.toSorted((a, b) => b.share - a.share);
}
