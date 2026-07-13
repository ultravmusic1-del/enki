export const siteConfig = {
  name: "Enki",
  tagline: "Wisdom for the age of AI",
  description:
    "Enki is the oracle for AI tools — a curated, human-vetted directory to discover, compare, and trust the tools shaping the future of work.",
  url: "https://enki.tools",
  ogImage: "/brand/logo.png",
  nav: [
    { title: "Directory", href: "/tools" },
    { title: "Categories", href: "/categories" },
    { title: "How we vet", href: "/#how-we-vet" },
  ],
  social: {
    twitter: "https://twitter.com",
    github: "https://github.com",
    linkedin: "https://linkedin.com",
  },
} as const;

export type SiteConfig = typeof siteConfig;
