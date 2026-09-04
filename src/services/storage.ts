/**
 * Local persistence.
 *
 * The device is the source of truth: the app reads and writes here on every
 * change and works with no connection at all. Sync, when it is on, is a
 * background reconciliation of this store with the cloud copy — never a
 * prerequisite for using the app.
 *
 * Everything lives under two keys. Splitting the ledger into one key per
 * record would be faster to write and far slower to read, and a personal
 * ledger is small enough that rewriting the blob costs nothing.
 */

import {
  DASHBOARD_PRIORITIES,
  type DashboardPriority,
  type Ledger,
  type MonthFilter,
  type MonthSort,
  type Settings,
} from "../types.ts";
import { detectLanguage } from "../i18n.ts";
import { emptyLedger, sanitiseLedger } from "./merge.ts";

const LEDGER_KEY = "cashflow.ledger.v1";
const SETTINGS_KEY = "cashflow.settings.v1";

/**
 * A ceiling on what one device will hold. Browsers give an origin roughly 5 MB
 * of localStorage, and writing past it throws mid-write. A personal ledger
 * would have to run for decades to approach this, so hitting it means
 * something has gone wrong upstream and refusing the write is the safe answer.
 */
export const MAX_LEDGER_BYTES = 1_500_000;

function storage(): Storage | null {
  try {
    // Safari in private mode exposes localStorage and throws on write, so the
    // probe has to be a real write rather than a presence check.
    const probe = "cashflow.probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function defaultSettings(): Settings {
  const candidates = typeof navigator === "undefined" ? [] : navigator.languages ?? [];
  const language = detectLanguage(candidates);
  return {
    language,
    currency: language === "pt" ? "BRL" : "USD",
    theme: "system",
    syncCode: "",
    dashboardPriority: "leftToPay",
    dashboardOrder: [...DASHBOARD_PRIORITIES],
    hiddenDashboardMetrics: [],
    reminderLeadDays: 1,
    remindersEnabled: false,
    monthSort: "smart",
    monthFilter: "all",
    showSettledByDefault: false,
    compactRows: false,
  };
}

export function loadSettings(): Settings {
  const store = storage();
  const fallback = defaultSettings();
  if (!store) return fallback;
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const value = parsed as Partial<Settings>;
    const order = Array.isArray(value.dashboardOrder)
      ? value.dashboardOrder.filter(
          (metric, index, values): metric is DashboardPriority =>
            DASHBOARD_PRIORITIES.includes(metric as DashboardPriority) &&
            values.indexOf(metric) === index,
        )
      : [];
    const dashboardOrder = [
      ...order,
      ...DASHBOARD_PRIORITIES.filter((metric) => !order.includes(metric)),
    ];
    const hiddenDashboardMetrics = Array.isArray(value.hiddenDashboardMetrics)
      ? value.hiddenDashboardMetrics.filter((metric): metric is DashboardPriority =>
          DASHBOARD_PRIORITIES.includes(metric as DashboardPriority),
        )
      : [];
    const monthSorts: MonthSort[] = ["smart", "date", "amount", "priority"];
    const monthFilters: MonthFilter[] = ["all", "overdue", "essential", "upcoming"];
    const leadDays = value.reminderLeadDays;
    return {
      language: value.language === "pt" ? "pt" : "en",
      currency:
        value.currency === "BRL" || value.currency === "EUR" || value.currency === "GBP"
          ? value.currency
          : "USD",
      theme:
        value.theme === "light" || value.theme === "dark" ? value.theme : "system",
      syncCode: typeof value.syncCode === "string" ? value.syncCode.slice(0, 120) : "",
      dashboardPriority: DASHBOARD_PRIORITIES.includes(
        value.dashboardPriority as DashboardPriority,
      )
        ? (value.dashboardPriority as DashboardPriority)
        : "leftToPay",
      dashboardOrder,
      hiddenDashboardMetrics,
      reminderLeadDays: leadDays === 0 || leadDays === 3 || leadDays === 7 ? leadDays : 1,
      remindersEnabled: value.remindersEnabled === true,
      monthSort: monthSorts.includes(value.monthSort as MonthSort)
        ? (value.monthSort as MonthSort)
        : "smart",
      monthFilter: monthFilters.includes(value.monthFilter as MonthFilter)
        ? (value.monthFilter as MonthFilter)
        : "all",
      showSettledByDefault: value.showSettledByDefault === true,
      compactRows: value.compactRows === true,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A full disk should not take the app down; the session keeps working and
    // the next successful write catches up.
  }
}

export function loadLedger(): Ledger {
  const store = storage();
  if (!store) return emptyLedger();
  try {
    const raw = store.getItem(LEDGER_KEY);
    if (!raw) return emptyLedger();
    return sanitiseLedger(JSON.parse(raw));
  } catch {
    return emptyLedger();
  }
}

export type SaveResult = "saved" | "unavailable" | "too-large" | "failed";

export function saveLedger(ledger: Ledger): SaveResult {
  const store = storage();
  if (!store) return "unavailable";
  const serialised = JSON.stringify(ledger);
  if (serialised.length > MAX_LEDGER_BYTES) return "too-large";
  try {
    store.setItem(LEDGER_KEY, serialised);
    return "saved";
  } catch {
    return "failed";
  }
}

export function clearLedger(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(LEDGER_KEY);
  } catch {
    // Nothing useful to do; the in-memory state is already cleared.
  }
}

export interface BackupFile {
  app: "cashflow";
  version: 1;
  exportedAt: string;
  ledger: Ledger;
}

export function buildBackup(ledger: Ledger): BackupFile {
  return {
    app: "cashflow",
    version: 1,
    exportedAt: new Date().toISOString(),
    ledger,
  };
}

/**
 * Read a backup file. Both the wrapped export format and a bare ledger are
 * accepted, so a file someone edited by hand still restores.
 */
export function readBackup(raw: string): Ledger | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const wrapped = (parsed as { ledger?: unknown }).ledger;
    const source: unknown = wrapped ?? parsed;
    if (typeof source !== "object" || source === null) return null;

    // An empty result could mean an empty ledger or a file that was never a
    // ledger. The two are told apart by whether the shape is there at all.
    const shaped = source as { entries?: unknown; payments?: unknown };
    if (!Array.isArray(shaped.entries) && !Array.isArray(shaped.payments)) return null;

    return sanitiseLedger(source);
  } catch {
    return null;
  }
}
