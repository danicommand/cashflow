import { useRef, useState } from "react";

import { LANGUAGES, type Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Settings, ThemePreference } from "../types.ts";
import { CURRENCIES, currencySymbol } from "../services/money.ts";
import { formatTime } from "../services/formats.ts";
import { generateSyncCode, isUsableCode } from "../services/syncClient.ts";
import type { SyncStatus } from "../hooks/useSync.ts";

interface SettingsViewProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  counts: { entries: number; payments: number };
  sync: SyncStatus;
  onSyncNow: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onErase: () => void;
  importMessage: string | null;
  t: Translator;
}

const THEMES: { value: ThemePreference; key: "theme.system" | "theme.light" | "theme.dark" }[] = [
  { value: "system", key: "theme.system" },
  { value: "light", key: "theme.light" },
  { value: "dark", key: "theme.dark" },
];

export function SettingsView({
  settings,
  onChange,
  counts,
  sync,
  onSyncNow,
  onExport,
  onImport,
  onErase,
  importMessage,
  t,
}: SettingsViewProps) {
  const [code, setCode] = useState(settings.syncCode);
  const fileInput = useRef<HTMLInputElement>(null);

  const codeReady = isUsableCode(code);
  const connected = settings.syncCode.length > 0;

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
        <h2>{t("settings.about")}</h2>
        <p className="panel-hint">{t("settings.aboutText")}</p>
      </section>
    </div>
  );
}
