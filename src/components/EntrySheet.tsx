import { useState } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, EntryKind, Language, Repeat } from "../types.ts";
import { isIsoDate } from "../services/dates.ts";
import { centsToInput, currencySymbol, formatMoney, parseMoney } from "../services/money.ts";
import type { EntryDraft } from "../services/ledger.ts";
import type { InstalmentProgress } from "../services/instalments.ts";
import { Sheet } from "./Sheet.tsx";

interface EntrySheetProps {
  draft: EntryDraft;
  isNew: boolean;
  categories: string[];
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  /** How far along this entry's instalment plan is — `null` when it is not
   * one (a one-time bill or an open-ended repeat). */
  instalmentProgress?: InstalmentProgress | null;
  onSave: (draft: EntryDraft) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
}

const REPEATS: { value: Repeat; key: "repeat.none" | "repeat.weekly" | "repeat.monthly" | "repeat.yearly" }[] = [
  { value: "none", key: "repeat.none" },
  { value: "monthly", key: "repeat.monthly" },
  { value: "weekly", key: "repeat.weekly" },
  { value: "yearly", key: "repeat.yearly" },
];

/**
 * Add or edit one entry.
 *
 * The amount is held as the raw text the person typed and only parsed on save,
 * so a half-finished `1.2` is never rewritten under the cursor — the single
 * most annoying thing a money field can do.
 */
export function EntrySheet({
  draft,
  isNew,
  categories,
  currency,
  language,
  t,
  instalmentProgress,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: EntrySheetProps) {
  const [kind, setKind] = useState<EntryKind>(draft.kind);
  const [description, setDescription] = useState(draft.description);
  const [amountText, setAmountText] = useState(draft.amount ? centsToInput(draft.amount) : "");
  const [dueDate, setDueDate] = useState(draft.dueDate);
  const [repeat, setRepeat] = useState<Repeat>(draft.repeat);
  const [limited, setLimited] = useState(draft.repeatCount !== null);
  const [repeatCount, setRepeatCount] = useState(String(draft.repeatCount ?? 12));
  const [category, setCategory] = useState(draft.category);
  const [note, setNote] = useState(draft.note);
  const [error, setError] = useState<string | null>(null);

  const title = isNew
    ? kind === "income"
      ? t("form.newIncome")
      : t("form.newExpense")
    : kind === "income"
      ? t("form.editIncome")
      : t("form.editExpense");

  const submit = () => {
    const amount = parseMoney(amountText);
    if (!description.trim()) {
      setError(t("form.errorDescription"));
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t("form.errorAmount"));
      return;
    }
    if (!isIsoDate(dueDate)) {
      setError(t("form.errorDate"));
      return;
    }

    const parsedCount = Number.parseInt(repeatCount, 10);
    onSave({
      kind,
      description,
      amount,
      dueDate,
      repeat,
      repeatCount:
        repeat === "none" || !limited || !Number.isFinite(parsedCount) || parsedCount < 1
          ? null
          : parsedCount,
      category,
      note,
    });
  };

  return (
    <Sheet
      title={title}
      closeLabel={t("action.close")}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <div className="sheet-foot-actions">
              <button type="button" className="button danger-text" onClick={onDelete}>
                {t("action.delete")}
              </button>
              {onDuplicate ? (
                <button type="button" className="button" onClick={onDuplicate}>
                  {t("action.duplicate")}
                </button>
              ) : null}
            </div>
          ) : (
            <span />
          )}
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
        {instalmentProgress ? (
          <p className="field-hint instalment-progress">
            {t("form.instalmentProgress", {
              paid: instalmentProgress.paidCount,
              total: instalmentProgress.totalCount,
              remaining: formatMoney(instalmentProgress.remainingAmount, currency, language),
            })}
          </p>
        ) : null}

        <div className="segmented" role="group" aria-label={t("form.kind")}>
          <button
            type="button"
            className={kind === "expense" ? "segment active" : "segment"}
            aria-pressed={kind === "expense"}
            onClick={() => setKind("expense")}
          >
            {t("form.expense")}
          </button>
          <button
            type="button"
            className={kind === "income" ? "segment active" : "segment"}
            aria-pressed={kind === "income"}
            onClick={() => setKind("income")}
          >
            {t("form.income")}
          </button>
        </div>

        <label className="field amount-field">
          <span className="field-label">{t("form.amount")}</span>
          <div className="amount-input">
            <span className="amount-symbol">{currencySymbol(currency, language)}</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              placeholder="0.00"
              onChange={(event) => setAmountText(event.target.value)}
            />
          </div>
        </label>

        <label className="field">
          <span className="field-label">{t("form.description")}</span>
          <input
            type="text"
            value={description}
            placeholder={t("form.descriptionPlaceholder")}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">
              {kind === "income" ? t("form.receiveDate") : t("form.dueDate")}
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">{t("form.repeat")}</span>
            <select
              value={repeat}
              onChange={(event) => setRepeat(event.target.value as Repeat)}
            >
              {REPEATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.key)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {repeat !== "none" ? (
          <div className="field-row repeat-limit">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!limited}
                onChange={(event) => setLimited(!event.target.checked)}
              />
              <span>{t("form.repeatForever")}</span>
            </label>
            {limited ? (
              <label className="field compact">
                <span className="field-label">{t("form.repeatCount")}</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={repeatCount}
                  onChange={(event) => setRepeatCount(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("form.category")}</span>
            <input
              type="text"
              list="cashflow-categories"
              value={category}
              placeholder={t("form.categoryPlaceholder")}
              onChange={(event) => setCategory(event.target.value)}
            />
            <datalist id="cashflow-categories">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="field-label">{t("form.note")}</span>
            <input
              type="text"
              value={note}
              placeholder={t("form.notePlaceholder")}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {/* Enter submits the form on a phone keyboard, where the footer
            buttons may sit under the keyboard itself. */}
        <button type="submit" className="visually-hidden">
          {t("action.save")}
        </button>
      </form>
    </Sheet>
  );
}
