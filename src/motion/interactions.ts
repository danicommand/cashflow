import { prefersReducedMotion } from "./motionPreference.ts";

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export function runViewTransition(update: () => void): void {
  const transitionDocument = document as TransitionDocument;
  if (prefersReducedMotion() || !transitionDocument.startViewTransition) {
    update();
    return;
  }
  transitionDocument.startViewTransition(update);
}

export function haptic(kind: "success" | "delete" | "select"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (kind === "success") navigator.vibrate(12);
  else if (kind === "delete") navigator.vibrate([8, 28, 8]);
  else navigator.vibrate(6);
}
