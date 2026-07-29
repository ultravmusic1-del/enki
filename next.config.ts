import type { NextConfig } from "next";
import { CANONICAL_SITE_URL } from "./src/lib/site";

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
  "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  // `upgrade-insecure-requests` is deliberately absent: browsers ignore it in a
  // report-only policy and log a console error on every page for it. Add it
  // when this policy moves to enforcing. HSTS already covers the live site.
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

export default nextConfig;
