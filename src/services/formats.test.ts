import { describe, expect, it } from "vitest";

import { translatorFor } from "../i18n.ts";
import {
  describeDueDate,
  formatDate,
  formatFullDate,
  formatMonthTitle,
  weekdayInitials,
} from "./formats.ts";

const t = translatorFor("en");

describe("describeDueDate", () => {
  it("names today and tomorrow rather than counting", () => {
    expect(describeDueDate("2026-01-10", "2026-01-10", t)).toBe("Due today");
    expect(describeDueDate("2026-01-11", "2026-01-10", t)).toBe("Due tomorrow");
  });

  it("counts the days ahead", () => {
    expect(describeDueDate("2026-01-15", "2026-01-10", t)).toBe("In 5 days");
  });

  it("says how late a bill is", () => {
    expect(describeDueDate("2026-01-09", "2026-01-10", t)).toBe("Overdue");
    expect(describeDueDate("2026-01-05", "2026-01-10", t)).toBe("5 days late");
  });

  it("counts across a month boundary", () => {
    expect(describeDueDate("2026-02-02", "2026-01-30", t)).toBe("In 3 days");
  });
});

describe("date formatting", () => {
  it("shows the day the entry actually carries, not a timezone-shifted one", () => {
    // Parsing "2026-01-05" as UTC would render the 4th anywhere west of
    // Greenwich, which would put a bill on the wrong day for half the world.
    expect(formatFullDate("2026-01-05", "en")).toContain("05");
    expect(formatDate("2026-01-05", "en")).toContain("05");
  });

  it("uses the chosen language", () => {
    expect(formatMonthTitle("2026-01", "en").toLowerCase()).toContain("january");
    expect(formatMonthTitle("2026-01", "pt").toLowerCase()).toContain("janeiro");
  });
});

describe("weekdayInitials", () => {
  it("returns seven labels starting on Sunday", () => {
    const labels = weekdayInitials("en");
    expect(labels).toHaveLength(7);
    expect(labels[0].toLowerCase()).toContain("su");
    expect(labels[6].toLowerCase()).toContain("sa");
  });
});
