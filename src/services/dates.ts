/**
 * Calendar arithmetic on `YYYY-MM-DD` strings.
 *
 * Everything here stays in the user's own calendar. `new Date("2026-09-05")`
 * parses as UTC midnight, which is the previous day for anyone west of
 * Greenwich — a bill due on the 5th would show up as due on the 4th. So dates
 * are split and rebuilt by hand and only ever converted to a `Date` with the
 * local `(y, m, d)` constructor.
 */

export interface DateParts {
  year: number;
  /** 1-12, not the zero-based month a `Date` uses. */
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const parts = parseIso(value);
  return (
    parts.month >= 1 &&
    parts.month <= 12 &&
    parts.day >= 1 &&
    parts.day <= daysInMonth(parts.year, parts.month)
  );
}

export function parseIso(value: string): DateParts {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Not an ISO date: ${value}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate();
}

export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Add whole months, clamping to the end of the shorter month: the 31st plus
 * one month is the 28th or 29th of February, not the 3rd of March. A bill due
 * on the 31st is due on the last day of every month, which is what people
 * mean when they say "the 31st".
 */
export function addMonths(iso: string, count: number): string {
  const { year, month, day } = parseIso(iso);
  const zeroBased = year * 12 + (month - 1) + count;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12) + 1;
  return toIso(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)));
}

export function addDays(iso: string, count: number): string {
  const { year, month, day } = parseIso(iso);
  const shifted = new Date(year, month - 1, day + count);
  return toIso(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate());
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseIso(from);
  const b = parseIso(to);
  const left = Date.UTC(a.year, a.month - 1, a.day);
  const right = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((right - left) / 86_400_000);
}

/** `YYYY-MM`, the key every month view is addressed by. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-");
  return { year: Number(year), month: Number(month) };
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(todayIso(now));
}

export function shiftMonthKey(key: string, count: number): string {
  const { year, month } = parseMonthKey(key);
  return monthKey(addMonths(toIso(year, month, 1), count));
}

/** Whole months from one month key to another; negative when going back. */
export function monthsBetween(from: string, to: string): number {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function firstDayOfMonth(key: string): string {
  const { year, month } = parseMonthKey(key);
  return toIso(year, month, 1);
}

export function lastDayOfMonth(key: string): string {
  const { year, month } = parseMonthKey(key);
  return toIso(year, month, daysInMonth(year, month));
}

/** 0 = Sunday, matching `Date.prototype.getDay`. */
export function weekdayOf(iso: string): number {
  const { year, month, day } = parseIso(iso);
  return new Date(year, month - 1, day).getDay();
}
