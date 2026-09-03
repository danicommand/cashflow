import { useState } from "react";

import type { Translator } from "../i18n.ts";
import type { CurrencyCode, Entry, Language } from "../types.ts";
import { formatMonthTitle } from "../services/formats.ts";
import { formatMoney } from "../services/money.ts";
import { searchEntries, type SearchResult } from "../services/search.ts";
import { Sheet } from "./Sheet.tsx";

interface SearchSheetProps {
  entries: Entry[];
  currency: CurrencyCode;
  language: Language;
  t: Translator;
  onJump: (result: SearchResult) => void;
  onClose: () => void;
}

/**
 * Finding a bill by name without knowing which month it lives in.
 *
 * Every other screen in the app is scoped to a month or a short trailing
 * window; this is the one place that looks at everything at once, on
 * purpose — the whole point is to find something without already knowing
 * where it is.
 */
export function SearchSheet({ entries, currency, language, t, onJump, onClose }: SearchSheetProps) {
  const [query, setQuery] = useState("");
  const results = searchEntries(entries, query);

  return (
    <Sheet title={t("search.title")} closeLabel={t("action.close")} onClose={onClose}>
      <div className="search">
        <input
          type="text"
          className="search-input"
          value={query}
          placeholder={t("search.placeholder")}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        {query.trim() && results.length === 0 ? (
          <p className="list-empty">{t("search.empty")}</p>
        ) : null}

        {results.length > 0 ? (
          <ul className="rows search-results">
            {results.map((result) => (
              <li key={result.entry.id} className="row">
                <button
                  type="button"
                  className="row-main upcoming-row"
                  onClick={() => onJump(result)}
                >
                  <span className="row-body">
                    <span className="row-title">{result.entry.description}</span>
                    <span className="row-meta">
                      {result.entry.category ? (
                        <span className="chip">{result.entry.category}</span>
                      ) : null}
                      <span className="chip subtle">
                        {formatMonthTitle(result.month, language)}
                      </span>
                    </span>
                  </span>
                  <span className="row-amount">
                    {formatMoney(result.entry.amount, currency, language)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Sheet>
  );
}
