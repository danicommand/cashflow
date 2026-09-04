import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Entry, Occurrence } from "../types.ts";
import { MonthView } from "./MonthView.tsx";

const entry: Entry = {
  id: "rent",
  kind: "expense",
  description: "Rent",
  amount: 100_00,
  dueDate: "2026-09-04",
  repeat: "none",
  repeatCount: null,
  category: "Home",
  note: "",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  deletedAt: null,
};

const occurrence: Occurrence = {
  key: "rent|2026-09-04",
  entry,
  date: "2026-09-04",
  index: 0,
  amount: entry.amount,
  payment: null,
  skipped: false,
};

describe("MonthView dashboard priority", () => {
  it("features the selected metric and keeps left to pay in the overview", () => {
    render(
      <MonthView
        month="2026-09"
        occurrences={[occurrence]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        catchDelay={0}
        balance={50_00}
        carriedIn={0}
        globalOverdueTotal={0}
        elsewhere={[]}
        history={[]}
        budgets={[]}
        priority="balance"
        onToggle={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onJumpElsewhere={vi.fn()}
        onSelectMonth={vi.fn()}
        onManageCategory={vi.fn()}
        onOpenYearReview={vi.fn()}
      />,
    );

    const hero = screen.getByRole("region", { name: "Balance" });
    expect(within(hero).getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("Left to pay", { selector: ".stat-label" })).toBeInTheDocument();
    expect(screen.queryAllByText("Balance", { selector: ".stat-label" })).toHaveLength(0);
  });
});
