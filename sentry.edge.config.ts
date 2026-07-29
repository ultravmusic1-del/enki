import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, tracesSampleRate } from "./src/lib/sentry";

// Edge runtime — src/proxy.ts runs here. Loaded by instrumentation.ts.
Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate,
  enabled: process.env.NODE_ENV === "production",
});
