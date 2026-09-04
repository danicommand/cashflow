import type { Occurrence } from "../types.ts";

export interface RunwayPoint {
  date: string;
  balance: number;
}

export interface CashRunway {
  points: RunwayPoint[];
  lowest: number;
}

export function cashRunway(carriedIn: number, occurrences: Occurrence[]): CashRunway {
  let balance = carriedIn;
  const points: RunwayPoint[] = [{ date: "start", balance }];
  const active = occurrences
    .filter((item) => !item.skipped)
    .toSorted((left, right) => {
      const leftDate = left.payment?.paidOn ?? left.date;
      const rightDate = right.payment?.paidOn ?? right.date;
      return leftDate.localeCompare(rightDate);
    });

  for (const occurrence of active) {
    const amount = occurrence.payment?.amount ?? occurrence.amount;
    balance += occurrence.entry.kind === "income" ? amount : -amount;
    points.push({ date: occurrence.payment?.paidOn ?? occurrence.date, balance });
  }

  return { points, lowest: Math.min(...points.map((point) => point.balance)) };
}
