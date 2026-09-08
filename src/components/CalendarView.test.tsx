import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Occurrence } from "../types.ts";
import { CalendarView } from "./CalendarView.tsx";

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

    await user.click(screen.getByRole("button", { name: /Previous day/i }));
    expect(screen.getByRole("dialog", { name: /September 05, 2026/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next day/i }));
    expect(screen.getByRole("dialog", { name: /September 06, 2026/i })).toBeInTheDocument();
  });
});
