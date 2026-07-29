import * as Sentry from "@sentry/nextjs";

/**
 * Next.js calls this once per runtime at startup. The dynamic imports matter:
 * the edge bundle must not pull in the Node SDK, and vice versa.
 *
 * This file MUST live in `src/`, not the repo root. Next looks for
 * instrumentation at the root *or* inside `src/` when a src directory exists —
 * and this project has one. At the root it was still compiled into the build,
 * which made it look correct, but `register()` was never invoked: Sentry.init
 * never ran, so no error, trace or cron check-in ever left the server. The
 * symptom was total silence, including with `debug: true`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Reports errors thrown inside React Server Components, route handlers and
 * server actions — which Next otherwise swallows into a generic digest that is
 * useless for debugging.
 */
export const onRequestError = Sentry.captureRequestError;
