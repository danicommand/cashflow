import { useMemo, useState } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Occurrence } from "../types.ts";
import { formatMoney } from "../services/money.ts";
import { paidProgress, summarise, totalsByCategory } from "../services/summary.ts";
import { AnimatedMoney } from "./AnimatedMoney.tsx";
import { OccurrenceRow } from "./OccurrenceRow.tsx";
import { UpcomingPanel } from "./UpcomingPanel.tsx";

interface MonthViewProps {
  occurrences: Occurrence[];
  today: string;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  /** Milliseconds the total holds before rolling, so it catches an arrival. */
  catchDelay: number;
  /** The running cash balance through the end of this month, all months included. */
  balance: number;
  /** The slice of `balance` carried in from before this month started. */
  carriedIn: number;
  /** Every bill overdue anywhere, not only the ones due within this month —
   * see the note on the stat tile below for why this one figure is global
   * while its neighbours stay scoped to the displayed month. */
  globalOverdueTotal: number;
  /** Overdue and soon-due bills that belong to some other month. */
  elsewhere: Occurrence[];
  onToggle: (occurrence: Occurrence) => void;
  onOpen: (occurrence: Occurrence) => void;
  onJumpElsewhere: (occurrence: Occurrence) => void;
}

/**
 * The month at a glance.
 *
 * One number is the headline — what is still to be paid — because that is the
 * question the app exists to answer. Everything else is support: how far
 * through the month the payments are, what is late, and what is coming in.
 */
export function MonthView({
  occurrences,
  today,
  currency,
  language,
  t,
  catchDelay,
  balance,
  carriedIn,
  globalOverdueTotal,
  elsewhere,
  onToggle,
  onOpen,
  onJumpElsewhere,
}: MonthViewProps) {
  const [showSettled, setShowSettled] = useState(false);

  const summary = useMemo(() => summarise(occurrences, today), [occurrences, today]);
  const categories = useMemo(() => totalsByCategory(occurrences), [occurrences]);
  const progress = paidProgress(summary);

  const expenses = occurrences.filter((item) => item.entry.kind === "expense");
  const incomes = occurrences.filter((item) => item.entry.kind === "income");
  const openExpenses = expenses.filter((item) => !item.payment);
  const settledExpenses = expenses.filter((item) => item.payment);

  const money = (cents: number) => formatMoney(cents, currency, language);

  if (occurrences.length === 0) {
    return (
      <div className="month">
        <div className="empty">
          <p className="empty-title">{t("summary.empty")}</p>
          <p className="empty-hint">{t("summary.emptyHint")}</p>
          {/* A month with nothing scheduled can still be sitting on money from
              an earlier one — that balance should not vanish just because this
              month has no bills of its own. */}
          {balance !== 0 ? (
            <p className={`empty-balance${balance < 0 ? " alert" : ""}`}>
              {t("summary.emptyBalance", { amount: money(balance) })}
            </p>
          ) : null}
        </div>
        {/* An empty month is exactly when an overdue bill elsewhere is easiest
            to forget — there is nothing else on screen to compete with it. */}
        <UpcomingPanel
          items={elsewhere}
          today={today}
          currency={currency}
          language={language}
          t={t}
          onJump={onJumpElsewhere}
        />
      </div>
    );
  }

  return (
    <div className="month">
      <section className="hero" aria-label={t("summary.leftToPay")}>
        <p className="hero-label">{t("summary.leftToPay")}</p>
        <p className="hero-figure" data-total-figure>
          <AnimatedMoney
            cents={summary.remainingTotal}
            currency={currency}
            language={language}
            delay={catchDelay}
          />
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          {/* The bar is scaled rather than resized: animating width lays the
              page out again on every frame, and a bar this thin has no reason
              to. The sheen is a separate element keyed on the value, so it
              replays on each advance while the fill keeps its identity and its
              transition. */}
          <span className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
          <span
            key={Math.round(progress * 1000)}
            className="progress-sheen"
            style={{ width: `${Math.round(progress * 100)}%` }}
            aria-hidden="true"
          />
        </div>
        <p className="hero-sub" key={summary.remainingTotal === 0 ? "done" : "owing"}>
          {summary.remainingTotal === 0 && summary.expenseTotal > 0
            ? t("summary.allPaid")
            : t("summary.paidOf", {
                paid: money(summary.paidTotal),
                total: money(summary.expenseTotal),
              })}
        </p>
      </section>

      {/* The two figures that are true no matter which month is on screen —
          what is overdue, what the balance actually is — sit together on the
          left; the two that are specific to this month's plan sit together on
          the right. Grouping them this way is what keeps "Overdue: $0" here
          from reading as a contradiction of the panel above: it and the panel
          are answering the same question, this month's own total is not. */}
      <section className="stats" aria-label={t("summary.balance")}>
        <div className={`stat${globalOverdueTotal > 0 ? " alert" : ""}`}>
          <span className="stat-label">{t("summary.overdue")}</span>
          <span className="stat-value">{money(globalOverdueTotal)}</span>
        </div>
        <div className={`stat${balance < 0 ? " alert" : " good"}`}>
          <span className="stat-label">{t("summary.balance")}</span>
          <span className="stat-value">{money(balance)}</span>
          <span className="stat-hint">
            {carriedIn !== 0
              ? t("summary.balanceCarried", { amount: money(carriedIn) })
              : t("summary.balanceHint")}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">{t("summary.dueLater")}</span>
          <span className="stat-value">{money(summary.dueLaterTotal)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t("summary.received")}</span>
          <span className="stat-value">{money(summary.receivedTotal)}</span>
        </div>
      </section>

      <UpcomingPanel
        items={elsewhere}
        today={today}
        currency={currency}
        language={language}
        t={t}
        onJump={onJumpElsewhere}
      />

      {expenses.length > 0 ? (
        <section className="list-section">
          <header className="list-head">
            <h2>{t("list.expenses")}</h2>
            {settledExpenses.length > 0 ? (
              <button
                type="button"
                className="link-button"
                onClick={() => setShowSettled((current) => !current)}
              >
                {showSettled ? t("list.hidePaid") : t("list.showPaid")}
              </button>
            ) : null}
          </header>
          <ul className="rows">
            {openExpenses.map((occurrence) => (
              <OccurrenceRow
                key={occurrence.key}
                occurrence={occurrence}
                today={today}
                currency={currency}
                language={language}
                t={t}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
            {showSettled
              ? settledExpenses.map((occurrence) => (
                  <OccurrenceRow
                    key={occurrence.key}
                    occurrence={occurrence}
                    today={today}
                    currency={currency}
                    language={language}
                    t={t}
                    onToggle={onToggle}
                    onOpen={onOpen}
                  />
                ))
              : null}
          </ul>
          {openExpenses.length === 0 && !showSettled ? (
            <p className="list-empty">{t("summary.allPaid")}</p>
          ) : null}
        </section>
      ) : null}

      {incomes.length > 0 ? (
        <section className="list-section">
          <header className="list-head">
            <h2>{t("list.income")}</h2>
            <span className="list-total">
              {t("summary.expected")} {money(summary.incomeTotal)}
            </span>
          </header>
          <ul className="rows">
            {incomes.map((occurrence) => (
              <OccurrenceRow
                key={occurrence.key}
                occurrence={occurrence}
                today={today}
                currency={currency}
                language={language}
                t={t}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {categories.length > 1 ? (
        <section className="list-section">
          <header className="list-head">
            <h2>{t("categories.title")}</h2>
          </header>
          <ul className="bars">
            {categories.map((bucket) => (
              <li key={bucket.category || "none"} className="bar">
                <span className="bar-label">
                  {bucket.category || t("categories.uncategorised")}
                </span>
                <span className="bar-track">
                  <span style={{ width: `${Math.round(bucket.share * 100)}%` }} />
                </span>
                <span className="bar-value">{money(bucket.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
