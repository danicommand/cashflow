import type { DashboardPriority } from "../types.ts";

export function reorderDashboardMetrics(
  order: DashboardPriority[],
  dragged: DashboardPriority,
  target: DashboardPriority,
): DashboardPriority[] {
  if (dragged === target || !order.includes(dragged) || !order.includes(target)) return order;
  const next = order.filter((metric) => metric !== dragged);
  next.splice(next.indexOf(target), 0, dragged);
  return next;
}
