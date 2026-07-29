import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  tracesSampleRate,
} from "./lib/sentry";

/**
 * Browser SDK.
 *
 * Session Replay is deliberately not enabled. It is the heaviest thing this SDK
 * ships, and the homepage already carries a three.js hero that dominates the
 * LCP budget. Add it later if a bug genuinely cannot be diagnosed without it,
 * and measure the cost with the Speed Insights already installed.
 */
Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate,
  enabled: process.env.NODE_ENV === "production",
});

/** Ties client-side navigations into the performance trace. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
