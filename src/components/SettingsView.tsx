import { useRef, useState } from "react";

import { LANGUAGES, type Translator } from "../i18n.ts";
import {
  DASHBOARD_PRIORITIES,
  type CurrencyCode,
  type DashboardPriority,
  type Language,
  type Settings,
  type ThemePreference,
} from "../types.ts";
import { CURRENCIES, currencySymbol } from "../services/money.ts";
import { formatTime } from "../services/formats.ts";
import { generateSyncCode, isUsableCode } from "../services/syncClient.ts";
import { MIN_PIN_LENGTH } from "../services/lock.ts";
import type { SyncStatus } from "../hooks/useSync.ts";

interface SettingsViewProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  counts: { entries: number; payments: number };
  sync: SyncStatus;
  onSyncNow: () => void;
  onExport: () => void;
  onExportCsv: () => void;
  onImport: (file: File) => void;
  onErase: () => void;
  importMessage: string | null;
  hasLock: boolean;
  onSetLock: (pin: string) => void;
  onRemoveLock: () => void;
  t: Translator;
}

const THEMES: { value: ThemePreference; key: "theme.system" | "theme.light" | "theme.dark" }[] = [
  { value: "system", key: "theme.system" },
  { value: "light", key: "theme.light" },
  { value: "dark", key: "theme.dark" },
];

const PRIORITY_LABELS: Record<DashboardPriority, Parameters<Translator>[0]> = {
  leftToPay: "summary.leftToPay",
  balance: "summary.balance",
  overdue: "summary.overdue",
  dueLater: "summary.dueLater",
  received: "summary.received",
};

export function SettingsView({
  settings,
  onChange,
  counts,
  sync,
  onSyncNow,
  onExport,
  onExportCsv,
  onImport,
  onErase,
  importMessage,
  hasLock,
  onSetLock,
  onRemoveLock,
  t,
}: SettingsViewProps) {
  const [code, setCode] = useState(settings.syncCode);
  const fileInput = useRef<HTMLInputElement>(null);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);

  const codeReady = isUsableCode(code);
  const connected = settings.syncCode.length > 0;

  const submitPin = () => {
    if (newPin.length < MIN_PIN_LENGTH) {
      setLockError(t("settings.lockTooShort"));
      return;
    }
    if (newPin !== confirmPin) {
      setLockError(t("settings.lockMismatch"));
      return;
    }
    onSetLock(newPin);
    setNewPin("");
    setConfirmPin("");
    setLockError(null);
  };

  return (
    <div className="settings">
      <section className="panel">
        <h2>{t("settings.appearance")}</h2>

        <label className="field">
          <span className="field-label">{t("settings.language")}</span>
          <select
            value={settings.language}
            onChange={(event) =>
              onChange({ ...settings, language: event.target.value as Language })
            }
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">{t("settings.currency")}</span>
          <select
            value={settings.currency}
            onChange={(event) =>
              onChange({ ...settings, currency: event.target.value as CurrencyCode })
            }
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency} · {currencySymbol(currency, settings.language)}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field-label">{t("settings.theme")}</span>
          <div className="segmented" role="group" aria-label={t("settings.theme")}>
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                className={settings.theme === theme.value ? "segment active" : "segment"}
                aria-pressed={settings.theme === theme.value}
                onClick={() => onChange({ ...settings, theme: theme.value })}
              >
                {t(theme.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="dashboard-priority">
            {t("settings.dashboardPriority")}
          </label>
          <select
            id="dashboard-priority"
            aria-describedby="dashboard-priority-hint"
            value={settings.dashboardPriority}
            onChange={(event) =>
              onChange({
                ...settings,
                dashboardPriority: event.target.value as DashboardPriority,
              })
            }
          >
            {DASHBOARD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(PRIORITY_LABELS[priority])}
              </option>
            ))}
          </select>
          <span className="field-hint" id="dashboard-priority-hint">
            {t("settings.dashboardPriorityHint")}
          </span>
        </div>
      </section>

      <section className="panel">
        <h2>{t("settings.sync")}</h2>
        <p className="panel-hint">{t("settings.syncHelp")}</p>

        <label className="field">
          <span className="field-label">{t("settings.syncCode")}</span>
          <div className="inline-field">
            <input
              type="text"
              value={code}
              spellCheck={false}
              autoComplete="off"
              placeholder={t("settings.syncCodePlaceholder")}
              onChange={(event) => setCode(event.target.value)}
            />
            <button
              type="button"
              className="button"
              onClick={() => setCode(generateSyncCode())}
            >
              {t("settings.generate")}
            </button>
          </div>
        </label>

        {code.length > 0 && !codeReady ? (
          <p className="field-hint warn">{t("settings.syncTooShort")}</p>
        ) : null}

        <div className="button-row">
          <button
            type="button"
            className="button primary"
            disabled={!codeReady || sync.state === "syncing"}
            onClick={() => {
              onChange({ ...settings, syncCode: code.trim() });
              onSyncNow();
            }}
          >
            {sync.state === "syncing" ? t("settings.syncing") : t("settings.syncNow")}
          </button>
          {connected ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                setCode("");
                onChange({ ...settings, syncCode: "" });
              }}
            >
              {t("settings.syncOff")}
            </button>
          ) : null}
        </div>

        <p className={`field-hint${sync.state === "error" ? " warn" : ""}`}>
          {sync.state === "error"
            ? t("settings.syncFailed")
            : sync.lastSyncedAt
              ? t("settings.syncedAt", {
                  time: formatTime(sync.lastSyncedAt, settings.language),
                })
              : t("settings.syncNever")}
        </p>
      </section>

      <section className="panel">
        <h2>{t("settings.data")}</h2>
        <p className="panel-hint">
          {t("settings.dataHint", { entries: counts.entries, payments: counts.payments })}
        </p>

        <div className="button-row">
          <button type="button" className="button" onClick={onExport}>
            {t("settings.export")}
          </button>
          <button type="button" className="button" onClick={onExportCsv}>
            {t("settings.exportCsv")}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => fileInput.current?.click()}
          >
            {t("settings.import")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              // Clearing lets the same file be picked twice in a row.
              event.target.value = "";
            }}
          />
        </div>

        {importMessage ? <p className="field-hint">{importMessage}</p> : null}

        <div className="button-row">
          <button
            type="button"
            className="button danger-text"
            onClick={() => {
              if (window.confirm(t("settings.eraseConfirm"))) onErase();
            }}
          >
            {t("settings.erase")}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{t("settings.lock")}</h2>
        <p className="panel-hint">{t("settings.lockHelp")}</p>

        {hasLock ? (
          <div className="button-row">
            <button type="button" className="button danger-text" onClick={onRemoveLock}>
              {t("settings.lockRemove")}
            </button>
          </div>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span className="field-label">
              {hasLock ? t("settings.lockNewPin") : t("settings.lockPin")}
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={newPin}
              placeholder={t("settings.lockPinPlaceholder")}
              onChange={(event) => {
                setNewPin(event.target.value);
                setLockError(null);
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("settings.lockConfirmPin")}</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirmPin}
              onChange={(event) => {
                setConfirmPin(event.target.value);
                setLockError(null);
              }}
            />
          </label>
        </div>

        {lockError ? <p className="field-hint warn">{lockError}</p> : null}

        <div className="button-row">
          <button
            type="button"
            className="button primary"
            disabled={!newPin || !confirmPin}
            onClick={submitPin}
          >
            {hasLock ? t("settings.lockChange") : t("settings.lockSet")}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{t("settings.about")}</h2>
        <p className="panel-hint">{t("settings.aboutText")}</p>
        <p className="panel-hint">{t("settings.shortcuts")}</p>
      </section>
    </div>
  );
}
