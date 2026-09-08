import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Entry, Occurrence } from "../types.ts";
import { CashRunway } from "./CashRunway.tsx";

const entry: Entry = {
  id: "rent",
  kind: "expense",
  description: "Rent",
  amount: 300_00,
  dueDate: "2026-09-05",
  repeat: "none",
  repeatCount: null,
  category: "Home",
  note: "",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  deletedAt: null,
};

const occurrence: Occurrence = {
  key: "rent|2026-09-05",
  entry,
  date: "2026-09-05",
  index: 0,
  amount: 300_00,
  payment: null,
  skipped: false,
};

describe("CashRunway", () => {
  it("moves an accessible crosshair to the nearest projected point", () => {
    render(
      <CashRunway
        carriedIn={500_00}
        occurrences={[occurrence]}
        currency="USD"
        language="en"
        t={translatorFor("en")}
      />,
    );

    const chart = screen.getByRole("application", { name: "Projected balance chart" });
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      height: 96,
      right: 200,
      bottom: 96,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(chart, { clientX: 190 });

    expect(screen.getByRole("status")).toHaveTextContent("Sep 05");
    expect(screen.getByRole("status")).toHaveTextContent("$200.00");
  });

  it("supports keyboard exploration of projected points", () => {
    render(
      <CashRunway
        carriedIn={500_00}
        occurrences={[occurrence]}
        currency="USD"
        language="en"
        t={translatorFor("en")}
      />,
    );

    const chart = screen.getByRole("application", { name: "Projected balance chart" });
    fireEvent.keyDown(chart, { key: "ArrowRight" });

    expect(screen.getByRole("status")).toHaveTextContent("Sep 05");
  });
});
