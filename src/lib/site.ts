/**
 * The domain Enki owns and serves from.
 *
 * Committed rather than left to configuration on purpose. An unset
 * `NEXT_PUBLIC_SITE_URL` is exactly how every canonical, sitemap entry, robots
 * directive and JSON-LD `@id` came to point at the Vercel subdomain while the
 * site was already serving from this domain — telling search engines the real
 * page lived somewhere else. A production build is now correct with no
 * dashboard configuration at all.
 */
export const CANONICAL_SITE_URL = "https://enkitools.com";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * The site's canonical origin, with no trailing slash.
 *
 * This is not cosmetic: it backs every `<link rel="canonical">`, the sitemap,
 * robots.txt, `llms.txt`, the absolute OG/Twitter image URLs, all JSON-LD
 * identifiers, and the `/go/[slug]` fallback redirect.
 *
 * Order of preference:
 *  1. `NEXT_PUBLIC_SITE_URL` — an explicit override, e.g. a staging origin.
 *  2. Vercel preview deployments — their own origin, so a preview can never
 *     claim the production canonical.
 *  3. Any production build — the committed canonical above.
 *  4. Local development.
 *
 * Step 3 keys off `NODE_ENV`, not `VERCEL_ENV`, deliberately. This module is
 * imported by `site-footer.tsx`, a client component, so it is evaluated in the
 * browser bundle as well as on the server — and Next only inlines `NEXT_PUBLIC_*`
 * variables there. A bare `VERCEL_ENV` read would be `undefined` client-side and
 * resolve a different origin than the server did, which is a hydration mismatch.
 * `NODE_ENV` is inlined identically on both sides.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);

  // The NEXT_PUBLIC_ copies exist when "Automatically expose System Environment
  // Variables" is on (the default); the bare ones cover server-only rendering.
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (vercelEnv === "preview") {
    const previewHost =
      process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
    if (previewHost) return `https://${stripTrailingSlash(previewHost)}`;
  }

  if (process.env.NODE_ENV === "production") return CANONICAL_SITE_URL;

  return "http://localhost:3000";
}

export const siteConfig = {
  name: "Enki",
  tagline: "Wisdom for the age of AI",
  description:
    "Enki is the oracle for AI tools: a curated, human-vetted directory to discover, compare, and trust the tools shaping the future of work.",
  url: resolveSiteUrl(),
  ogImage: "/brand/logo.png",
  /**
   * Whether the aggregate `rating` / `reviewCount` carried on each tool reflect
   * real, verifiable user reviews.
   *
   * While the directory ships with editorial sample figures this stays FALSE and
   * no AggregateRating / Review markup is emitted. Structured data is a
   * machine-readable claim to search engines: marking up ratings that are not
   * genuine violates Google's review-snippet policy and, on a site that earns
   * affiliate revenue from those rankings, is an FTC exposure.
   *
   * Flip to true only once `rating` and `reviewCount` are computed from real
   * moderated reviews.
   */
  hasVerifiedRatings: false,
  nav: [
    { title: "Directory", href: "/tools" },
    { title: "Finder", href: "/finder" },
    { title: "Categories", href: "/categories" },
    { title: "Compare", href: "/compare" },
    { title: "Leaderboards", href: "/leaderboards" },
  ],
  social: {
    twitter: "https://twitter.com",
    github: "https://github.com",
    linkedin: "https://linkedin.com",
  },
} as const;

export type SiteConfig = typeof siteConfig;
