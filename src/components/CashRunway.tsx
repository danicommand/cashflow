import { useMemo } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Occurrence } from "../types.ts";
import { cashRunway } from "../services/cashRunway.ts";
import { formatMoney } from "../services/money.ts";

interface CashRunwayProps {
  carriedIn: number;
  occurrences: Occurrence[];
  currency: CurrencyCode;
  language: Language;
  t: Translator;
}

export function CashRunway({ carriedIn, occurrences, currency, language, t }: CashRunwayProps) {
  const runway = useMemo(() => cashRunway(carriedIn, occurrences), [carriedIn, occurrences]);
  if (runway.points.length < 2) return null;

  const balances = runway.points.map((point) => point.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const spread = Math.max(1, max - min);
  const coordinates = runway.points
    .map((point, index) => {
      const x = (index / Math.max(1, runway.points.length - 1)) * 100;
      const y = 42 - ((point.balance - min) / spread) * 34;
      return `${x},${y}`;
    })
    .join(" ");
  const zeroY = 42 - ((0 - min) / spread) * 34;

  return (
    <section className="cash-runway" aria-label={t("runway.title")}>
      <header>
        <div>
          <h2>{t("runway.title")}</h2>
          <p>{t("runway.hint")}</p>
        </div>
        <strong className={runway.lowest < 0 ? "alert" : ""}>
          {t("runway.lowest", {
            amount: formatMoney(runway.lowest, currency, language),
          })}
        </strong>
      </header>
      <svg viewBox="0 0 100 48" role="img" aria-label={t("runway.chartLabel")} preserveAspectRatio="none">
        <line className="runway-zero" x1="0" x2="100" y1={zeroY} y2={zeroY} />
        <polyline className={runway.lowest < 0 ? "alert" : ""} points={coordinates} />
        {runway.points.map((point, index) => {
          const [x, y] = coordinates.split(" ")[index].split(",");
          return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="1.6" />;
        })}
      </svg>
    </section>
  );
}
