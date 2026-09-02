/**
 * The Worker.
 *
 * It serves the built app as static assets and answers exactly one API route.
 * Everything else the app does happens in the browser, which is why there is
 * no session, no user table and no login to get wrong.
 */

import { evictStaleSpaces, handleSync, shouldEvict, type SyncEnv } from "./sync.ts";

interface Env extends SyncEnv {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/sync") {
      const response = await handleSync(request, env);
      if (shouldEvict()) {
        // After the response, never in front of it: housekeeping should not
        // put latency on someone waiting to see their bills.
        ctx.waitUntil(
          evictStaleSpaces(env).catch(() => {
            // A failed sweep is retried by the next request that samples in.
          }),
        );
      }
      return response;
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    // Anything else is the single-page app, handled by the assets binding.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
