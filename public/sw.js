/**
 * The offline shell.
 *
 * Strategy is network-first, cache-fallback, for everything same-origin
 * that is not the API: try the network, and whatever comes back replaces
 * what is cached. Only when the network is unreachable does the cache get
 * served. That means there is no list of hashed filenames to keep in sync
 * with each build — the cache is always just "the last thing that loaded
 * successfully," which self-heals on the next successful request rather
 * than needing a version bump here every time app.tsx changes.
 *
 * It never takes over automatically. `skipWaiting` only runs on an explicit
 * message from the page — see src/pwa.ts — so a person already using the
 * app is never swapped onto a new version out from under them mid-session.
 */

const CACHE_NAME = "cashflow-runtime";

self.addEventListener("install", () => {
  // Deliberately no skipWaiting() here — see the file comment.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // The API must always be live data, never a cached response — sync and
  // the ledger's own correctness depend on that.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // A navigation with nothing cached yet falls back to the app shell
        // itself, so a first-ever offline load still opens the app instead
        // of a browser error page.
        if (event.request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw new Error("offline and nothing cached");
      }),
  );
});
