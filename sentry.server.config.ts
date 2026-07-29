import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  tracesSampleRate,
} from "./src/lib/sentry";

// Node runtime. Loaded by src/instrumentation.ts's register().
Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate,
  // Errors thrown while developing are already visible in the terminal; sending
  // them would burn quota and bury real production issues in noise.
  enabled: process.env.NODE_ENV === "production",
});
