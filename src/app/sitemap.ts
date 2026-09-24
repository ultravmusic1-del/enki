import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { getAllTools, getCategories } from "@/lib/content";
import { versusPairs, versusSlug } from "@/lib/seo";
import { beats } from "@/data/beats";
import { listActiveBeats, listIndexableStories } from "@/lib/news/stories";
import { lastUpdatedAt } from "@/data/newsroom";

// Hourly: stories are published daily, and only indexable ones are listed.
export const revalidate = 3600;

/** Generated at build time; regenerates when tool/category content changes. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const now = new Date();
  const allTools = await getAllTools();
  const allCategories = await getCategories();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1 },
    { path: "/tools", priority: 0.9 },
    { path: "/finder", priority: 0.9 },
    { path: "/deals", priority: 0.8 },
    { path: "/submit", priority: 0.5 },
    { path: "/categories", priority: 0.8 },
    { path: "/compare", priority: 0.7 },
    { path: "/leaderboards", priority: 0.7 },
  ].map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  }));

  const tools: MetadataRoute.Sitemap = allTools.map((t) => ({
    url: `${base}/tools/${t.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const categories: MetadataRoute.Sitemap = allCategories.map((c) => ({
    url: `${base}/categories/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const best: MetadataRoute.Sitemap = allCategories.map((c) => ({
    url: `${base}/best/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const alternatives: MetadataRoute.Sitemap = allTools.map((t) => ({
    url: `${base}/alternatives/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const versus: MetadataRoute.Sitemap = versusPairs(allTools).map(
    ([a, b]) => ({
      url: `${base}/vs/${versusSlug(a.slug, b.slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    }),
  );

  // Empty beats 404, so only beats with stories are listed (all of them if the read failed).
  const activeBeats = await listActiveBeats();
  const news: MetadataRoute.Sitemap = [
    { url: `${base}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/news/about`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/news/corrections`, lastModified: now, changeFrequency: "weekly", priority: 0.3 },
    ...beats.filter((beat) => !activeBeats || activeBeats.includes(beat.slug)).map((beat) => ({
      url: `${base}/news/beat/${beat.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  // Only stories with an indexable take (spec §6.1). Archive pages 2+ are
  // noindex, so they are not listed.
  const stories: MetadataRoute.Sitemap = (await listIndexableStories()).map((story) => ({
    url: `${base}/news/${story.slug}`,
    lastModified: new Date(lastUpdatedAt(story.slug) ?? story.publishedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...tools,
    ...categories,
    ...best,
    ...alternatives,
    ...versus,
    ...news,
    ...stories,
  ];
}
