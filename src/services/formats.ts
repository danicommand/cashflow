/**
 * Turning dates into the words a person reads, in their language.
 *
 * `Intl` does the work, but it wants a `Date`, and the app carries
 * `YYYY-MM-DD` strings. Every formatter here rebuilds the `Date` with the
 * local constructor so nothing shifts by a day across the date line.
 */

import { LOCALE_OF, type Translator } from "../i18n.ts";
import type { Language } from "../types.ts";
import { daysBetween, parseIso, parseMonthKey } from "./dates.ts";

function dateOf(iso: string): Date {
  const { year, month, day } = parseIso(iso);
  return new Date(year, month - 1, day);
}

export function formatDate(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_OF[language], {
    day: "2-digit",
    month: "short",
  }).format(dateOf(iso));
}

export function formatFullDate(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_OF[language], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dateOf(iso));
}

export function formatWeekday(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_OF[language], { weekday: "long" }).format(dateOf(iso));
}

export function formatMonthTitle(month: string, language: Language): string {
  const { year, month: monthNumber } = parseMonthKey(month);
  return new Intl.DateTimeFormat(LOCALE_OF[language], {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

/** Short weekday initials for the calendar header, starting on Sunday. */
export function weekdayInitials(language: Language): string[] {
  const formatter = new Intl.DateTimeFormat(LOCALE_OF[language], { weekday: "short" });
  // 2024-01-07 was a Sunday; seven days from there covers the whole week.
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2024, 0, 7 + index)),
  );
}

export function formatTime(isoTimestamp: string, language: Language): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE_OF[language], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

/**
 * How a due date reads relative to today: late, today, tomorrow, or a count of
 * days. This is the line under every unpaid bill, so it stays short.
 */
export function describeDueDate(due: string, today: string, t: Translator): string {
  const distance = daysBetween(today, due);
  if (distance < 0) {
    const late = Math.abs(distance);
    return late === 1 ? t("status.overdue") : t("status.overdueDays", { count: late });
  }
  if (distance === 0) return t("status.dueToday");
  if (distance === 1) return t("status.dueTomorrow");
  return t("status.dueInDays", { count: distance });
}
