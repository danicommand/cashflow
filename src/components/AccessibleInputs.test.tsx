import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import { LockScreen } from "./LockScreen.tsx";
import { SearchSheet } from "./SearchSheet.tsx";

describe("input accessible names", () => {
  it("names the search field without relying on its placeholder", () => {
    render(
      <SearchSheet
        entries={[]}
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onJump={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });

  it("names the lock-screen PIN field", () => {
    render(<LockScreen t={translatorFor("en")} onUnlock={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByLabelText("PIN")).toBeInTheDocument();
  });
});
