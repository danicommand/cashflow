import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Occurrence } from "../types.ts";
import { describeDueDate, formatDate } from "../services/formats.ts";
import { formatMoney } from "../services/money.ts";

interface UpcomingPanelProps {
  /** Overdue and soon-due bills that belong to a month other than the one on
   * screen — the caller has already excluded the current month, so nothing
   * here duplicates what the list below already shows. */
  items: Occurrence[];
  today: string;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onJump: (occurrence: Occurrence) => void;
}

/**
 * Bills that matter right now but are not on this screen.
 *
 * The month view answers "what does September owe", which is the wrong
 * question the moment a bill from August is still unpaid, or one two weeks
 * into October is close enough to plan for. Without this, either fact is
 * invisible unless you happen to click through to that exact month.
 *
 * It never offers to settle from here. A bill's row lives in its own month,
 * with its own "left to pay" total right above it — ticking it off from a
 * summary list elsewhere would change a number the person is not looking at.
 * This panel's only job is to say "look over there" and take you there in one
 * tap.
 */
export function UpcomingPanel({ items, today, currency, language, t, onJump }: UpcomingPanelProps) {
  if (items.length === 0) return null;

  return (
    <section className="list-section upcoming" aria-label={t("elsewhere.title")}>
      <header className="list-head">
        <h2>{t("elsewhere.title")}</h2>
      </header>
      <ul className="rows">
        {items.map((occurrence) => {
          const overdue = occurrence.date < today;
          return (
            <li key={occurrence.key} className={overdue ? "row overdue" : "row"}>
              <button
                type="button"
                className="row-main upcoming-row"
                onClick={() => onJump(occurrence)}
              >
                <i className={overdue ? "mark due" : "mark"} aria-hidden="true" />
                <span className="row-body">
                  <span className="row-title">{occurrence.entry.description}</span>
                  <span className="row-meta">
                    <span className={overdue ? "meta-late" : undefined}>
                      {describeDueDate(occurrence.date, today, t)}
                    </span>
                    <span className="chip subtle">{formatDate(occurrence.date, language)}</span>
                  </span>
                </span>
                <span className="row-amount">{formatMoney(occurrence.amount, currency, language)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
