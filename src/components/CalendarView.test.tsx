import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Entry, Occurrence } from "../types.ts";
import { CalendarView } from "./CalendarView.tsx";

function plannedOccurrence(date: string, kind: Entry["kind"], amount: number): Occurrence {
  const entry: Entry = {
    id: `${kind}-${date}`,
    updatedAt: "2026-09-01T00:00:00.000Z",
    kind,
    description: kind === "expense" ? "Utilities" : "Salary",
    amount,
    dueDate: date,
    repeat: "none",
    repeatCount: 1,
    category: "",
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
  };

  return {
    key: `${entry.id}|${date}`,
    entry,
    date,
    index: 0,
    amount,
    payment: null,
    skipped: false,
  };
}

describe("CalendarView day card", () => {
  it("opens an anchored day popover with quick actions when a date is selected", async () => {
    const onAddForDay = vi.fn();
    const user = userEvent.setup();

    render(
      <CalendarView
        month="2026-09"
        occurrences={[]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onToggle={vi.fn<(occurrence: Occurrence) => void>()}
        onOpen={vi.fn<(occurrence: Occurrence) => void>()}
        onDelete={vi.fn()}
        onAddForDay={onAddForDay}
      />,
    );

    await user.click(screen.getByRole("button", { name: /September 05, 2026/i }));

    const card = screen.getByRole("dialog", { name: /September 05, 2026/i });
    expect(within(card).getByText("Nothing on this day.")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /Add a bill/i }));
    expect(onAddForDay).toHaveBeenCalledWith("2026-09-05", "expense");

    await user.click(within(card).getByRole("button", { name: /Add income/i }));
    expect(onAddForDay).toHaveBeenCalledWith("2026-09-05", "income");
  });

  it("dismisses the day popover from any inactive calendar surface or with Escape", async () => {
    const user = userEvent.setup();

    render(
      <>
        <CalendarView
          month="2026-09"
          occurrences={[]}
          today="2026-09-04"
          currency="USD"
          language="en"
          t={translatorFor("en")}
          onToggle={vi.fn<(occurrence: Occurrence) => void>()}
          onOpen={vi.fn<(occurrence: Occurrence) => void>()}
          onDelete={vi.fn()}
          onAddForDay={vi.fn()}
        />
        <button type="button">Outside the calendar</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: /September 05, 2026/i }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside the calendar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /September 05, 2026/i }));
    fireEvent.pointerDown(screen.getByText("Due"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /September 05, 2026/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports quick day navigation by keyboard and popover controls", async () => {
    const user = userEvent.setup();

    render(
      <CalendarView
        month="2026-09"
        occurrences={[]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onToggle={vi.fn<(occurrence: Occurrence) => void>()}
        onOpen={vi.fn<(occurrence: Occurrence) => void>()}
        onDelete={vi.fn()}
        onAddForDay={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /September 05, 2026/i }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: /September 06, 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /September 06, 2026/i })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /Previous day/i }));
    expect(screen.getByRole("dialog", { name: /September 05, 2026/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next day/i }));
    expect(screen.getByRole("dialog", { name: /September 06, 2026/i })).toBeInTheDocument();
  });

  it("jumps to the next scheduled day from the calendar toolbar", async () => {
    const user = userEvent.setup();

    render(
      <CalendarView
        month="2026-09"
        occurrences={[plannedOccurrence("2026-09-10", "expense", 24500)]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onToggle={vi.fn<(occurrence: Occurrence) => void>()}
        onOpen={vi.fn<(occurrence: Occurrence) => void>()}
        onDelete={vi.fn()}
        onAddForDay={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next planned/i }));
    expect(screen.getByRole("dialog", { name: /September 10, 2026/i })).toBeInTheDocument();
  });

  it("shows the selected week cash context", async () => {
    const user = userEvent.setup();

    render(
      <CalendarView
        month="2026-09"
        occurrences={[
          plannedOccurrence("2026-09-10", "expense", 24500),
          plannedOccurrence("2026-09-11", "income", 100000),
        ]}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onToggle={vi.fn<(occurrence: Occurrence) => void>()}
        onOpen={vi.fn<(occurrence: Occurrence) => void>()}
        onDelete={vi.fn()}
        onAddForDay={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /September 10, 2026/i }));
    const popover = screen.getByRole("dialog", { name: /September 10, 2026/i });
    expect(within(popover).getByText("This week")).toBeInTheDocument();
    expect(within(popover).getByText("+$755.00")).toBeInTheDocument();
  });
});
