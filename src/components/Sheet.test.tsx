import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Sheet } from "./Sheet.tsx";

describe("Sheet", () => {
  it("focuses the first form field instead of the close control", () => {
    render(
      <Sheet title="Search" closeLabel="Close" onClose={vi.fn()}>
        <input aria-label="Search" />
      </Sheet>,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
  });

  it("wraps keyboard focus within the modal", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Sheet
        title="Edit bill"
        closeLabel="Close"
        onClose={vi.fn()}
        footer={<button type="button">Save</button>}
      >
        <input aria-label="Description" />
      </Sheet>,
    );

    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    await user.tab();
    expect(close).toHaveFocus();

    const firstGuard = container.querySelector<HTMLElement>(".focus-guard");
    firstGuard?.focus();
    expect(save).toHaveFocus();
  });

  it("restores focus to the control that opened it", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <Sheet title="Edit bill" closeLabel="Close" onClose={vi.fn()}>
        <input aria-label="Description" />
      </Sheet>,
    );

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
