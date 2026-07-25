/**
 * The site's canonical origin, with no trailing slash.
 *
 * This is not cosmetic: it backs every `<link rel="canonical">`, the sitemap,
 * robots.txt, the absolute OG/Twitter image URLs, and the `/go/[slug]` fallback
 * redirect. Hard-coding a domain the deployment does not actually serve tells
 * search engines the real page lives somewhere else and sends users to a dead
 * host, so it is resolved from the environment instead.
 *
 * Order of preference:
 *  1. `NEXT_PUBLIC_SITE_URL` — set this once you own a custom domain.
 *  2. Vercel's own production domain, which it injects automatically, so a
 *     fresh deploy is correct with no configuration.
 *  3. localhost for local development.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel exposes the stable production domain (bare host, no protocol). The
  // NEXT_PUBLIC_ copy exists when "Automatically expose System Environment
  // Variables" is on (the default); the bare one covers server-only rendering.
  const vercelHost =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;

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
