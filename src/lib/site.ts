export const siteConfig = {
  name: "Enki",
  tagline: "Wisdom for the age of AI",
  description:
    "Enki is the oracle for AI tools: a curated, human-vetted directory to discover, compare, and trust the tools shaping the future of work.",
  url: "https://enki.tools",
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
