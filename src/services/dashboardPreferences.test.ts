import { describe, expect, it } from "vitest";

import { reorderDashboardMetrics } from "./dashboardPreferences.ts";

describe("reorderDashboardMetrics", () => {
  it("moves a dragged metric to the target position without losing metrics", () => {
    expect(
      reorderDashboardMetrics(
        ["leftToPay", "safeToSpend", "balance", "overdue"],
        "overdue",
        "safeToSpend",
      ),
    ).toEqual(["leftToPay", "overdue", "safeToSpend", "balance"]);
  });

  it("returns the original order for unknown or identical targets", () => {
    const order = ["leftToPay", "balance"] as const;
    expect(reorderDashboardMetrics([...order], "balance", "balance")).toEqual(order);
  });
});
