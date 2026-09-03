import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language } from "../types.ts";
import { formatMoney } from "../services/money.ts";
import type { YearReview } from "../services/yearReview.ts";
import { Sheet } from "./Sheet.tsx";

interface YearReviewSheetProps {
  review: YearReview;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onClose: () => void;
}

/** Short month initials, in the given language, January first. */
function monthLabels(language: Language): string[] {
  const formatter = new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", {
    month: "narrow",
  });
  return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(2024, index, 1)));
}

/**
 * The whole year, at a glance — the trend chart's own idea taken to twelve
 * months instead of six, since a year is the scale a person actually
 * measures a habit against.
 */
export function YearReviewSheet({ review, currency, language, t, onClose }: YearReviewSheetProps) {
  const money = (cents: number) => formatMoney(cents, currency, language);
  const highest = Math.max(...review.monthlyPaid, 1);
  const labels = monthLabels(language);

  return (
    <Sheet title={t("year.title", { year: review.year })} closeLabel={t("action.close")} onClose={onClose}>
      <div className="year-review">
        <div className="year-stats">
          <div className="year-stat">
            <span className="stat-label">{t("year.paid")}</span>
            <span className="stat-value">{money(review.paidTotal)}</span>
          </div>
          <div className="year-stat">
            <span className="stat-label">{t("year.received")}</span>
            <span className="stat-value">{money(review.receivedTotal)}</span>
          </div>
          <div className={`year-stat${review.net < 0 ? " alert" : " good"}`}>
            <span className="stat-label">{t("summary.balance")}</span>
            <span className="stat-value">{money(review.net)}</span>
          </div>
        </div>

        {review.topCategory ? (
          <p className="field-hint">
            {t("year.topCategory", {
              category: review.topCategory.category,
              amount: money(review.topCategory.total),
            })}
          </p>
        ) : null}

        <div className="trend year-months">
          {review.monthlyPaid.map((amount, index) => (
            <div key={index} className="trend-col">
              <span className="trend-amount" />
              <span className="trend-track">
                <span
                  className="trend-fill"
                  style={{ height: `${Math.max((amount / highest) * 100, amount > 0 ? 4 : 0)}%` }}
                />
              </span>
              <span className="trend-label">{labels[index]}</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
