import { useMemo, useState } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Occurrence } from "../types.ts";
import { cashRunway } from "../services/cashRunway.ts";
import { formatDate } from "../services/formats.ts";
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
  const [activeIndex, setActiveIndex] = useState(0);
  if (runway.points.length < 2) return null;

  const balances = runway.points.map((point) => point.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const spread = Math.max(1, max - min);
  const plottedPoints = runway.points
    .map((point, index) => {
      const x = (index / Math.max(1, runway.points.length - 1)) * 100;
      const y = 42 - ((point.balance - min) / spread) * 34;
      return { ...point, x, y };
    });
  const coordinates = plottedPoints.map(({ x, y }) => `${x},${y}`).join(" ");
  const zeroY = 42 - ((0 - min) / spread) * 34;
  const active = plottedPoints[Math.min(activeIndex, plottedPoints.length - 1)];
  const activeDate = active.date === "start" ? t("runway.start") : formatDate(active.date, language);

  const selectFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActiveIndex(Math.round(ratio * (plottedPoints.length - 1)));
  };

  const moveWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setActiveIndex((current) => Math.max(0, Math.min(plottedPoints.length - 1, current + direction)));
  };

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
      <div
        className="runway-chart"
        role="application"
        aria-label={t("runway.chartLabel")}
        tabIndex={0}
        onPointerMove={selectFromPointer}
        onPointerDown={selectFromPointer}
        onKeyDown={moveWithKeyboard}
      >
        <svg viewBox="0 0 100 48" aria-hidden="true" preserveAspectRatio="none">
          <line className="runway-zero" x1="0" x2="100" y1={zeroY} y2={zeroY} />
          <polyline className={runway.lowest < 0 ? "alert" : ""} points={coordinates} />
          <line className="runway-crosshair" x1={active.x} x2={active.x} y1="4" y2="44" />
          <line className="runway-crosshair" x1="0" x2="100" y1={active.y} y2={active.y} />
          {plottedPoints.map((point, index) => (
            <circle
              key={`${point.date}-${index}`}
              className={index === activeIndex ? "active" : ""}
              cx={point.x}
              cy={point.y}
              r={index === activeIndex ? "2.4" : "1.6"}
            />
          ))}
        </svg>
        <div
          className="runway-tooltip"
          style={{
            left: `${active.x}%`,
            transform: `translateX(${active.x < 10 ? "0" : active.x > 90 ? "-100%" : "-50%"})`,
          }}
          role="status"
          aria-live="polite"
        >
          <span>{activeDate}</span>
          <strong className={active.balance < 0 ? "alert" : ""}>
            {formatMoney(active.balance, currency, language)}
          </strong>
        </div>
      </div>
    </section>
  );
}
