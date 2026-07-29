import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  tracesSampleRate,
} from "./src/lib/sentry";

// Edge runtime — src/proxy.ts runs here. Loaded by src/instrumentation.ts.
Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate,
  enabled: process.env.NODE_ENV === "production",
});
