import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { translatorFor } from "../i18n.ts";
import type { Settings } from "../types.ts";
import { SettingsView } from "./SettingsView.tsx";

const settings: Settings = {
  language: "en",
  currency: "USD",
  theme: "system",
  syncCode: "",
  dashboardPriority: "leftToPay",
  dashboardOrder: ["leftToPay", "safeToSpend", "balance", "overdue", "dueLater", "received"],
  hiddenDashboardMetrics: [],
  reminderLeadDays: 1,
  remindersEnabled: false,
  monthSort: "smart",
  monthFilter: "all",
  showSettledByDefault: false,
  compactRows: false,
};

function renderSettings(onChange = vi.fn(), onEnableReminders = vi.fn()) {
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
      onEnableReminders={onEnableReminders}
      t={translatorFor("en")}
    />,
  );
}

describe("SettingsView", () => {
  it("saves the dashboard metric selected by the user", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(onChange);

    await user.selectOptions(screen.getByLabelText("Dashboard priority"), "balance");

    expect(onChange).toHaveBeenCalledWith({ ...settings, dashboardPriority: "balance" });
  });

  it("hides a supporting dashboard card", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(onChange);
    await user.click(screen.getByRole("checkbox", { name: "Show Received" }));
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      hiddenDashboardMetrics: ["received"],
    });
  });

  it("moves a dashboard card up", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(onChange);
    await user.click(screen.getByRole("button", { name: "Move Safe to spend up" }));
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      dashboardOrder: ["safeToSpend", "leftToPay", "balance", "overdue", "dueLater", "received"],
    });
  });

  it("requests reminder permission from an explicit button", async () => {
    const user = userEvent.setup();
    const onEnableReminders = vi.fn();
    renderSettings(vi.fn(), onEnableReminders);
    await user.click(screen.getByRole("button", { name: "Enable reminders" }));
    expect(onEnableReminders).toHaveBeenCalledOnce();
  });
});
