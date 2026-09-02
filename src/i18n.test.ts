import { describe, expect, it } from "vitest";

import {
  LANGUAGES,
  TRANSLATION_KEYS,
  detectLanguage,
  translate,
  translatorFor,
} from "./i18n.ts";
import type { Language } from "./types.ts";

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]).toSorted();
}

describe("translate", () => {
  it("returns a non-empty string in every language for every key", () => {
    for (const { code } of LANGUAGES) {
      for (const key of TRANSLATION_KEYS) {
        expect(translate(code, key).trim()).not.toBe("");
      }
    }
  });

  it("fills placeholders in", () => {
    expect(translate("en", "status.overdueDays", { count: 3 })).toBe("3 days late");
    expect(translate("pt", "status.overdueDays", { count: 3 })).toBe("3 dias de atraso");
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    expect(translate("en", "summary.paidOf", { paid: "$10" })).toContain("{total}");
  });

  it("uses the same placeholders in every language", () => {
    // A translation that drops `{total}` produces a sentence with a hole in
    // it, and nothing else in the app would catch that.
    for (const key of TRANSLATION_KEYS) {
      const reference = placeholdersIn(translate("en", key));
      for (const { code } of LANGUAGES) {
        expect(placeholdersIn(translate(code, key))).toEqual(reference);
      }
    }
  });
});

describe("translatorFor", () => {
  it("binds one language", () => {
    const t = translatorFor("pt");
    expect(t("nav.month")).toBe("Mês");
  });
});

describe("detectLanguage", () => {
  it("picks Portuguese for any Portuguese locale", () => {
    expect(detectLanguage(["pt-BR", "en-US"])).toBe("pt");
    expect(detectLanguage(["PT"])).toBe("pt");
  });

  it("picks English for English", () => {
    expect(detectLanguage(["en-GB"])).toBe("en");
  });

  it("falls back to English for anything else", () => {
    expect(detectLanguage(["fr-FR", "de-DE"])).toBe("en");
    expect(detectLanguage([])).toBe("en");
  });

  it("returns a value the settings type accepts", () => {
    const language: Language = detectLanguage(["es-ES"]);
    expect(LANGUAGES.some((entry) => entry.code === language)).toBe(true);
  });
});
