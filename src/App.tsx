import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarView } from "./components/CalendarView.tsx";
import { EntrySheet } from "./components/EntrySheet.tsx";
import { MonthView } from "./components/MonthView.tsx";
import { SettingsView } from "./components/SettingsView.tsx";
import { SettleSheet } from "./components/SettleSheet.tsx";
import { Toast } from "./components/Toast.tsx";
import { useFabVisible } from "./hooks/useFabVisible.ts";
import { useSync } from "./hooks/useSync.ts";
import { FLIGHT_CATCH_MS, flyToTotal, measureOccurrenceAmount } from "./motion/flight.ts";
import { translatorFor } from "./i18n.ts";
import type { Entry, Ledger, Occurrence, Settings } from "./types.ts";
import {
  addDays,
  currentMonthKey,
  firstDayOfMonth,
  lastDayOfMonth,
  monthKey,
  shiftMonthKey,
  todayIso,
} from "./services/dates.ts";
import { formatMonthTitle } from "./services/formats.ts";
import {
  addEntry,
  blankDraft,
  deleteEntry,
  draftFrom,
  knownCategories,
  restoreEntry,
  settleOccurrence,
  unsettleOccurrence,
  updateEntry,
  type EntryDraft,
} from "./services/ledger.ts";
import { mergeLedgers } from "./services/merge.ts";
import { occurrencesInMonth, overdueExpenses, upcomingExpenses } from "./services/occurrences.ts";
import { runningBalance } from "./services/summary.ts";
import { spendHistory } from "./services/trend.ts";
import {
  buildBackup,
  clearLedger,
  loadLedger,
  loadSettings,
  readBackup,
  saveLedger,
  saveSettings,
} from "./services/storage.ts";

/** How far ahead an upcoming bill counts as "coming up" in the cross-month panel. */
const UPCOMING_WINDOW_DAYS = 14;

/** How many cross-month items the panel shows before it stops rather than scrolls. */
const UPCOMING_LIMIT = 5;

/** How many months the "Recent months" chart covers, the displayed month included. */
const HISTORY_MONTHS = 6;

/** How long a toast stays before it dismisses itself. */
const TOAST_MS = 6_000;

type Tab = "month" | "calendar" | "settings";

interface EditorState {
  entry: Entry | null;
  draft: EntryDraft;
}

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function App() {
  const [ledger, setLedger] = useState<Ledger>(loadLedger);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>("month");
  const [month, setMonth] = useState(currentMonthKey);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [settling, setSettling] = useState<Occurrence | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  /**
   * Which way the month last moved, so the outgoing and incoming views travel
   * in the same direction the person asked for. Without this a step backwards
   * animates identically to a step forwards and the gesture loses its meaning.
   */
  const [monthStep, setMonthStep] = useState<"forward" | "back">("forward");
  /**
   * Non-zero for as long as an amount is in the air, so the total holds still
   * and then rolls as the amount lands rather than changing before it arrives.
   */
  const [catchDelay, setCatchDelay] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const fabVisible = useFabVisible();

  const t = useMemo(() => translatorFor(settings.language), [settings.language]);
  const today = todayIso();

  useEffect(() => {
    saveLedger(ledger);
  }, [ledger]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
    if (settings.theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.language, settings.theme]);

  /**
   * A sync result is merged into whatever the ledger is *now*, not into the
   * snapshot the request was built from — an edit made while the request was
   * in flight would otherwise be thrown away by its own response.
   */
  const applyMerged = useCallback((merged: Ledger) => {
    setLedger((current) => mergeLedgers(current, merged));
  }, []);

  const { status: syncStatus, syncNow } = useSync(settings.syncCode, ledger, applyMerged);

  const occurrences = useMemo(
    () => occurrencesInMonth(ledger.entries, ledger.payments, month),
    [ledger, month],
  );

  /**
   * The running cash balance through the end of the displayed month, and the
   * slice of it that arrived before the month even started. Both are keyed on
   * `payment.paidOn`, not on any occurrence's due date, so a bill due in
   * August but settled in September still spends September's balance —
   * see `runningBalance` for why that distinction matters.
   */
  const { balance, carriedIn } = useMemo(() => {
    const monthEnd = lastDayOfMonth(month);
    const dayBeforeMonth = addDays(firstDayOfMonth(month), -1);
    return {
      balance: runningBalance(ledger.entries, ledger.payments, monthEnd),
      carriedIn: runningBalance(ledger.entries, ledger.payments, dayBeforeMonth),
    };
  }, [ledger, month]);

  /**
   * Overdue and soon-due bills that belong to a month other than the one on
   * screen, plus the true overdue total regardless of month. The current
   * month's own overdue and upcoming bills are already in its list below;
   * showing them again in the cross-month panel would just be noise, but the
   * overdue *total* stays unfiltered — it is the one figure on the month view
   * meant to be true no matter which month is being browsed.
   */
  const { elsewhere, globalOverdueTotal } = useMemo(() => {
    const overdue = overdueExpenses(ledger.entries, ledger.payments, today);
    const upcoming = upcomingExpenses(ledger.entries, ledger.payments, today, UPCOMING_WINDOW_DAYS);
    return {
      globalOverdueTotal: overdue.reduce((sum, occurrence) => sum + occurrence.amount, 0),
      elsewhere: [...overdue, ...upcoming]
        .filter((occurrence) => monthKey(occurrence.date) !== month)
        .slice(0, UPCOMING_LIMIT),
    };
  }, [ledger, today, month]);

  /** What was actually paid in each of the last several months, for the trend chart. */
  const history = useMemo(
    () => spendHistory(ledger.entries, ledger.payments, month, today, HISTORY_MONTHS),
    [ledger, month, today],
  );

  const openEditorForNew = () => {
    // A bill added while looking at March is almost certainly a March bill.
    const start = month === currentMonthKey() ? today : firstDayOfMonth(month);
    setEditor({ entry: null, draft: blankDraft("expense", start) });
  };

  const openEditorFor = (occurrence: Occurrence) => {
    setEditor({ entry: occurrence.entry, draft: draftFrom(occurrence.entry) });
  };

  /** Every way of changing months funnels through here, so the travel
   * direction is always set from where the view is actually going rather
   * than from how it was asked for. */
  const goToMonth = (target: string) => {
    setMonthStep(target >= month ? "forward" : "back");
    setMonth(target);
  };

  const stepMonth = (step: number) => goToMonth(shiftMonthKey(month, step));

  const goToThisMonth = () => goToMonth(currentMonthKey());

  const jumpToOccurrenceMonth = (occurrence: Occurrence) => goToMonth(monthKey(occurrence.date));

  /**
   * A couple of shortcuts for a keyboard, never the only way to do anything —
   * a phone has no keyboard to press them on. Both stay out of the way of
   * typing: a focused field, or a sheet already open and owning its own keys,
   * disables them entirely rather than trying to guess intent.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editor || settling) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      const typing =
        target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openEditorForNew();
      } else if (event.key === "ArrowLeft" && tab !== "settings") {
        event.preventDefault();
        stepMonth(-1);
      } else if (event.key === "ArrowRight" && tab !== "settings") {
        event.preventDefault();
        stepMonth(1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  /** Replaces whatever toast is showing rather than queuing behind it — the
   * newest thing that happened is the one worth a person's attention. */
  const showToast = (message: string, actionLabel?: string, onAction?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, actionLabel, onAction });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  };

  const dismissToast = () => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  };

  const toggleOccurrence = (occurrence: Occurrence) => {
    if (occurrence.payment) {
      setLedger((current) =>
        unsettleOccurrence(current, occurrence.entry.id, occurrence.date),
      );
      return;
    }
    setSettling(occurrence);
  };

  /**
   * Settling a bill, choreographed.
   *
   * The row is measured *before* the state change, while it is still where the
   * person tapped it; a moment later it will have left the unpaid list. The
   * total then holds for the length of the flight so the two halves of the
   * event read as one.
   */
  const settle = (occurrence: Occurrence, amount: number, paidOn: string) => {
    const origin = measureOccurrenceAmount(occurrence.key);
    setLedger((current) =>
      settleOccurrence(current, occurrence.entry.id, occurrence.date, amount, paidOn),
    );
    setSettling(null);
    if (!origin) return;
    setCatchDelay(FLIGHT_CATCH_MS);
    flyToTotal(origin);
    window.setTimeout(() => setCatchDelay(0), 1_200);
  };

  const saveEntry = (draft: EntryDraft) => {
    setLedger((current) =>
      editor?.entry ? updateEntry(current, editor.entry.id, draft) : addEntry(current, draft),
    );
    setEditor(null);
  };

  /**
   * Deleting is immediate and reversible rather than gated behind a confirm
   * dialog: the record becomes a tombstone the moment this runs, so "Undo" on
   * the toast that follows is just clearing it — no different in kind from
   * unsettling a bill by tapping its tick again.
   */
  const removeEntry = () => {
    if (!editor?.entry) return;
    const { id, description } = editor.entry;
    const stamp = new Date();
    setLedger((current) => deleteEntry(current, id, stamp));
    setEditor(null);
    showToast(t("toast.deleted", { description: description || t("form.expense") }), t("action.undo"), () => {
      setLedger((current) => restoreEntry(current, id, stamp.toISOString()));
    });
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackup(ledger), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cashflow-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    const restored = readBackup(await file.text());
    if (!restored) {
      setImportMessage(t("settings.importFailed"));
      return;
    }
    // Restoring merges rather than replaces, so a backup taken on one device
    // cannot silently wipe entries made on this one.
    setLedger((current) => mergeLedgers(current, restored));
    setImportMessage(
      t("settings.importDone", {
        entries: restored.entries.length,
        payments: restored.payments.length,
      }),
    );
  };

  const eraseLocal = () => {
    clearLedger();
    setLedger({ entries: [], payments: [] });
  };

  const showsMonthNav = tab === "month" || tab === "calendar";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{t("appName")}</span>
          {syncStatus.state !== "off" ? (
            <span
              className={`sync-dot ${syncStatus.state}`}
              title={
                syncStatus.state === "error" ? t("settings.syncFailed") : t("settings.syncOn")
              }
              aria-hidden="true"
            />
          ) : null}
        </div>

        <nav className="tabs" aria-label={t("appName")}>
          {(["month", "calendar", "settings"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={tab === value ? "tab active" : "tab"}
              aria-current={tab === value ? "page" : undefined}
              onClick={() => setTab(value)}
            >
              {t(`nav.${value}`)}
            </button>
          ))}
        </nav>
      </header>

      {showsMonthNav ? (
        <div className="monthbar">
          <button
            type="button"
            className="icon-button"
            aria-label={t("month.previous")}
            onClick={() => stepMonth(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="month-title">{formatMonthTitle(month, settings.language)}</h1>
          <button
            type="button"
            className="icon-button"
            aria-label={t("month.next")}
            onClick={() => stepMonth(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {month === currentMonthKey() ? null : (
            <button
              type="button"
              className="link-button today-button"
              onClick={goToThisMonth}
            >
              {t("month.today")}
            </button>
          )}
        </div>
      ) : null}

      <main className="content">
        {/* Keyed on what is being shown, so switching tab or month replays the
            entrance; the direction attribute tells it which way to travel. */}
        <div className="view" key={`${tab}:${month}`} data-step={monthStep}>
          {tab === "month" ? (
            <MonthView
              month={month}
              occurrences={occurrences}
              today={today}
              currency={settings.currency}
              language={settings.language}
              t={t}
              catchDelay={catchDelay}
              balance={balance}
              carriedIn={carriedIn}
              globalOverdueTotal={globalOverdueTotal}
              elsewhere={elsewhere}
              history={history}
              onToggle={toggleOccurrence}
              onOpen={openEditorFor}
              onJumpElsewhere={jumpToOccurrenceMonth}
              onSelectMonth={goToMonth}
            />
          ) : null}

          {tab === "calendar" ? (
            <CalendarView
              month={month}
              occurrences={occurrences}
              today={today}
              currency={settings.currency}
              language={settings.language}
              t={t}
              onToggle={toggleOccurrence}
              onOpen={openEditorFor}
            />
          ) : null}

          {tab === "settings" ? (
            <SettingsView
              settings={settings}
              onChange={setSettings}
              counts={{
                entries: ledger.entries.filter((entry) => !entry.deletedAt).length,
                payments: ledger.payments.filter((payment) => !payment.deletedAt).length,
              }}
              sync={syncStatus}
              onSyncNow={syncNow}
              onExport={exportBackup}
              onImport={(file) => void importBackup(file)}
              onErase={eraseLocal}
              importMessage={importMessage}
              t={t}
            />
          ) : null}
        </div>
      </main>

      {tab !== "settings" ? (
        <button
          type="button"
          className={fabVisible ? "fab" : "fab fab-hidden"}
          tabIndex={fabVisible ? 0 : -1}
          onClick={openEditorForNew}
          aria-label={t("action.addExpense")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : null}

      {editor ? (
        <EntrySheet
          draft={editor.draft}
          isNew={editor.entry === null}
          categories={knownCategories(ledger)}
          currency={settings.currency}
          language={settings.language}
          t={t}
          onSave={saveEntry}
          onDelete={editor.entry ? removeEntry : undefined}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {settling ? (
        <SettleSheet
          occurrence={settling}
          today={today}
          currency={settings.currency}
          language={settings.language}
          t={t}
          onConfirm={(amount, paidOn) => settle(settling, amount, paidOn)}
          onClose={() => setSettling(null)}
        />
      ) : null}

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={dismissToast}
          closeLabel={t("action.close")}
          durationMs={TOAST_MS}
        />
      ) : null}
    </div>
  );
}
