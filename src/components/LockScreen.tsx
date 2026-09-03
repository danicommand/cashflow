import { useState } from "react";

import type { Translator } from "../i18n.ts";

interface LockScreenProps {
  t: Translator;
  onUnlock: (pin: string) => Promise<boolean>;
  onReset: () => void;
}

/**
 * Stands fully in front of the app when a PIN is set, until it is entered
 * correctly.
 *
 * There is no "forgot PIN, email me a reset" — this app has no accounts and
 * no server that could verify who is asking. The one way back in is to
 * erase the device's copy of the ledger, spelled out here rather than
 * hidden behind a vague link, since it is the same weight as the "Erase
 * everything" action in Settings.
 */
export function LockScreen({ t, onUnlock, onReset }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const submit = async () => {
    const ok = await onUnlock(pin);
    if (!ok) {
      setError(true);
      setPin("");
      return;
    }
    setError(false);
  };

  return (
    <div className="lock-screen">
      <div className={error ? "lock-card shake" : "lock-card"}>
        <span className="brand-mark" aria-hidden="true" />
        <h1>{t("lock.title")}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            className="lock-input"
            value={pin}
            placeholder={t("lock.placeholder")}
            onChange={(event) => {
              setPin(event.target.value);
              setError(false);
            }}
          />
          {error ? (
            <p className="form-error" role="alert">
              {t("lock.wrong")}
            </p>
          ) : null}
          <button type="submit" className="button primary lock-submit" disabled={!pin}>
            {t("lock.unlock")}
          </button>
        </form>

        {confirmingReset ? (
          <div className="lock-reset-confirm">
            <p className="field-hint warn">{t("lock.resetWarning")}</p>
            <div className="button-row">
              <button type="button" className="button" onClick={() => setConfirmingReset(false)}>
                {t("action.cancel")}
              </button>
              <button type="button" className="button danger-text" onClick={onReset}>
                {t("lock.resetConfirmButton")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="link-button lock-forgot"
            onClick={() => setConfirmingReset(true)}
          >
            {t("lock.forgot")}
          </button>
        )}
      </div>
    </div>
  );
}
