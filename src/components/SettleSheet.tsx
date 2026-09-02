import { useState } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Occurrence } from "../types.ts";
import { isIsoDate } from "../services/dates.ts";
import { centsToInput, currencySymbol, formatMoney, parseMoney } from "../services/money.ts";
import { Sheet } from "./Sheet.tsx";

interface SettleSheetProps {
  occurrence: Occurrence;
  today: string;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onConfirm: (amount: number, paidOn: string) => void;
  onClose: () => void;
}

/**
 * Recording a payment.
 *
 * Both fields arrive filled in with the answer that is right most of the time
 * — the full amount, paid today — so the common case is one tap on Save. The
 * fields are still there and still editable, because the bill that was 1200
 * and got paid as 1180 is exactly the case a fixed checkbox gets wrong.
 */
export function SettleSheet({
  occurrence,
  today,
  currency,
  language,
  t,
  onConfirm,
  onClose,
}: SettleSheetProps) {
  const isIncome = occurrence.entry.kind === "income";
  const [amountText, setAmountText] = useState(
    centsToInput(occurrence.payment?.amount ?? occurrence.amount),
  );
  const [paidOn, setPaidOn] = useState(occurrence.payment?.paidOn ?? today);
  const [error, setError] = useState<string | null>(null);

  const amount = parseMoney(amountText);
  const differs = amount !== null && amount !== occurrence.amount;

  const submit = () => {
    if (amount === null || amount <= 0) {
      setError(t("form.errorAmount"));
      return;
    }
    if (!isIsoDate(paidOn)) {
      setError(t("form.errorDate"));
      return;
    }
    onConfirm(amount, paidOn);
  };

  return (
    <Sheet
      title={isIncome ? t("pay.titleIncome") : t("pay.titleExpense")}
      closeLabel={t("action.close")}
      onClose={onClose}
      footer={
        <>
          <span />
          <div className="sheet-foot-actions">
            <button type="button" className="button" onClick={onClose}>
              {t("action.cancel")}
            </button>
            <button type="button" className="button primary" onClick={submit}>
              {t("action.save")}
            </button>
          </div>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="settle-subject">{occurrence.entry.description}</p>

        <label className="field amount-field">
          <span className="field-label">
            {isIncome ? t("pay.amountIncome") : t("pay.amountExpense")}
          </span>
          <div className="amount-input">
            <span className="amount-symbol">{currencySymbol(currency, language)}</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
            />
          </div>
        </label>

        {differs ? (
          <p className="field-hint">
            {t("pay.differs", {
              amount: formatMoney(occurrence.amount, currency, language),
            })}
          </p>
        ) : null}

        <label className="field">
          <span className="field-label">{t("pay.date")}</span>
          <input
            type="date"
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </label>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="visually-hidden">
          {t("action.save")}
        </button>
      </form>
    </Sheet>
  );
}
