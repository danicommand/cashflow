import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarView } from "./components/CalendarView.tsx";
import { CategorySheet } from "./components/CategorySheet.tsx";
import { EntrySheet } from "./components/EntrySheet.tsx";
import { LockScreen } from "./components/LockScreen.tsx";
import { MonthView } from "./components/MonthView.tsx";
import { SearchSheet } from "./components/SearchSheet.tsx";
import { SettingsView } from "./components/SettingsView.tsx";
import { SettleSheet } from "./components/SettleSheet.tsx";
import { Toast } from "./components/Toast.tsx";
import { YearReviewSheet } from "./components/YearReviewSheet.tsx";
import { useFabVisible } from "./hooks/useFabVisible.ts";
import { useSync } from "./hooks/useSync.ts";
import { FLIGHT_CATCH_MS, flyToTotal, measureOccurrenceAmount } from "./motion/flight.ts";
import { translatorFor } from "./i18n.ts";
import type { Entry, Ledger, Occurrence, Settings } from "./types.ts";
import { budgetFor } from "./services/budgets.ts";
import { toCsv } from "./services/csv.ts";
import {
  addDays,
  currentMonthKey,
  firstDayOfMonth,
  lastDayOfMonth,
  monthKey,
  parseMonthKey,
  shiftMonthKey,
  todayIso,
} from "./services/dates.ts";
import { formatMonthTitle } from "./services/formats.ts";
import { instalmentProgress } from "./services/instalments.ts";
import {
  addEntry,
  blankDraft,
  deleteEntry,
  draftFrom,
  knownCategories,
  removeBudget,
  renameCategory,
  restoreEntry,
  setBudget,
  settleOccurrence,
  skipOccurrence,
  unsettleOccurrence,
  unskipOccurrence,
  updateEntry,
  type EntryDraft,
} from "./services/ledger.ts";
import { clearLock, hasLock, setLock, verifyLock } from "./services/lock.ts";
import { applyUpdate, UPDATE_EVENT } from "./pwa.ts";
import { mergeLedgers } from "./services/merge.ts";
import { occurrencesInMonth, overdueExpenses, upcomingExpenses } from "./services/occurrences.ts";
import type { SearchResult } from "./services/search.ts";
import { runningBalance } from "./services/summary.ts";
import { spendHistory } from "./services/trend.ts";
import { yearSummary } from "./services/yearReview.ts";
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
  const [locked, setLocked] = useState(hasLock);
  const [lockEnabled, setLockEnabled] = useState(hasLock);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [viewingYear, setViewingYear] = useState(false);

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
    () => occurrencesInMonth(ledger.entries, ledger.payments, ledger.skips, month),
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
    const overdue = overdueExpenses(ledger.entries, ledger.payments, ledger.skips, today);
    const upcoming = upcomingExpenses(
      ledger.entries,
      ledger.payments,
      ledger.skips,
      today,
      UPCOMING_WINDOW_DAYS,
    );
    return {
      globalOverdueTotal: overdue.reduce((sum, occurrence) => sum + occurrence.amount, 0),
      elsewhere: [...overdue, ...upcoming]
        .filter((occurrence) => monthKey(occurrence.date) !== month)
        .slice(0, UPCOMING_LIMIT),
    };
  }, [ledger, today, month]);

  /** What was actually paid in each of the last several months, for the trend chart. */
  const history = useMemo(
    () => spendHistory(ledger.entries, ledger.payments, ledger.skips, month, today, HISTORY_MONTHS),
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
      if (locked || editor || settling || managingCategory !== null || searching || viewingYear) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      const typing =
        target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openEditorForNew();
      } else if (event.key === "/") {
        event.preventDefault();
        setSearching(true);
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

  /**
   * A new service worker installing surfaces here as an ordinary toast, not
   * a silent takeover — the same acknowledgment pattern deleting a bill
   * uses, so an update reads as "something happened, here's the option" the
   * same way everything else in the app does.
   */
  useEffect(() => {
    const onUpdate = () => {
      showToast(t("update.available"), t("update.reload"), applyUpdate);
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(UPDATE_EVENT, onUpdate);
  }, [t]);

  const toggleOccurrence = (occurrence: Occurrence) => {
    if (occurrence.payment) {
      setLedger((current) =>
        unsettleOccurrence(current, occurrence.entry.id, occurrence.date),
      );
      return;
    }
    if (occurrence.skipped) {
      setLedger((current) => unskipOccurrence(current, occurrence.entry.id, occurrence.date));
      return;
    }
    setSettling(occurrence);
  };

  const skipOccurrenceHandler = () => {
    if (!settling) return;
    setLedger((current) => skipOccurrence(current, settling.entry.id, settling.date));
    setSettling(null);
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

  /** A new entry pre-filled from an existing one, dated today rather than
   * copying the original's date — a duplicate is a new thing happening now,
   * not a second record of the same day. */
  const duplicateEntry = () => {
    if (!editor?.entry) return;
    setEditor({ entry: null, draft: { ...draftFrom(editor.entry), dueDate: today } });
  };

  /**
   * Rename and budget change land as one ledger update, in that order — a
   * rename retargets the existing budget row to the new name (see
   * `renameCategory`), so setting or clearing the budget afterwards, under
   * the new name, is what actually lands on the row the person is looking
   * at rather than creating an orphaned one under the name just vacated.
   */
  const saveCategory = (oldName: string, newName: string, limit: number | null) => {
    setLedger((current) => {
      const renamed = newName === oldName ? current : renameCategory(current, oldName, newName);
      if (limit !== null) return setBudget(renamed, newName, limit);
      const existing = budgetFor(renamed.budgets, newName);
      return existing ? removeBudget(renamed, existing.id) : renamed;
    });
  };

  const jumpToSearchResult = (result: SearchResult) => {
    setSearching(false);
    goToMonth(result.month);
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
    setLedger({ entries: [], payments: [], budgets: [], skips: [] });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(ledger.entries, ledger.payments)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cashflow-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const unlock = async (pin: string): Promise<boolean> => {
    const ok = await verifyLock(pin);
    if (ok) setLocked(false);
    return ok;
  };

  const setLockHandler = (pin: string) => {
    void setLock(pin).then(() => setLockEnabled(true));
  };

  const removeLockHandler = () => {
    clearLock();
    setLockEnabled(false);
  };

  /** The lock screen's own "I forgot it" path: the device's copy of the
   * ledger is the price of a forgotten PIN, spelled out to the person before
   * they get here — see `lock.resetWarning`. */
  const resetDeviceForLock = () => {
    clearLock();
    clearLedger();
    setLedger({ entries: [], payments: [], budgets: [], skips: [] });
    setLockEnabled(false);
    setLocked(false);
  };

  const showsMonthNav = tab === "month" || tab === "calendar";

  if (locked) {
    return <LockScreen t={t} onUnlock={unlock} onReset={resetDeviceForLock} />;
  }

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

        <button
          type="button"
          className="icon-button"
          aria-label={t("search.title")}
          onClick={() => setSearching(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
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
              budgets={ledger.budgets}
              onToggle={toggleOccurrence}
              onOpen={openEditorFor}
              onJumpElsewhere={jumpToOccurrenceMonth}
              onSelectMonth={goToMonth}
              onManageCategory={setManagingCategory}
              onOpenYearReview={() => setViewingYear(true)}
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
              onExportCsv={exportCsv}
              onImport={(file) => void importBackup(file)}
              onErase={eraseLocal}
              importMessage={importMessage}
              hasLock={lockEnabled}
              onSetLock={setLockHandler}
              onRemoveLock={removeLockHandler}
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
          // EntrySheet seeds its fields from `draft` only on mount — without
          // this key, duplicating an entry while its own editor is open
          // would swap the draft in but leave every field showing what was
          // being edited a moment ago, since React would see the same
          // element and just re-render it rather than remount it.
          key={editor.entry?.id ?? "new"}
          draft={editor.draft}
          isNew={editor.entry === null}
          categories={knownCategories(ledger)}
          currency={settings.currency}
          language={settings.language}
          t={t}
          instalmentProgress={
            editor.entry ? instalmentProgress(editor.entry, ledger.payments) : null
          }
          onSave={saveEntry}
          onDelete={editor.entry ? removeEntry : undefined}
          onDuplicate={editor.entry ? duplicateEntry : undefined}
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
          onSkip={skipOccurrenceHandler}
          onClose={() => setSettling(null)}
        />
      ) : null}

      {managingCategory !== null ? (
        <CategorySheet
          category={managingCategory}
          budgetLimit={budgetFor(ledger.budgets, managingCategory)?.limit ?? null}
          otherCategories={knownCategories(ledger).filter((name) => name !== managingCategory)}
          currency={settings.currency}
          language={settings.language}
          t={t}
          onSave={(newName, limit) => saveCategory(managingCategory, newName, limit)}
          onClose={() => setManagingCategory(null)}
        />
      ) : null}

      {searching ? (
        <SearchSheet
          entries={ledger.entries}
          currency={settings.currency}
          language={settings.language}
          t={t}
          onJump={jumpToSearchResult}
          onClose={() => setSearching(false)}
        />
      ) : null}

      {viewingYear ? (
        <YearReviewSheet
          review={yearSummary(
            ledger.entries,
            ledger.payments,
            ledger.skips,
            parseMonthKey(month).year,
            today,
          )}
          currency={settings.currency}
          language={settings.language}
          t={t}
          onClose={() => setViewingYear(false)}
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
