import { useEffect, useState } from "react";

/** How much the scroll position has to move before it counts as a direction. */
const DIRECTION_THRESHOLD_PX = 4;

/** How long the FAB stays hidden after the last scroll event, once idle. */
const IDLE_REVEAL_MS = 700;

/** Below this scroll offset the FAB always shows — there is nothing to hide from yet. */
const ALWAYS_VISIBLE_PX = 80;

/**
 * Whether the floating add button should be showing right now.
 *
 * The FAB sits fixed over the bottom-right corner, which is also where a
 * list's amount column lives — scrolling a list of more than a couple of
 * unpaid bills runs a row directly under it. Rather than shrink the button or
 * carve out permanent dead space in every list, it steps aside while the page
 * is actively moving and comes back the moment scrolling stops or reverses,
 * the way a bottom app bar's FAB does on a phone.
 */
export function useFabVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let idleTimer: number | undefined;

    const reveal = () => setVisible(true);

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;

      if (y < ALWAYS_VISIBLE_PX) {
        setVisible(true);
      } else if (Math.abs(delta) > DIRECTION_THRESHOLD_PX) {
        // Scrolling up (delta < 0) is always a request to see more chrome,
        // including the button that was just hidden.
        setVisible(delta < 0);
      }
      lastY = y;

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(reveal, IDLE_REVEAL_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idleTimer);
    };
  }, []);

  return visible;
}
