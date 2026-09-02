import { useMemo, useState, type CSSProperties } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Language, Occurrence } from "../types.ts";
import {
  daysInMonth,
  firstDayOfMonth,
  monthKey,
  parseMonthKey,
  toIso,
  weekdayOf,
} from "../services/dates.ts";
import { formatFullDate, weekdayInitials } from "../services/formats.ts";
import { formatAmount } from "../services/money.ts";
import { totalsByDay } from "../services/summary.ts";
import { OccurrenceRow } from "./OccurrenceRow.tsx";

interface CalendarViewProps {
  month: string;
  occurrences: Occurrence[];
  today: string;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onToggle: (occurrence: Occurrence) => void;
  onOpen: (occurrence: Occurrence) => void;
}

/**
 * The month as a grid of due dates.
 *
 * A list answers "how much"; this answers "when", which is the other half of
 * the question — a month where everything lands on the 5th is a very different
 * month from one where it is spread out, and no total shows that.
 */
export function CalendarView({
  month,
  occurrences,
  today,
  currency,
  language,
  t,
  onToggle,
  onOpen,
}: CalendarViewProps) {
  const { year, month: monthNumber } = parseMonthKey(month);
  const totals = useMemo(() => totalsByDay(occurrences), [occurrences]);

  // Opening on today keeps the common case one glance rather than one tap;
  // in any other month the first day is the sensible starting point.
  const [selected, setSelected] = useState<string | null>(
    monthKey(today) === month ? today : null,
  );

  const leadingBlanks = weekdayOf(firstDayOfMonth(month));
  const total = daysInMonth(year, monthNumber);
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: total }, (_, index) => toIso(year, monthNumber, index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedItems = selected
    ? occurrences.filter((occurrence) => occurrence.date === selected)
    : [];

  return (
    <div className="calendar">
      <div className="weekdays" aria-hidden="true">
        {weekdayInitials(language).map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>

      <div className="grid" role="grid">
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="cell blank" />;
          // The cascade runs by row, not by cell, so a 42-cell grid settles in
          // a few hundred milliseconds instead of crawling across the month.
          const wave = Math.floor(index / 7) + (index % 7) * 0.35;
          const day = totals.get(date);
          const isToday = date === today;
          const isSelected = date === selected;
          const classes = [
            "cell",
            isToday ? "today" : "",
            isSelected ? "selected" : "",
            day ? "has-items" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={date}
              type="button"
              className={classes}
              style={{ "--wave": wave } as CSSProperties}
              aria-current={isToday ? "date" : undefined}
              aria-label={formatFullDate(date, language)}
              onClick={() => setSelected(date)}
            >
              <span className="cell-day">{Number(date.slice(8))}</span>
              {day ? (
                <span className="cell-marks">
                  {day.unpaidExpense > 0 ? <i className="mark due" /> : null}
                  {day.expense > day.unpaidExpense ? <i className="mark settled" /> : null}
                  {day.income > 0 ? <i className="mark income" /> : null}
                </span>
              ) : null}
              {day && day.unpaidExpense > 0 ? (
                <span className="cell-amount">{formatAmount(day.unpaidExpense, language)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span>
          <i className="mark due" /> {t("calendar.legendDue")}
        </span>
        <span>
          <i className="mark settled" /> {t("calendar.legendSettled")}
        </span>
        <span>
          <i className="mark income" /> {t("calendar.legendIncome")}
        </span>
      </div>

      {selected ? (
        <section className="list-section">
          <header className="list-head">
            <h2>{formatFullDate(selected, language)}</h2>
          </header>
          {selectedItems.length > 0 ? (
            <ul className="rows">
              {selectedItems.map((occurrence) => (
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
          ) : (
            <p className="list-empty">{t("calendar.noItems")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
