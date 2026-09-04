import { useMemo, useState } from "react";

import type { Translator } from "../i18n.ts";
import type {
  Budget,
  CurrencyCode,
  DashboardPriority,
  Entry,
  Language,
  Occurrence,
} from "../types.ts";
import { monthBudgets } from "../services/budgets.ts";
import { categoryColorIndex } from "../services/categoryColor.ts";
import { formatMoney } from "../services/money.ts";
import { paidProgress, summarise, totalsByCategory } from "../services/summary.ts";
import type { MonthSpend } from "../services/trend.ts";
import { AnimatedMoney } from "./AnimatedMoney.tsx";
import { OccurrenceRow } from "./OccurrenceRow.tsx";
import { TrendChart } from "./TrendChart.tsx";
import { UpcomingPanel } from "./UpcomingPanel.tsx";

interface MonthViewProps {
  month: string;
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
  /** What was actually paid in each of the last several months, oldest first. */
  history: MonthSpend[];
  budgets: Budget[];
  priority: DashboardPriority;
  onToggle: (occurrence: Occurrence) => void;
  onOpen: (occurrence: Occurrence) => void;
  onDelete: (entry: Entry) => void;
  onJumpElsewhere: (occurrence: Occurrence) => void;
  onSelectMonth: (month: string) => void;
  onManageCategory: (category: string) => void;
  onOpenYearReview: () => void;
}

/**
 * The month at a glance.
 *
 * One number is the headline — what is still to be paid — because that is the
 * question the app exists to answer. Everything else is support: how far
 * through the month the payments are, what is late, and what is coming in.
 */
export function MonthView({
  month,
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
  history,
  budgets,
  priority,
  onToggle,
  onOpen,
  onDelete,
  onJumpElsewhere,
  onSelectMonth,
  onManageCategory,
  onOpenYearReview,
}: MonthViewProps) {
  const [showSettled, setShowSettled] = useState(false);

  const summary = useMemo(() => summarise(occurrences, today), [occurrences, today]);
  const categories = useMemo(() => totalsByCategory(occurrences), [occurrences]);
  const budgetsByCategory = useMemo(() => {
    const map = new Map(monthBudgets(occurrences, budgets).map((b) => [b.category, b]));
    return map;
  }, [occurrences, budgets]);
  const progress = paidProgress(summary);

  const expenses = occurrences.filter((item) => item.entry.kind === "expense");
  const incomes = occurrences.filter((item) => item.entry.kind === "income");
  const openExpenses = expenses.filter((item) => !item.payment && !item.skipped);
  // A skipped bill is settled in the sense that matters to this list: there
  // is nothing left to do about it, so it belongs with what is already paid
  // rather than crowding the list of what is still owed.
  const settledExpenses = expenses.filter((item) => item.payment || item.skipped);

  const money = (cents: number) => formatMoney(cents, currency, language);

  const metrics: {
    id: DashboardPriority;
    label: string;
    value: number;
    tone?: "alert" | "good";
    hint?: string;
  }[] = [
    { id: "leftToPay", label: t("summary.leftToPay"), value: summary.remainingTotal },
    {
      id: "overdue",
      label: t("summary.overdue"),
      value: globalOverdueTotal,
      tone: globalOverdueTotal > 0 ? "alert" : undefined,
    },
    {
      id: "balance",
      label: t("summary.balance"),
      value: balance,
      tone: balance < 0 ? "alert" : "good",
      hint:
        carriedIn !== 0
          ? t("summary.balanceCarried", { amount: money(carriedIn) })
          : t("summary.balanceHint"),
    },
    { id: "dueLater", label: t("summary.dueLater"), value: summary.dueLaterTotal },
    { id: "received", label: t("summary.received"), value: summary.receivedTotal },
  ];
  const heroMetric = metrics.find((metric) => metric.id === priority) ?? metrics[0];
  const overviewMetrics = metrics.filter((metric) => metric.id !== heroMetric.id);

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
        <section className="trend-header">
          <button type="button" className="link-button" onClick={onOpenYearReview}>
            {t("year.link")}
          </button>
        </section>
        <TrendChart
          history={history}
          currentMonth={month}
          currency={currency}
          language={language}
          t={t}
          onSelect={onSelectMonth}
        />
      </div>
    );
  }

  return (
    <div className="month">
      <section className="hero" aria-label={heroMetric.label}>
        <p className="hero-label">{heroMetric.label}</p>
        <p className="hero-figure" data-total-figure>
          <AnimatedMoney
            cents={heroMetric.value}
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

      <section className="stats" aria-label={t("summary.overview")}>
        {overviewMetrics.map((metric) => (
          <div key={metric.id} className={`stat${metric.tone ? ` ${metric.tone}` : ""}`}>
            <span className="stat-label">{metric.label}</span>
            <span className="stat-value">
              <AnimatedMoney cents={metric.value} currency={currency} language={language} />
            </span>
            {metric.hint ? <span className="stat-hint">{metric.hint}</span> : null}
          </div>
        ))}
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
                onDelete={onDelete}
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
                    onDelete={onDelete}
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
                onDelete={onDelete}
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
            {categories.map((bucket) => {
              const cap = bucket.category ? budgetsByCategory.get(bucket.category) : undefined;
              return (
                <li key={bucket.category || "none"} className="bar">
                  <button
                    type="button"
                    className="bar-button"
                    disabled={!bucket.category}
                    onClick={() => onManageCategory(bucket.category)}
                  >
                    <span className="bar-label">
                      {bucket.category || t("categories.uncategorised")}
                    </span>
                    <span className="bar-track">
                      <span
                        className={`cat-${categoryColorIndex(bucket.category)}${cap?.overBudget ? " over" : ""}`}
                        style={{
                          width: `${Math.round((cap ? Math.min(cap.share, 1) : bucket.share) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className={`bar-value${cap?.overBudget ? " alert" : ""}`}>
                      {cap
                        ? t("category.spentOfBudget", {
                            spent: money(bucket.total),
                            limit: money(cap.limit),
                          })
                        : money(bucket.total)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="trend-header">
        <button type="button" className="link-button" onClick={onOpenYearReview}>
          {t("year.link")}
        </button>
      </section>

      <TrendChart
        history={history}
        currentMonth={month}
        currency={currency}
        language={language}
        t={t}
        onSelect={onSelectMonth}
      />
    </div>
  );
}
