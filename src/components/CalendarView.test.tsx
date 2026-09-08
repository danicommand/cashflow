import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Occurrence } from "../types.ts";
import { CalendarView } from "./CalendarView.tsx";

describe("CalendarView day card", () => {
  it("opens a day card with an add action when a date is selected", async () => {
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

    const card = screen.getByRole("region", { name: /September 05, 2026/i });
    expect(within(card).getByText("Nothing on this day.")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /Add a bill/i }));
    expect(onAddForDay).toHaveBeenCalledWith("2026-09-05");
  });
});
