/* =========================================================================
   Shared Sentry configuration.

   Imported by the three root SDK entry points (instrumentation-client.ts,
   sentry.server.config.ts, sentry.edge.config.ts) and by next.config.ts for
   the CSP reporting endpoint, so the DSN is stated once.
   ========================================================================= */

/**
 * The Sentry DSN.
 *
 * Committed rather than read from the environment, deliberately, and on the
 * same reasoning as CANONICAL_SITE_URL and the IndexNow key: a DSN is public.
 * It is compiled into the client bundle and visible to anyone who opens
 * devtools. It authorises *sending* events to this project and nothing else —
 * it grants no read access and cannot be used to query data.
 *
 * The failure mode this avoids is the one that already bit this project once:
 * an unset environment variable silently degrading behaviour with nothing to
 * catch it. Here that would mean errors vanishing instead of being reported,
 * which is precisely the outcome installing Sentry is meant to prevent.
 *
 * The genuine secret is SENTRY_AUTH_TOKEN, used only at build time to upload
 * source maps. That lives in Vercel's environment variables and never here.
 */
export const SENTRY_DSN =
  "https://ad33608c3114e94b0966ee9c0c4bfc40@o4511818107584512.ingest.us.sentry.io/4511818123247616";

/** Parsed once so the pieces below cannot disagree with the DSN above. */
const dsn = new URL(SENTRY_DSN);

/** The public key — the DSN's username component. */
const publicKey = dsn.username;

/** Numeric project id — the DSN's path. */
const projectId = dsn.pathname.replace(/^\//, "");

/** Sentry's ingest origin, e.g. https://o123.ingest.us.sentry.io */
export const SENTRY_INGEST_ORIGIN = dsn.origin;

/**
 * Browser CSP violation reports go here.
 *
 * Enki's CSP has been report-only since it was introduced but never named a
 * collector, so every violation the browser computed was discarded. Pointing
 * the policy here turns it into data — which is what a nonce-based enforcing
 * policy needs before it can be written without guessing.
 */
export function securityReportUrl(environment: string): string {
  return `${SENTRY_INGEST_ORIGIN}/api/${projectId}/security/?sentry_key=${publicKey}&sentry_environment=${environment}`;
}

/**
 * Where the SDK sends events. Requests are proxied through this same-origin
 * path rather than straight to Sentry, which keeps `connect-src 'self'`
 * sufficient — no third-party origin added to a policy this project is trying
 * to tighten — and stops ad blockers dropping events.
 *
 * src/proxy.ts must exclude this path, or every event would run a Supabase
 * session refresh on its way out.
 */
export const SENTRY_TUNNEL_ROUTE = "/sentry-tunnel";

/**
 * Fraction of transactions sampled for performance data. Full sampling locally
 * where volume is trivial; a tenth in production to stay inside the free plan's
 * quota while still surfacing slow routes.
 */
export const tracesSampleRate = process.env.NODE_ENV === "production" ? 0.1 : 1;
