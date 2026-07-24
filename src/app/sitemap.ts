import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { getAllTools, getCategories } from "@/lib/content";
import { versusPairs, versusSlug } from "@/lib/seo";

/** Generated at build time; regenerates when tool/category content changes. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1 },
    { path: "/tools", priority: 0.9 },
    { path: "/finder", priority: 0.9 },
    { path: "/categories", priority: 0.8 },
    { path: "/compare", priority: 0.7 },
    { path: "/leaderboards", priority: 0.7 },
  ].map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  }));

  const tools: MetadataRoute.Sitemap = getAllTools().map((t) => ({
    url: `${base}/tools/${t.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const categories: MetadataRoute.Sitemap = getCategories().map((c) => ({
    url: `${base}/categories/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const best: MetadataRoute.Sitemap = getCategories().map((c) => ({
    url: `${base}/best/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const alternatives: MetadataRoute.Sitemap = getAllTools().map((t) => ({
    url: `${base}/alternatives/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const versus: MetadataRoute.Sitemap = versusPairs(getAllTools()).map(
    ([a, b]) => ({
      url: `${base}/vs/${versusSlug(a.slug, b.slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    }),
  );

  return [
    ...staticRoutes,
    ...tools,
    ...categories,
    ...best,
    ...alternatives,
    ...versus,
  ];
}
