/**
 * Whether this person has asked for less movement.
 *
 * Read at the moment of the animation rather than cached, because the
 * preference can change mid-session — turning it on in the OS should quiet the
 * next payment, not the next reload.
 *
 * CSS handles the declarative side; this exists for the effects that are built
 * in script and have no stylesheet to opt out of.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
