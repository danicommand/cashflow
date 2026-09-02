/**
 * Splitting a formatted money string into odometer wheels.
 *
 * The hero total does not swap one number for another — it rolls, the way a
 * meter does, and only the wheels whose digit actually changed turn. Getting
 * that right is entirely a question of *identity*: which wheel in "R$ 1.234,56"
 * is the same wheel as which one in "R$ 934,56". Key wheels by their position
 * from the left and every digit appears to change when the number gains a
 * place. Key them from the right and the cents stay put while the thousands
 * appear, which is what a physical odometer does.
 *
 * This is pure string work so the choreography can be tested without a DOM.
 */

export interface OdometerSlot {
  /** Stable across renders: distance from the end of the string. */
  key: number;
  /** The character to show. */
  char: string;
  /** 0-9 for a rolling wheel, `null` for fixed glyphs like `R$` or `,`. */
  digit: number | null;
  /** How many digits sit to the right of this one. Drives the cascade. */
  digitsToTheRight: number;
}

/** A wheel's head start, in milliseconds. */
export const WHEEL_STEP_MS = 26;

/**
 * The cascade cannot grow with the number — a large total would take a second
 * to settle and read as lag rather than as mechanism.
 */
export const WHEEL_MAX_DELAY_MS = 190;

const DIGIT = /\d/;

/**
 * Turn a formatted amount into wheels, right to left.
 *
 * The input is whatever `Intl.NumberFormat` produced, so it may carry a
 * currency symbol, grouping separators, a decimal comma or point, a minus
 * sign, and non-breaking spaces. Only the digits roll; everything else is
 * carried through untouched and in place.
 */
export function toOdometerSlots(formatted: string): OdometerSlot[] {
  const characters = [...formatted];
  const slots: OdometerSlot[] = [];
  let digitsSeen = 0;

  // Walk backwards so "digits to the right" is known as each slot is built.
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const char = characters[index];
    const isDigit = DIGIT.test(char);
    slots.push({
      key: characters.length - 1 - index,
      char,
      digit: isDigit ? Number(char) : null,
      digitsToTheRight: digitsSeen,
    });
    if (isDigit) digitsSeen += 1;
  }

  return slots.toReversed();
}

/**
 * The rightmost wheel starts first and the rest follow, so the movement reads
 * as one settling mechanism rather than as every digit twitching at once.
 */
export function wheelDelay(slot: OdometerSlot): number {
  return Math.min(slot.digitsToTheRight * WHEEL_STEP_MS, WHEEL_MAX_DELAY_MS);
}

/** How long the whole roll takes, for choreography that follows it. */
export function rollDuration(slots: OdometerSlot[], travelMs: number): number {
  const longest = slots.reduce((most, slot) => Math.max(most, wheelDelay(slot)), 0);
  return longest + travelMs;
}
