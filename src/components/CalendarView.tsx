import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Entry, EntryKind, Language, Occurrence } from "../types.ts";
import {
  addDays,
  daysInMonth,
  firstDayOfMonth,
  monthKey,
  parseMonthKey,
  toIso,
  weekdayOf,
} from "../services/dates.ts";
import { formatFullDate, weekdayInitials } from "../services/formats.ts";
import { formatAmount, formatMoney } from "../services/money.ts";
import { totalsByDay } from "../services/summary.ts";
import { calendarPressure } from "../services/paymentPlan.ts";
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
  onPaymentDetails?: (occurrence: Occurrence) => void;
  onDelete: (entry: Entry) => void;
  onAddForDay: (date: string, kind: EntryKind) => void;
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
  onPaymentDetails,
  onDelete,
  onAddForDay,
}: CalendarViewProps) {
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const { year, month: monthNumber } = parseMonthKey(month);
  const totals = useMemo(() => totalsByDay(occurrences), [occurrences]);
  const occurrencesByDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occurrence of occurrences) {
      const items = map.get(occurrence.date) ?? [];
      items.push(occurrence);
      map.set(occurrence.date, items);
    }
    return map;
  }, [occurrences]);

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
  const dates = cells.filter((date): date is string => date !== null);

  useEffect(() => {
    if (selected && monthKey(selected) !== month) {
      setSelected(monthKey(today) === month ? today : null);
    }
  }, [month, selected, today]);

  useEffect(() => {
    if (!selected) return;

    const dismissPopover = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#calendar-day-popover, [data-calendar-day]")) return;
      setSelected(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };

    document.addEventListener("pointerdown", dismissPopover);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissPopover);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [selected]);

  const changeSelectedDay = (offset: number) => {
    if (!selected) return;
    const currentIndex = dates.indexOf(selected);
    const nextIndex = Math.max(0, Math.min(dates.length - 1, currentIndex + offset));
    setSelected(dates[nextIndex]);
  };

  const selectDay = (date: string, moveFocus = false) => {
    setSelected(date);
    if (moveFocus) dayButtons.current.get(date)?.focus();
  };

  const selectedItems = selected
    ? occurrences.filter((occurrence) => occurrence.date === selected)
    : [];
  const selectedTotals = selected ? totals.get(selected) : undefined;
  const selectedIndex = selected ? cells.indexOf(selected) : -1;
  const selectedRow = Math.floor(selectedIndex / 7);
  const selectedColumn = selectedIndex % 7;
  const popoverSide = selectedColumn < 2 ? "start" : selectedColumn > 4 ? "end" : "middle";
  const popoverDirection = selectedRow > 2 ? "above" : "below";
  const selectedNet = selectedTotals ? selectedTotals.income - selectedTotals.unpaidExpense : 0;
  const activeDays = totals.size;
  const scheduledItems = occurrences.filter((occurrence) => !occurrence.skipped).length;
  const monthDue = [...totals.values()].reduce((totalDue, day) => totalDue + day.unpaidExpense, 0);
  const nextScheduledDate =
    dates.find((date) => date >= today && totals.has(date)) ?? dates.find((date) => totals.has(date));
  const selectedWeekStart = selected ? addDays(selected, -weekdayOf(selected)) : null;
  const selectedWeekEnd = selectedWeekStart ? addDays(selectedWeekStart, 6) : null;
  const selectedWeekTotals = occurrences.reduce(
    (summary, occurrence) => {
      if (
        occurrence.skipped ||
        !selectedWeekStart ||
        !selectedWeekEnd ||
        occurrence.date < selectedWeekStart ||
        occurrence.date > selectedWeekEnd
      ) {
        return summary;
      }
      if (occurrence.entry.kind === "income") summary.income += occurrence.amount;
      else if (!occurrence.payment) summary.due += occurrence.amount;
      return summary;
    },
    { due: 0, income: 0 },
  );
  const selectedWeekNet = selectedWeekTotals.income - selectedWeekTotals.due;

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <p className="calendar-snapshot" aria-label={t("calendar.monthSnapshot")}>
          <span>{t("calendar.scheduled", { count: scheduledItems })}</span>
          <span>{t("calendar.activeDates", { count: activeDays })}</span>
          <strong>{formatMoney(monthDue, currency, language)} {t("calendar.due")}</strong>
        </p>
        <div className="calendar-toolbar-actions">
          <button
            type="button"
            onClick={() => setSelected(today)}
            disabled={!dates.includes(today)}
          >
            {t("calendar.openToday")}
          </button>
          <button
            type="button"
            onClick={() => nextScheduledDate && setSelected(nextScheduledDate)}
            disabled={!nextScheduledDate}
          >
            {t("calendar.nextPlanned")}
          </button>
        </div>
      </div>
      <div className="weekdays" aria-hidden="true">
        {weekdayInitials(language).map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>

      <div className="calendar-grid-wrap">
        <div className="grid" role="grid">
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="cell blank" />;
          // The cascade runs by row, not by cell, so a 42-cell grid settles in
          // a few hundred milliseconds instead of crawling across the month.
          const wave = Math.floor(index / 7) + (index % 7) * 0.35;
          const day = totals.get(date);
          const isToday = date === today;
          const isSelected = date === selected;
          const pressure = calendarPressure(occurrencesByDay.get(date) ?? [], today);
          const classes = [
            "cell",
            isToday ? "today" : "",
            isSelected ? "selected" : "",
            day ? "has-items" : "",
            pressure ? `pressure-${pressure}` : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={date}
              type="button"
              className={classes}
              ref={(button) => {
                if (button) dayButtons.current.set(date, button);
                else dayButtons.current.delete(date);
              }}
              style={{ "--wave": wave } as CSSProperties}
              aria-current={isToday ? "date" : undefined}
              aria-controls={isSelected ? "calendar-day-popover" : undefined}
              aria-expanded={isSelected}
              aria-haspopup="dialog"
              aria-label={formatFullDate(date, language)}
              data-calendar-day
              onClick={() => setSelected((current) => (current === date ? null : date))}
              onKeyDown={(event) => {
                const movement = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                }[event.key];
                if (movement === undefined) return;
                event.preventDefault();
                const currentIndex = dates.indexOf(date);
                const nextIndex = Math.max(0, Math.min(dates.length - 1, currentIndex + movement));
                selectDay(dates[nextIndex], true);
              }}
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

        {selected ? (
          <section
            id="calendar-day-popover"
            className={`calendar-popover ${popoverSide} ${popoverDirection}`}
            role="dialog"
            aria-label={formatFullDate(selected, language)}
            style={
              {
                "--popover-row": selectedRow,
                "--popover-column": selectedColumn,
              } as CSSProperties
            }
          >
            <header className="calendar-popover-head">
              <div>
                <h2>{formatFullDate(selected, language)}</h2>
                <p>
                  {selectedItems.length === 0
                    ? t("calendar.dayEmpty")
                    : t("calendar.dayItems", { count: selectedItems.length })}
                </p>
              </div>
              <div className="calendar-popover-tools">
                <button
                  type="button"
                  className="calendar-popover-close"
                  aria-label={t("calendar.previousDay")}
                  disabled={dates.indexOf(selected) === 0}
                  onClick={() => changeSelectedDay(-1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="m14 6-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="calendar-popover-close"
                  aria-label={t("calendar.nextDay")}
                  disabled={dates.indexOf(selected) === dates.length - 1}
                  onClick={() => changeSelectedDay(1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="m10 6 6 6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="calendar-popover-close"
                  aria-label={t("action.close")}
                  onClick={() => setSelected(null)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                </button>
              </div>
            </header>
            {selectedTotals ? (
              <div className="calendar-popover-summary">
                <span>
                  <small>{t("calendar.due")}</small>
                  <strong>{formatMoney(selectedTotals.unpaidExpense, currency, language)}</strong>
                </span>
                <span>
                  <small>{t("calendar.income")}</small>
                  <strong className="income">{formatMoney(selectedTotals.income, currency, language)}</strong>
                </span>
                <span>
                  <small>{t("calendar.net")}</small>
                  <strong className={selectedNet < 0 ? "negative" : "income"}>
                    {formatMoney(selectedNet, currency, language)}
                  </strong>
                </span>
              </div>
            ) : null}
            <div className="calendar-week-summary">
              <small>{t("calendar.thisWeek")}</small>
              <strong className={selectedWeekNet < 0 ? "negative" : "income"}>
                {selectedWeekNet > 0 ? "+" : ""}
                {formatMoney(selectedWeekNet, currency, language)}
              </strong>
              <span>
                {formatMoney(selectedWeekTotals.due, currency, language)} {t("calendar.due")} · {formatMoney(selectedWeekTotals.income, currency, language)} {t("calendar.income")}
              </span>
            </div>
            {selectedItems.length > 0 ? (
              <ul className="rows calendar-popover-rows">
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
                    onPaymentDetails={onPaymentDetails}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            ) : (
              <p className="calendar-popover-empty">{t("calendar.noItems")}</p>
            )}
            <footer className="calendar-popover-actions">
              <button type="button" onClick={() => onAddForDay(selected, "expense")}>
                {t("calendar.addForDay")}
              </button>
              <button type="button" onClick={() => onAddForDay(selected, "income")}>
                {t("action.addIncome")}
              </button>
            </footer>
          </section>
        ) : null}
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

    </div>
  );
}
