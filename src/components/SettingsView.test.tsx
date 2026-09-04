import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Settings } from "../types.ts";
import { SettingsView } from "./SettingsView.tsx";

describe("SettingsView", () => {
  it("saves the dashboard metric selected by the user", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const settings: Settings = {
      language: "en",
      currency: "USD",
      theme: "system",
      syncCode: "",
      dashboardPriority: "leftToPay",
    };

    render(
      <SettingsView
        settings={settings}
        onChange={onChange}
        counts={{ entries: 0, payments: 0 }}
        sync={{ state: "off", lastSyncedAt: null }}
        onSyncNow={vi.fn()}
        onExport={vi.fn()}
        onExportCsv={vi.fn()}
        onImport={vi.fn()}
        onErase={vi.fn()}
        importMessage={null}
        hasLock={false}
        onSetLock={vi.fn()}
        onRemoveLock={vi.fn()}
        t={translatorFor("en")}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Dashboard priority"), "balance");

    expect(onChange).toHaveBeenCalledWith({ ...settings, dashboardPriority: "balance" });
  });
});
