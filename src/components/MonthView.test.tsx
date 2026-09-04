import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("calculates safe to spend after open essential bills", () => {
    render(
      <MonthView
        month="2026-09"
        occurrences={[{ ...occurrence, entry: { ...entry, priority: "essential" } }]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        catchDelay={0}
        balance={500_00}
        carriedIn={0}
        globalOverdueTotal={0}
        elsewhere={[]}
        history={[]}
        budgets={[]}
        priority="safeToSpend"
        onToggle={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onJumpElsewhere={vi.fn()}
        onSelectMonth={vi.fn()}
        onManageCategory={vi.fn()}
        onOpenYearReview={vi.fn()}
      />,
    );
    expect(within(screen.getByRole("region", { name: "Safe to spend" })).getByText("$400.00"))
      .toBeInTheDocument();
    expect(screen.getByText("Balance minus reserved essentials")).toBeInTheDocument();
  });

  it("respects supporting-card order and visibility", () => {
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
        dashboardOrder={["balance", "received", "leftToPay", "safeToSpend", "overdue", "dueLater"]}
        hiddenDashboardMetrics={["overdue"]}
        onToggle={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onJumpElsewhere={vi.fn()}
        onSelectMonth={vi.fn()}
        onManageCategory={vi.fn()}
        onOpenYearReview={vi.fn()}
      />,
    );
    const labels = screen.getAllByText(/Received|Left to pay|Safe to spend|Still ahead/, {
      selector: ".stat-label",
    });
    expect(labels.map((label) => label.textContent)).toEqual([
      "Received",
      "Left to pay",
      "Safe to spend",
      "Still ahead",
    ]);
    expect(screen.queryByText("Overdue", { selector: ".stat-label" })).not.toBeInTheDocument();
  });
});

describe("MonthView payment planner", () => {
  it("shows the highest-ranked open bill first", () => {
    const essential = {
      ...occurrence,
      key: "power|2026-09-10",
      date: "2026-09-10",
      entry: { ...entry, id: "power", description: "Power", priority: "essential" as const },
    };
    const overdue = {
      ...occurrence,
      key: "gym|2026-09-01",
      date: "2026-09-01",
      entry: { ...entry, id: "gym", description: "Gym", priority: "flexible" as const },
    };
    render(
      <MonthView
        month="2026-09"
        occurrences={[essential, overdue]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        catchDelay={0}
        balance={500_00}
        carriedIn={0}
        globalOverdueTotal={100_00}
        elsewhere={[]}
        history={[]}
        budgets={[]}
        priority="leftToPay"
        onToggle={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onJumpElsewhere={vi.fn()}
        onSelectMonth={vi.fn()}
        onManageCategory={vi.fn()}
        onOpenYearReview={vi.fn()}
      />,
    );
    const planner = screen.getByRole("region", { name: "Pay next" });
    expect(within(planner).getAllByRole("button")[0]).toHaveTextContent("Gym");
  });

  it("persists a selected month filter", async () => {
    const user = userEvent.setup();
    const onPreferenceChange = vi.fn();
    render(
      <MonthView
        month="2026-09"
        occurrences={[occurrence]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        catchDelay={0}
        balance={0}
        carriedIn={0}
        globalOverdueTotal={0}
        elsewhere={[]}
        history={[]}
        budgets={[]}
        priority="leftToPay"
        onPreferenceChange={onPreferenceChange}
        onToggle={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onJumpElsewhere={vi.fn()}
        onSelectMonth={vi.fn()}
        onManageCategory={vi.fn()}
        onOpenYearReview={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Essential" }));
    expect(onPreferenceChange).toHaveBeenCalledWith({ monthFilter: "essential" });
  });
});
