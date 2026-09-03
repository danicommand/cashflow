import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language } from "../types.ts";
import type { MonthSpend } from "../services/trend.ts";
import { formatMonthTitle } from "../services/formats.ts";
import { formatAmount, formatMoney } from "../services/money.ts";

interface TrendChartProps {
  history: MonthSpend[];
  currentMonth: string;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onSelect: (month: string) => void;
}

/** The short label under each bar — the month's initial in most locales. */
function shortLabel(month: string, language: Language): string {
  const [year, monthNumber] = month.split("-");
  return new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", {
    month: "short",
  }).format(new Date(Number(year), Number(monthNumber) - 1, 1));
}

/**
 * What was actually paid, month by month, as a small bar chart.
 *
 * The month view already answers "how is this month going"; this answers the
 * next question, "compared to what" — without it, every month is judged in
 * isolation and a person has no way to tell a normal month from an unusually
 * expensive one short of remembering the last several by heart.
 */
export function TrendChart({
  history,
  currentMonth,
  currency,
  language,
  t,
  onSelect,
}: TrendChartProps) {
  const usable = history.filter((point) => point.paidTotal > 0);
  if (usable.length < 2) return null;

  const highest = Math.max(...history.map((point) => point.paidTotal), 1);

  return (
    <section className="list-section" aria-label={t("trend.title")}>
      <header className="list-head">
        <h2>{t("trend.title")}</h2>
      </header>
      <div className="trend">
        {history.map((point) => {
          const isCurrent = point.month === currentMonth;
          const share = point.paidTotal / highest;
          return (
            <button
              key={point.month}
              type="button"
              className={isCurrent ? "trend-col current" : "trend-col"}
              aria-label={`${formatMonthTitle(point.month, language)}: ${formatMoney(point.paidTotal, currency, language)}`}
              onClick={() => onSelect(point.month)}
            >
              <span className="trend-amount">
                {point.paidTotal > 0 ? formatAmount(point.paidTotal, language) : ""}
              </span>
              <span className="trend-track">
                {/* Height carries the real proportion; the grow-in on mount is
                    a separate `transform` animation (see app.css), the same
                    split the category bars below use for the same reason —
                    an inline style and a CSS animation can each own one
                    property without fighting over it. */}
                <span
                  className="trend-fill"
                  style={{ height: `${Math.max(share, point.paidTotal > 0 ? 0.04 : 0) * 100}%` }}
                />
              </span>
              <span className="trend-label">{shortLabel(point.month, language)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
