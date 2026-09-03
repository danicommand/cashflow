/**
 * Service worker registration, and the update flow it needs to not be a
 * liability.
 *
 * A stale cached app shell that never notices a new deploy exists is the
 * classic PWA failure mode. This never applies an update silently: a new
 * worker installing dispatches a DOM event instead of taking over, the app
 * decides how to ask (the same toast every other acknowledgment uses), and
 * `applyUpdate` is the only thing that lets the new worker actually take
 * control.
 */

export const UPDATE_EVENT = "cashflow:update-available";

let waitingWorker: ServiceWorker | null = null;

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) announceUpdate(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `controller` being set means this is a genuine update, not the
            // very first install — a first install has nothing to reload for.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              announceUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        // Offline support is a nicety, not a requirement — a failed
        // registration should never keep the app itself from working online.
      });
  });

  // The waiting worker taking over (after applyUpdate()) swaps which files
  // are in control. One reload actually loads the ones it now controls.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

function announceUpdate(worker: ServiceWorker): void {
  waitingWorker = worker;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

/** Tell the waiting worker to take over. Triggers a reload once it does. */
export function applyUpdate(): void {
  // ServiceWorker#postMessage has no `targetOrigin` parameter at all — that
  // belongs to window.postMessage, a different API the linter's rule does
  // not distinguish from this one.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  waitingWorker?.postMessage("skipWaiting");
}
