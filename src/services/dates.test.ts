import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  isIsoDate,
  lastDayOfMonth,
  monthsBetween,
  shiftMonthKey,
  todayIso,
  weekdayOf,
} from "./dates.ts";

describe("addMonths", () => {
  it("keeps the day of the month when it exists", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("clamps to the end of a shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("always measures from the original date, so a clamp is not permanent", () => {
    // Two months from 31 January is 31 March, not 28 March. Chaining month by
    // month from the clamped result would lose the day for good.
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("crosses year boundaries in both directions", () => {
    expect(addMonths("2026-11-05", 3)).toBe("2027-02-05");
    expect(addMonths("2026-02-05", -3)).toBe("2025-11-05");
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });

  it("goes backwards across a year boundary", () => {
    expect(addDays("2026-01-02", -5)).toBe("2025-12-28");
  });

  it("handles a leap day", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("daysBetween", () => {
  it("counts forwards and backwards", () => {
    expect(daysBetween("2026-09-01", "2026-09-11")).toBe(10);
    expect(daysBetween("2026-09-11", "2026-09-01")).toBe(-10);
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("is unaffected by daylight saving shifts", () => {
    // A local-time subtraction over a DST boundary yields 30.958… days and
    // rounds wrong without care; these are calendar days either way.
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });
});

describe("daysInMonth", () => {
  it("knows February in common and leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe("month keys", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("measures the gap between months", () => {
    expect(monthsBetween("2026-01", "2026-04")).toBe(3);
    expect(monthsBetween("2026-04", "2026-01")).toBe(-3);
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
  });

  it("finds the last day of a month", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });
});

describe("isIsoDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isIsoDate("2026-09-02")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-9-2")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("todayIso", () => {
  it("reads the local calendar date, not the UTC one", () => {
    // 22:30 on the 2nd in a zone behind UTC is already the 3rd in UTC. The
    // app must say the 2nd, because that is the day the person is having.
    const evening = new Date(2026, 8, 2, 22, 30);
    expect(todayIso(evening)).toBe("2026-09-02");
  });
});

describe("weekdayOf", () => {
  it("returns 0 for Sunday", () => {
    expect(weekdayOf("2026-09-06")).toBe(0);
    expect(weekdayOf("2026-09-02")).toBe(3);
  });
});
