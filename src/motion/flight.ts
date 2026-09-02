/**
 * The focal moment: an amount leaving its row and landing in the month's total.
 *
 * Paying a bill is the one thing this app exists for, and the two halves of it
 * — the row going quiet, the total going down — sit far apart on screen. A
 * cross-fade would leave the person to work out that those two changes were
 * the same event. So the amount physically travels between them.
 *
 * This is the only module in the app that touches the DOM directly. It has to
 * be: the flight is a measurement of where two real elements are, which is
 * knowable only after layout, and a React-rendered ghost would need a frame to
 * mount before it could be measured. The element it creates is inert, aria
 * hidden, outside the layout, and removed when it lands.
 */

import { prefersReducedMotion } from "./motionPreference.ts";

/** Long enough to read as travel, short enough not to hold up the next tap. */
export const FLIGHT_MS = 560;

/** How long the total should wait before rolling, so it catches the amount. */
export const FLIGHT_CATCH_MS = 380;

export interface FlightOrigin {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  /** Income lands as a gain rather than a spend, and is tinted for it. */
  kind: "expense" | "income";
}

/**
 * Measure the amount shown on one occurrence's row, before the state change
 * that will move it. Returns `null` when the row is not on screen — a bill
 * settled from the calendar's day list, or from a filtered view — and the
 * caller simply skips the flight.
 */
export function measureOccurrenceAmount(occurrenceKey: string): FlightOrigin | null {
  if (typeof document === "undefined") return null;
  const row = document.querySelector(`[data-occurrence="${CSS.escape(occurrenceKey)}"]`);
  const amount = row?.querySelector("[data-row-amount]");
  if (!(amount instanceof HTMLElement)) return null;

  const box = amount.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;

  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    text: amount.textContent ?? "",
    kind: row?.classList.contains("is-income") ? "income" : "expense",
  };
}

/**
 * Fly a measured amount into the month total.
 *
 * Runs on the next frame so the list has already re-rendered underneath: the
 * ghost is a fixed-position copy at the captured coordinates, so it does not
 * matter that the real row has moved or gone.
 */
export function flyToTotal(origin: FlightOrigin | null): void {
  if (!origin || typeof document === "undefined") return;
  if (prefersReducedMotion()) {
    requestAnimationFrame(() => pulseTotal());
    return;
  }

  requestAnimationFrame(() => {
    const target = document.querySelector("[data-total-figure]");
    if (!(target instanceof HTMLElement)) return;

    const destination = target.getBoundingClientRect();

    // Settling a bill from far down a long list leaves the total off screen,
    // and an amount that flies to somewhere nobody can see is worse than no
    // flight at all. The row's own tick and strikethrough are the feedback in
    // that case, and they are right where the person is looking.
    if (destination.bottom < 0 || destination.top > window.innerHeight) return;

    const ghost = document.createElement("span");
    ghost.className = `money-flight ${origin.kind}`;
    ghost.textContent = origin.text;
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = `${origin.left}px`;
    ghost.style.top = `${origin.top}px`;
    ghost.style.width = `${origin.width}px`;
    ghost.style.height = `${origin.height}px`;
    document.body.appendChild(ghost);

    // Aim at the left edge of the total rather than its centre: the figure is
    // left-aligned, so that is where its first digit actually sits.
    const travelX = destination.left + destination.height * 0.35 - origin.left;
    const travelY = destination.top + destination.height * 0.55 - origin.top;

    // An arc, not a straight line. The lift is proportional to the distance
    // travelled, so a nearby row does not loop absurdly.
    const lift = Math.min(90, Math.abs(travelY) * 0.28 + 26);

    const animation = ghost.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1, offset: 0 },
        {
          transform: `translate3d(${travelX * 0.55}px, ${travelY * 0.4 - lift}px, 0) scale(1.14)`,
          opacity: 1,
          offset: 0.45,
        },
        {
          transform: `translate3d(${travelX}px, ${travelY}px, 0) scale(0.42)`,
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: FLIGHT_MS,
        easing: "cubic-bezier(0.32, 0, 0.16, 1)",
        fill: "forwards",
      },
    );

    const land = () => {
      ghost.remove();
      pulseTotal();
    };
    animation.addEventListener("finish", land, { once: true });
    // A cancelled animation still has to clean up its element.
    animation.addEventListener("cancel", () => ghost.remove(), { once: true });
  });
}

/**
 * The total acknowledging the arrival. Kept separate because it is also the
 * whole of the reduced-motion path — the feedback stays, the travel goes.
 */
function pulseTotal(): void {
  const target = document.querySelector("[data-total-figure]");
  if (!(target instanceof HTMLElement)) return;
  target.classList.remove("caught");
  // Reading offsetWidth forces the class removal to take effect before it is
  // added back, so a second payment replays the animation instead of ignoring
  // it.
  void target.offsetWidth;
  target.classList.add("caught");
  window.setTimeout(() => target.classList.remove("caught"), 700);
}
