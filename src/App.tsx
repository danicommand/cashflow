import { useCallback, useEffect, useMemo, useState } from "react";

import { CalendarView } from "./components/CalendarView.tsx";
import { EntrySheet } from "./components/EntrySheet.tsx";
import { MonthView } from "./components/MonthView.tsx";
import { SettingsView } from "./components/SettingsView.tsx";
import { SettleSheet } from "./components/SettleSheet.tsx";
import { useSync } from "./hooks/useSync.ts";
import { FLIGHT_CATCH_MS, flyToTotal, measureOccurrenceAmount } from "./motion/flight.ts";
import { translatorFor } from "./i18n.ts";
import type { Entry, Ledger, Occurrence, Settings } from "./types.ts";
import { currentMonthKey, firstDayOfMonth, shiftMonthKey, todayIso } from "./services/dates.ts";
import { formatMonthTitle } from "./services/formats.ts";
import {
  addEntry,
  blankDraft,
  deleteEntry,
  draftFrom,
  knownCategories,
  settleOccurrence,
  unsettleOccurrence,
  updateEntry,
  type EntryDraft,
} from "./services/ledger.ts";
import { mergeLedgers } from "./services/merge.ts";
import { occurrencesInMonth } from "./services/occurrences.ts";
import {
  buildBackup,
  clearLedger,
  loadLedger,
  loadSettings,
  readBackup,
  saveLedger,
  saveSettings,
} from "./services/storage.ts";

type Tab = "month" | "calendar" | "settings";

interface EditorState {
  entry: Entry | null;
  draft: EntryDraft;
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

  const openEditorForNew = () => {
    // A bill added while looking at March is almost certainly a March bill.
    const start = month === currentMonthKey() ? today : firstDayOfMonth(month);
    setEditor({ entry: null, draft: blankDraft("expense", start) });
  };

  const openEditorFor = (occurrence: Occurrence) => {
    setEditor({ entry: occurrence.entry, draft: draftFrom(occurrence.entry) });
  };

  const stepMonth = (step: number) => {
    setMonthStep(step > 0 ? "forward" : "back");
    setMonth((current) => shiftMonthKey(current, step));
  };

  const goToThisMonth = () => {
    const target = currentMonthKey();
    setMonthStep(target > month ? "forward" : "back");
    setMonth(target);
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

  const removeEntry = () => {
    if (!editor?.entry) return;
    if (!window.confirm(t("form.deleteConfirm"))) return;
    const id = editor.entry.id;
    setLedger((current) => deleteEntry(current, id));
    setEditor(null);
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
            occurrences={occurrences}
            today={today}
            currency={settings.currency}
            language={settings.language}
            t={t}
            catchDelay={catchDelay}
            onToggle={toggleOccurrence}
            onOpen={openEditorFor}
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
          className="fab"
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
    </div>
  );
}
