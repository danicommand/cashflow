/**
 * Money is stored as an integer number of cents everywhere in this app. It is
 * converted to a decimal only to be shown or typed.
 */

import type { CurrencyCode, Language } from "../types.ts";

const LOCALES: Record<Language, string> = {
  en: "en-US",
  pt: "pt-BR",
};

export const CURRENCIES: CurrencyCode[] = ["USD", "BRL", "EUR", "GBP"];

export function formatMoney(
  cents: number,
  currency: CurrencyCode,
  language: Language,
): string {
  return new Intl.NumberFormat(LOCALES[language], {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Without the symbol — for tight rows where the currency is already obvious. */
export function formatAmount(cents: number, language: Language): string {
  return new Intl.NumberFormat(LOCALES[language], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function currencySymbol(currency: CurrencyCode, language: Language): string {
  const parts = new Intl.NumberFormat(LOCALES[language], {
    style: "currency",
    currency,
  }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

/**
 * Read an amount the way a person actually types one.
 *
 * The separator problem is real: a Brazilian types `1.234,56` and an American
 * types `1,234.56` for the same money, and both may be typed into the same
 * field on the same device. Rather than trust the interface language, the
 * *last* separator decides — if one or two digits follow it, it is the decimal
 * point; otherwise every separator is grouping. That reads `1,234` as one
 * thousand two hundred thirty-four and `1,23` as one and twenty-three, which
 * is what each typist meant.
 *
 * Returns `null` when there is no number to read, so callers can tell an empty
 * field from a zero.
 */
export function parseMoney(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const negative = trimmed.startsWith("-") || /^\(.*\)$/.test(trimmed);
  const digitsAndSeparators = trimmed.replace(/[^\d.,]/g, "");
  if (!digitsAndSeparators || !/\d/.test(digitsAndSeparators)) return null;

  const lastSeparator = Math.max(
    digitsAndSeparators.lastIndexOf("."),
    digitsAndSeparators.lastIndexOf(","),
  );

  let whole: string;
  let fraction: string;
  if (lastSeparator === -1) {
    whole = digitsAndSeparators;
    fraction = "";
  } else {
    const tail = digitsAndSeparators.slice(lastSeparator + 1);
    if (tail.length >= 1 && tail.length <= 2 && /^\d+$/.test(tail)) {
      whole = digitsAndSeparators.slice(0, lastSeparator);
      fraction = tail;
    } else {
      whole = digitsAndSeparators;
      fraction = "";
    }
  }

  const wholeDigits = whole.replace(/\D/g, "") || "0";
  const cents = Number(wholeDigits) * 100 + Number(fraction.padEnd(2, "0") || "0");
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** Cents back into a plain editable string like `1234.56`. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Split a total across instalments so the parts add back up to the total
 * exactly. The remainder lands on the first instalment rather than being
 * spread, which is how card statements do it.
 */
export function splitInstalments(total: number, count: number): number[] {
  if (count <= 1) return [total];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base));
}
