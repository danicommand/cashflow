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
  it("uses the check circle as the direct paid toggle without opening the row", async () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <OccurrenceRow
        occurrence={occurrence}
        today="2026-09-04"
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onToggle={onToggle}
        onOpen={onOpen}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark paid: Rent" }));

    expect(onToggle).toHaveBeenCalledWith(occurrence);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps detailed payment editing behind the amount instead of the check circle", async () => {
    const onPaymentDetails = vi.fn();
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
        onDelete={vi.fn()}
        onPaymentDetails={onPaymentDetails}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Payment details: Rent" }));
    expect(onPaymentDetails).toHaveBeenCalledWith(occurrence);
  });

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
