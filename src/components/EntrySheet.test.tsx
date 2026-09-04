import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import { blankDraft } from "../services/ledger.ts";
import { EntrySheet } from "./EntrySheet.tsx";

describe("EntrySheet priority", () => {
  it("saves the selected priority with an expense", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EntrySheet
        draft={blankDraft("expense", "2026-09-04")}
        isNew
        categories={[]}
        currency="USD"
        language="en"
        t={translatorFor("en")}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Description"), "Rent");
    await user.type(screen.getByPlaceholderText("0.00"), "1200");
    await user.selectOptions(screen.getByLabelText("Priority"), "essential");
    await user.click(screen.getAllByRole("button", { name: "Save" }).at(-1)!);

    expect(onSave.mock.calls[0][0].priority).toBe("essential");
  });
});
