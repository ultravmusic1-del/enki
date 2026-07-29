import * as Sentry from "@sentry/nextjs";

/**
 * Next.js calls this once per runtime at startup. The dynamic imports matter:
 * the edge bundle must not pull in the Node SDK, and vice versa.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Reports errors thrown inside React Server Components, route handlers and
 * server actions — which Next otherwise swallows into a generic digest that is
 * useless for debugging.
 */
export const onRequestError = Sentry.captureRequestError;
