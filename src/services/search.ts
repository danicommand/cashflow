/**
 * Finding a bill or income by name, across every month at once.
 *
 * Every other view in the app is scoped to the month on screen or a short
 * trailing window — reasonable defaults, but useless the moment you can
 * remember what something was called and not which month it happened in.
 * This searches the rule (`Entry`), not the expanded occurrences, since the
 * entry is what carries the name.
 */

import type { Entry } from "../types.ts";
import { currentMonthKey, monthKey } from "./dates.ts";

export interface SearchResult {
  entry: Entry;
  /** Where the "jump to" action should land: the entry's own month if it
   * never repeats, otherwise the current month, since a repeating entry has
   * an occurrence there too. */
  month: string;
}

// The Unicode "combining diacritical marks" block, by code point rather than
// a regex escape — the escape form for this exact range has a way of getting
// silently re-interpreted as the literal characters it names when it passes
// through certain text pipelines, which turns the regex into a no-op without
// any visible sign of it. Numeric bounds cannot suffer that.
const COMBINING_MARK_START = 0x0300;
const COMBINING_MARK_END = 0x036f;

/** Case- and accent-insensitive, so "Café" matches "cafe". */
function normalise(value: string): string {
  const stripped = [...value.normalize("NFD")]
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < COMBINING_MARK_START || codePoint > COMBINING_MARK_END;
    })
    .join("");
  return stripped.toLowerCase();
}

/**
 * Live entries whose description or category contains `query`, description
 * matches first, then alphabetically — capped so a broad query on a long
 * history still returns instantly.
 */
export function searchEntries(entries: Entry[], query: string, limit = 30): SearchResult[] {
  const needle = normalise(query.trim());
  if (!needle) return [];

  const matches: { entry: Entry; inDescription: boolean }[] = [];
  for (const entry of entries) {
    if (entry.deletedAt) continue;
    const inDescription = normalise(entry.description).includes(needle);
    const inCategory = normalise(entry.category).includes(needle);
    if (inDescription || inCategory) matches.push({ entry, inDescription });
  }

  return matches
    .toSorted((a, b) => {
      if (a.inDescription !== b.inDescription) return a.inDescription ? -1 : 1;
      return a.entry.description.localeCompare(b.entry.description);
    })
    .slice(0, limit)
    .map(({ entry }) => ({
      entry,
      month: entry.repeat === "none" ? monthKey(entry.dueDate) : currentMonthKey(),
    }));
}
