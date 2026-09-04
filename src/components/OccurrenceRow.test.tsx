import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Entry, Occurrence } from "../types.ts";
import { OccurrenceRow } from "./OccurrenceRow.tsx";

const entry: Entry = {
  id: "rent",
  kind: "expense",
  description: "Rent",
  amount: 120_000,
  dueDate: "2026-09-05",
  repeat: "monthly",
  repeatCount: null,
  category: "Home",
  note: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

const occurrence: Occurrence = {
  key: "rent|2026-09-05",
  entry,
  date: "2026-09-05",
  index: 8,
  amount: 120_000,
  payment: null,
  skipped: false,
};

describe("OccurrenceRow", () => {
  it("offers a named remove control that deletes the underlying entry", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <OccurrenceRow
        occurrence={occurrence}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onToggle={vi.fn()}
        onOpen={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Rent" }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(entry);
  });
});
