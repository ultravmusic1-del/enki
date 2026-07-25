import { categories as rawCategories } from "@/data/categories";
import { authors as rawAuthors } from "@/data/authors";
import { tools as rawTools } from "@/data/tools";
import { reviews as rawReviews } from "@/data/reviews";
import {
  authorSchema,
  categorySchema,
  reviewSchema,
  toolSchema,
  type Author,
  type Category,
  type Review,
  type Tool,
} from "@/lib/schemas";
import { createAnonClient } from "@/lib/supabase/anon";
import { z } from "zod";

/* =========================================================================
   Enki content-access layer

   Tools are DB-preferred with a static-seed fallback: the seed in `src/data/*`
   is the git-versioned base, and rows in the Supabase `tools` table override a
   tool by slug (or add a new one). If the database is empty or unreachable —
   including when the project is paused — reads fall back to the seed, so the
   site never breaks. Categories/authors/reviews remain seed-only for now.

   Everything is validated against the Zod schemas, so bad DB or seed data never
   reaches a page.
   ========================================================================= */

/**
 * Validate git-versioned seed content. Always throws on bad data, including in
 * production: `next build` runs with NODE_ENV=production, so a lenient path
 * here means the authoritative build is the one that skips the check. Bad seed
 * data should fail the build, not reach a page.
 *
 * Database-sourced tools do NOT come through here — they are safeParsed and
 * skipped individually in loadDbTools, so one bad row can never take the site
 * down.
 */
function validate<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  return rows.map((row, i) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new Error(
        `[Enki content] Invalid ${label} at index ${i}:\n${z.prettifyError(
          result.error,
        )}`,
      );
    }
    return result.data;
  });
}

const categories = validate(categorySchema, rawCategories, "category");
const authors = validate(authorSchema, rawAuthors, "author");
const seedTools = validate(toolSchema, rawTools, "tool");
const reviews = validate(reviewSchema, rawReviews, "review");

// Referential integrity: every seed tool points at a real category; every seed
// review at a real tool + author. Unconditional for the same reason as the
// validation above — a dangling reference must fail the build, not ship.
{
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const toolSlugs = new Set(seedTools.map((t) => t.slug));
  const authorIds = new Set(authors.map((a) => a.id));

  for (const tool of seedTools) {
    if (!categorySlugs.has(tool.categorySlug)) {
      throw new Error(
        `[Enki content] Tool "${tool.slug}" references unknown category "${tool.categorySlug}"`,
      );
    }
  }
  for (const review of reviews) {
    if (!toolSlugs.has(review.toolSlug)) {
      throw new Error(
        `[Enki content] Review "${review.id}" references unknown tool "${review.toolSlug}"`,
      );
    }
    if (!authorIds.has(review.authorId)) {
      throw new Error(
        `[Enki content] Review "${review.id}" references unknown author "${review.authorId}"`,
      );
    }
  }
}

/* --------------------------------------------------- DB-preferred tool loading */

/** Give up on the DB after this long so a paused project can't stall a render. */
const DB_TIMEOUT_MS = 2500;
/** Short TTL so one build/request batch hits the DB once, and edits still land. */
const CACHE_TTL_MS = 60_000;

let toolCache: { at: number; tools: Tool[] } | null = null;

async function loadDbTools(): Promise<Tool[]> {
  try {
    const supabase = createAnonClient();
    const query = supabase.from("tools").select("slug, data").eq("published", true);
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), DB_TIMEOUT_MS),
    );
    const result = await Promise.race([query, timeout]);
    if (!result || result.error || !result.data) return [];

    const out: Tool[] = [];
    for (const row of result.data) {
      const parsed = toolSchema.safeParse(row.data);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The effective tool set: seed as the base, DB rows overriding by slug (and
 * adding new tools). Falls back to pure seed when the DB is empty/unreachable.
 * TTL-cached so a build doesn't hammer the DB and a paused DB stalls at most one
 * render.
 */
async function loadTools(): Promise<Tool[]> {
  if (toolCache && Date.now() - toolCache.at < CACHE_TTL_MS) {
    return toolCache.tools;
  }
  const db = await loadDbTools();
  let tools: Tool[];
  if (db.length === 0) {
    tools = seedTools;
  } else {
    const bySlug = new Map(seedTools.map((t) => [t.slug, t]));
    for (const t of db) bySlug.set(t.slug, t);
    tools = [...bySlug.values()];
  }
  toolCache = { at: Date.now(), tools };
  return tools;
}

/**
 * Drop the tool cache (call after an admin write so edits appear immediately).
 *
 * Note: this clears the module-level cache in ONE serverless instance. Other
 * warm instances keep serving their cached copy for up to CACHE_TTL_MS, so a
 * fresh edit can take up to a minute to appear everywhere. Self-healing, and
 * acceptable at this scale — if it stops being so, key the cache on a version
 * row bumped by saveTool rather than on wall-clock time.
 */
export function invalidateToolCache() {
  toolCache = null;
}

/* ------------------------------------------------------------------- tools */

export async function getAllTools(): Promise<Tool[]> {
  return [...(await loadTools())].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getToolBySlug(slug: string): Promise<Tool | undefined> {
  return (await loadTools()).find((t) => t.slug === slug);
}

export async function getFeaturedTools(): Promise<Tool[]> {
  return (await loadTools())
    .filter((t) => t.featured)
    .sort((a, b) => b.rating - a.rating);
}

export async function getToolsByCategory(categorySlug: string): Promise<Tool[]> {
  return (await getAllTools()).filter((t) => t.categorySlug === categorySlug);
}

/**
 * Related tools — same category first (by rating), topped up with the highest
 * rated tools elsewhere until we have `n`. Never includes the source tool.
 */
export async function getRelatedTools(tool: Tool, n = 3): Promise<Tool[]> {
  const all = await loadTools();
  const sameCategory = all
    .filter((t) => t.categorySlug === tool.categorySlug && t.slug !== tool.slug)
    .sort((a, b) => b.rating - a.rating);

  const fillers = all
    .filter(
      (t) => t.categorySlug !== tool.categorySlug && t.slug !== tool.slug,
    )
    .sort((a, b) => b.rating - a.rating);

  return [...sameCategory, ...fillers].slice(0, n);
}

/* -------------------------------------------------------------- categories */

export type CategoryWithCount = Category & { toolCount: number };

export async function getCategories(): Promise<CategoryWithCount[]> {
  const all = await loadTools();
  return categories
    .map((c) => ({
      ...c,
      toolCount: all.filter((t) => t.categorySlug === c.slug).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryWithCount | undefined> {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return undefined;
  const all = await loadTools();
  return {
    ...category,
    toolCount: all.filter((t) => t.categorySlug === category.slug).length,
  };
}

/** Synchronous list of category slugs — safe for generateStaticParams. */
export function getCategorySlugs(): string[] {
  return categories.map((c) => c.slug);
}

/* ----------------------------------------------------------------- authors */

export function getAuthorById(id: string): Author | undefined {
  return authors.find((a) => a.id === id);
}

/* ----------------------------------------------------------------- reviews */

export type ReviewWithAuthor = Review & { author: Author | undefined };

export function getReviewsForTool(slug: string): ReviewWithAuthor[] {
  return reviews
    .filter((r) => r.toolSlug === slug)
    .map((r) => ({ ...r, author: getAuthorById(r.authorId) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ------------------------------------------------------------ leaderboards */

export type LeaderboardEntry = {
  rank: number;
  slug: string;
  name: string;
  tagline: string;
  logo?: string;
  accent: string;
  categoryName: string;
  editorScore: number;
  rating: number;
  reviewCount: number;
  editorRank: number;
  userRank: number;
};

export type Leaderboards = {
  editor: LeaderboardEntry[];
  user: LeaderboardEntry[];
};

/**
 * Two rankings of the same tool set — the editors' scores and the community
 * ratings. Full orderings are computed first (so every entry can carry its
 * standing on the other board), then sliced to `limit`.
 */
export async function getLeaderboards(limit = 15): Promise<Leaderboards> {
  const tools = await loadTools();
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  const byEditor = [...tools].sort(
    (a, b) =>
      b.editorScore - a.editorScore ||
      b.rating - a.rating ||
      b.reviewCount - a.reviewCount ||
      a.name.localeCompare(b.name),
  );
  const byUser = [...tools].sort(
    (a, b) =>
      b.rating - a.rating ||
      b.reviewCount - a.reviewCount ||
      b.editorScore - a.editorScore ||
      a.name.localeCompare(b.name),
  );

  const editorRankOf = new Map(byEditor.map((t, i) => [t.slug, i + 1]));
  const userRankOf = new Map(byUser.map((t, i) => [t.slug, i + 1]));

  const toEntry = (t: Tool, rank: number): LeaderboardEntry => ({
    rank,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    logo: t.logo,
    accent: t.accent,
    categoryName: categoryName.get(t.categorySlug) ?? "",
    editorScore: t.editorScore,
    rating: t.rating,
    reviewCount: t.reviewCount,
    editorRank: editorRankOf.get(t.slug) ?? 0,
    userRank: userRankOf.get(t.slug) ?? 0,
  });

  return {
    editor: byEditor.slice(0, limit).map((t, i) => toEntry(t, i + 1)),
    user: byUser.slice(0, limit).map((t, i) => toEntry(t, i + 1)),
  };
}

/* --------------------------------------------------------------- comparison */

export type CompareTool = {
  slug: string;
  name: string;
  tagline: string;
  logo?: string;
  accent: string;
  categoryName: string;
  editorScore: number;
  rating: number;
  reviewCount: number;
  pricingModel: Tool["pricing"]["model"];
  startingPrice?: string;
  hasFreeTrial: boolean;
  platforms: string[];
  pros: string[];
  cons: string[];
  website: string;
  isAffiliate: boolean;
};

/** Compact, serializable rows for the /compare table (all tools, A→Z). */
export async function getCompareTools(): Promise<CompareTool[]> {
  const tools = await loadTools();
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));
  return [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      tagline: t.tagline,
      logo: t.logo,
      accent: t.accent,
      categoryName: categoryName.get(t.categorySlug) ?? "",
      editorScore: t.editorScore,
      rating: t.rating,
      reviewCount: t.reviewCount,
      pricingModel: t.pricing.model,
      startingPrice: t.pricing.startingPrice,
      hasFreeTrial: t.pricing.hasFreeTrial ?? false,
      platforms: t.platforms,
      pros: t.pros.slice(0, 3),
      cons: t.cons.slice(0, 3),
      website: t.website,
      isAffiliate: Boolean(t.affiliateUrl),
    }));
}

/* -------------------------------------------------------------------- stats */

export type SiteStats = {
  toolCount: number;
  categoryCount: number;
  reviewCount: number;
  averageRating: number;
};

export async function getStats(): Promise<SiteStats> {
  const tools = await loadTools();
  const reviewCount = tools.reduce((sum, t) => sum + t.reviewCount, 0);
  const averageRating =
    tools.reduce((sum, t) => sum + t.rating, 0) / (tools.length || 1);
  return {
    toolCount: tools.length,
    categoryCount: categories.length,
    reviewCount,
    averageRating: Math.round(averageRating * 10) / 10,
  };
}

/* --------------------------------------------------------------- search */

export type SearchDoc = {
  type: "tool" | "category";
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category?: string;
  tags: string[];
  accent: string;
  rating?: number;
  icon?: string;
  logo?: string;
  href: string;
};

/** Lightweight documents for client-side Fuse.js fuzzy search. */
export async function getSearchDocs(): Promise<SearchDoc[]> {
  const tools = await loadTools();
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  const toolDocs: SearchDoc[] = tools.map((t) => ({
    type: "tool",
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    category: categoryName.get(t.categorySlug),
    tags: t.tags,
    accent: t.accent,
    rating: t.rating,
    logo: t.logo,
    href: `/tools/${t.slug}`,
  }));

  const categoryDocs: SearchDoc[] = categories.map((c) => ({
    type: "category",
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    tags: [],
    accent: c.accent,
    icon: c.icon,
    href: `/categories/${c.slug}`,
  }));

  return [...toolDocs, ...categoryDocs];
}
