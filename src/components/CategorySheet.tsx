import { useState } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language } from "../types.ts";
import { centsToInput, currencySymbol, parseMoney } from "../services/money.ts";
import { Sheet } from "./Sheet.tsx";

interface CategorySheetProps {
  category: string;
  /** Cents, or `null` when this category has no budget yet. */
  budgetLimit: number | null;
  otherCategories: string[];
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  /**
   * One call for both changes, name and budget together — not a rename
   * callback plus a separate set-budget callback. A budget belongs to a
   * category *name*; if the name is changing in the same save, a budget
   * call keyed to the name being left behind would set a budget on a
   * category nothing points to any more, orphaned the moment it lands.
   * Sequencing that correctly is the caller's job, but it can only get it
   * right if it hears about both changes as one fact.
   */
  onSave: (newName: string, limit: number | null) => void;
  onClose: () => void;
}

/**
 * Managing one category: what it is called, and what it is allowed to cost.
 *
 * The two live in one sheet because they are the same action from a
 * person's point of view — "this is how I want Food to work" — even though
 * they touch different parts of the ledger (every entry tagged with the old
 * name, versus one budget row).
 */
export function CategorySheet({
  category,
  budgetLimit,
  otherCategories,
  currency,
  language,
  t,
  onSave,
  onClose,
}: CategorySheetProps) {
  const [name, setName] = useState(category);
  const [limitText, setLimitText] = useState(budgetLimit ? centsToInput(budgetLimit) : "");
  const [error, setError] = useState<string | null>(null);

  const willMerge = name.trim() !== category && otherCategories.includes(name.trim());

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("form.errorDescription"));
      return;
    }

    const limit = parseMoney(limitText);
    const hasLimit = limitText.trim() && limit !== null && limit > 0;
    onSave(trimmedName, hasLimit ? limit : null);
    onClose();
  };

  return (
    <Sheet
      title={t("category.manage")}
      closeLabel={t("action.close")}
      onClose={onClose}
      footer={
        <>
          <span />
          <div className="sheet-foot-actions">
            <button type="button" className="button" onClick={onClose}>
              {t("action.cancel")}
            </button>
            <button type="button" className="button primary" onClick={save}>
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
          save();
        }}
      >
        <label className="field">
          <span className="field-label">{t("category.name")}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        {willMerge ? <p className="field-hint">{t("category.mergeHint", { name })}</p> : null}

        <label className="field amount-field">
          <span className="field-label">{t("category.budget")}</span>
          <div className="amount-input">
            <span className="amount-symbol">{currencySymbol(currency, language)}</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={limitText}
              placeholder={t("category.noBudget")}
              onChange={(event) => setLimitText(event.target.value)}
            />
          </div>
        </label>
        <p className="field-hint">{t("category.budgetHint")}</p>

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
