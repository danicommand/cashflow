import { useEffect, useRef, useState } from "react";

import type { CurrencyCode, Language } from "../types.ts";
import { formatMoney } from "../services/money.ts";
import { toOdometerSlots, wheelDelay } from "../services/odometer.ts";
import { prefersReducedMotion } from "../motion/motionPreference.ts";

interface AnimatedMoneyProps {
  cents: number;
  currency: CurrencyCode;
  language: Language;
  /**
   * Hold the roll back by this many milliseconds. Used so the total waits for
   * the amount flying towards it instead of updating before it lands.
   */
  delay?: number;
  className?: string;
}

/** 0-9, stacked in a column that slides to show one digit. */
const WHEEL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A money figure that rolls to its new value like a meter.
 *
 * Each digit is a wheel of 0-9 translated to show one face, so only the wheels
 * whose digit actually changed move — the cents sit still while the thousands
 * turn. The formatted string keeps its currency symbol and separators in
 * place, which is why the slots come from the formatted output rather than
 * from the number.
 *
 * The accessible name is the plain formatted amount on a single element, so a
 * screen reader reads "one thousand two hundred" rather than spelling out
 * eleven separate wheels.
 */
export function AnimatedMoney({
  cents,
  currency,
  language,
  delay = 0,
  className,
}: AnimatedMoneyProps) {
  const formatted = formatMoney(cents, currency, language);
  const slots = toOdometerSlots(formatted);

  // The wheels start on their current value and only animate afterwards, so a
  // first paint does not roll every digit up from zero.
  const [armed, setArmed] = useState(false);
  const previous = useRef(cents);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const changed = previous.current !== cents;
  previous.current = cents;

  const rolls = armed && !prefersReducedMotion();

  return (
    <span className={className ? `odometer ${className}` : "odometer"}>
      <span className="visually-hidden" aria-live="polite">
        {formatted}
      </span>
      <span aria-hidden="true" className={changed ? "odometer-slots turning" : "odometer-slots"}>
        {slots.map((slot) =>
          slot.digit === null ? (
            <span key={slot.key} className="odo-fixed">
              {slot.char}
            </span>
          ) : (
            <span key={slot.key} className="odo-slot">
              <span
                className="odo-reel"
                style={{
                  transform: `translateY(${slot.digit * -10}%)`,
                  transitionDuration: rolls ? undefined : "0ms",
                  transitionDelay: rolls ? `${delay + wheelDelay(slot)}ms` : "0ms",
                }}
              >
                {WHEEL.map((face) => (
                  <span key={face} className="odo-face">
                    {face}
                  </span>
                ))}
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
