import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { CANONICAL_SITE_URL } from "./src/lib/site";
import {
  SENTRY_INGEST_ORIGIN,
  SENTRY_TUNNEL_ROUTE,
  securityReportUrl,
} from "./src/lib/sentry";

/**
 * Where browsers post CSP violation reports.
 *
 * The environment is baked into the URL so production noise and local
 * experimentation stay separable in Sentry.
 */
const reportUri = securityReportUrl(
  process.env.VERCEL_ENV === "production" ? "production" : "development",
);

/**
 * Report-only to start. Enforcing requires removing `'unsafe-inline'` from
 * script-src, which needs nonce propagation through proxy.ts for Next's inline
 * hydration scripts. Until then this policy is measurement, plus the directives
 * that cost nothing to enforce anyway.
 *
 * Note: with `'unsafe-inline'` present this does NOT block `javascript:` URLs.
 * That hole is closed in src/lib/safe-url.ts and the tool_submissions CHECK
 * constraint, not here. What this does buy today is object-src 'none',
 * base-uri 'self' (blocks base-tag injection), form-action 'self' (blocks
 * form-hijack exfiltration), and frame-ancestors 'self'.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  // Sentry error events are NOT sent cross-origin: tunnelRoute proxies them
  // through this origin, so 'self' covers them. The ingest origin is listed
  // only because the browser posts CSP reports to it directly.
  `connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com ${SENTRY_INGEST_ORIGIN}`,
  "worker-src 'self' blob:",
  // `upgrade-insecure-requests` is deliberately absent: browsers ignore it in a
  // report-only policy and log a console error on every page for it. Add it
  // when this policy moves to enforcing. HSTS already covers the live site.

  // Both directives on purpose. `report-uri` is deprecated but universally
  // supported; `report-to` is the replacement and reached broad support in
  // March 2026. Naming both means current browsers report today and newer ones
  // use the modern path. Until this policy named a collector, every violation
  // the browser computed was discarded -- the data needed to write an enforcing
  // nonce-based policy never existed.
  `report-uri ${reportUri}`,
  "report-to csp-endpoint",
].join("; ");

// Applied to every route.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Declares the group `report-to` above refers to. Without this header the
  // report-to directive names a group that does not exist and is ignored.
  {
    key: "Reporting-Endpoints",
    value: `csp-endpoint="${reportUri}"`,
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

/**
 * The project's original Vercel alias. It still serves a complete second copy of
 * every URL on the site, competing with enkitools.com for the same ranking
 * signal, so it is permanently redirected rather than left to be indexed.
 *
 * next.config redirects are evaluated before middleware, so a bounced request
 * never runs the Supabase session refresh in src/proxy.ts. The host condition
 * matches only this exact alias: preview deployments and localhost are
 * untouched, and no loop is possible because enkitools.com never matches it.
 */
const LEGACY_HOST = "enki-five.vercel.app";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: LEGACY_HOST }],
        destination: `${CANONICAL_SITE_URL}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "enki-tools",
  project: "enki",

  // Quiet locally, verbose in CI where the output is the only diagnostic.
  silent: !process.env.CI,

  // Proxies events through this origin. Two wins: ad blockers cannot drop them,
  // and connect-src stays 'self' rather than gaining a third-party origin in a
  // policy this project intends to tighten. src/proxy.ts excludes this path.
  tunnelRoute: SENTRY_TUNNEL_ROUTE,

  // Strips the SDK's own debug/logging statements from the production bundle.
  disableLogger: true,

  // Source maps are uploaded only when SENTRY_AUTH_TOKEN is present, so local
  // and fork builds succeed without it; production stack traces stay readable.
  widenClientFileUpload: true,
});
