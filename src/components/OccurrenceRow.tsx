import type { CSSProperties } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Entry, Language, Occurrence } from "../types.ts";
import { categoryColorIndex } from "../services/categoryColor.ts";
import { describeDueDate, formatDate } from "../services/formats.ts";
import { formatMoney } from "../services/money.ts";
import { priorityOf } from "../services/paymentPlan.ts";

interface OccurrenceRowProps {
  occurrence: Occurrence;
  today: string;
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onToggle: (occurrence: Occurrence) => void;
  onOpen: (occurrence: Occurrence) => void;
  onDelete: (entry: Entry) => void;
}

/**
 * One bill or one incoming amount, as a row.
 *
 * The tick is its own button rather than the whole row, because settling a
 * bill and editing it are different intentions and a row that does both on a
 * tap will do the wrong one.
 */
export function OccurrenceRow({
  occurrence,
  today,
  currency,
  language,
  t,
  onToggle,
  onOpen,
  onDelete,
}: OccurrenceRowProps) {
  const settled = occurrence.payment !== null;
  const skipped = occurrence.skipped;
  const isIncome = occurrence.entry.kind === "income";
  const overdue = !settled && !skipped && !isIncome && occurrence.date < today;
  const shown = occurrence.payment?.amount ?? occurrence.amount;
  const priority = priorityOf(occurrence.entry);

  const instalment =
    occurrence.entry.repeatCount !== null && occurrence.entry.repeatCount > 1
      ? t("status.instalment", {
          current: occurrence.index + 1,
          total: occurrence.entry.repeatCount,
        })
      : null;

  const meta = skipped
    ? t("status.skipped")
    : settled
      ? t(isIncome ? "status.receivedOn" : "status.paidOn", {
          date: formatDate(occurrence.payment!.paidOn, language),
        })
      : isIncome
        ? formatDate(occurrence.date, language)
        : describeDueDate(occurrence.date, today, t);

  const toggleLabel = skipped
    ? t("action.undoSkip")
    : settled
      ? t("action.undo")
      : isIncome
        ? t("action.markReceived")
        : t("action.markPaid");

  return (
    <li
      className={[
        "row",
        settled ? "settled" : "",
        skipped ? "skipped" : "",
        overdue ? "overdue" : "",
        isIncome ? "is-income" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-occurrence={occurrence.key}
      style={
        {
          viewTransitionName: `bill-${occurrence.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="tick"
        aria-pressed={settled || skipped}
        aria-label={`${toggleLabel}: ${occurrence.entry.description}`}
        onClick={() => onToggle(occurrence)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {skipped ? (
            <path className="tick-skip" d="M6 12h12" />
          ) : (
            // One continuous stroke, drawn rather than switched on. The dash
            // length is set in CSS so the draw can be reversed on undo.
            <path className="tick-check" d="M5 12.5l4.5 4.5L19 7.5" />
          )}
        </svg>
      </button>

      <button type="button" className="row-main" onClick={() => onOpen(occurrence)}>
        <span className="row-title">{occurrence.entry.description}</span>
        <span className="row-meta">
          <span className={overdue ? "meta-late" : undefined}>{meta}</span>
          {occurrence.entry.category ? (
            <span className={`chip cat-${categoryColorIndex(occurrence.entry.category)}`}>
              {occurrence.entry.category}
            </span>
          ) : null}
          {instalment ? <span className="chip subtle">{instalment}</span> : null}
          {!isIncome ? (
            <span className={`chip priority priority-${priority}`}>
              {t(`priority.${priority}`)}
            </span>
          ) : null}
        </span>
      </button>

      <span className={`row-amount${isIncome ? " income" : ""}`} data-row-amount>
        {formatMoney(shown, currency, language)}
      </span>

      <button
        type="button"
        className="row-delete"
        aria-label={t("action.deleteNamed", { description: occurrence.entry.description })}
        onClick={() => onDelete(occurrence.entry)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      </button>
    </li>
  );
}
