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
import { z } from "zod";

/* =========================================================================
   Enki content-access layer

   Functions here are deliberately named and shaped like GROQ queries so that
   swapping the local seed for a live Sanity dataset later is a matter of
   changing these implementations — not the pages that call them.

   Seed data is validated against the Zod schemas at module load. In dev, a
   mismatch throws loudly so bad data never reaches a page.
   ========================================================================= */

function validate<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  return rows.map((row, i) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const message = `[Enki content] Invalid ${label} at index ${i}:\n${z.prettifyError(
        result.error,
      )}`;
      // Fail loudly in development so bad seed data is caught immediately.
      if (process.env.NODE_ENV !== "production") throw new Error(message);
      console.error(message);
      return row as T;
    }
    return result.data;
  });
}

const categories = validate(categorySchema, rawCategories, "category");
const authors = validate(authorSchema, rawAuthors, "author");
const tools = validate(toolSchema, rawTools, "tool");
const reviews = validate(reviewSchema, rawReviews, "review");

// Referential integrity: every tool points at a real category; every review at
// a real tool + author. Catch dangling references in dev too.
if (process.env.NODE_ENV !== "production") {
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const toolSlugs = new Set(tools.map((t) => t.slug));
  const authorIds = new Set(authors.map((a) => a.id));

  for (const tool of tools) {
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

/* ------------------------------------------------------------------- tools */

export function getAllTools(): Tool[] {
  return [...tools].sort((a, b) => a.name.localeCompare(b.name));
}

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getFeaturedTools(): Tool[] {
  return tools
    .filter((t) => t.featured)
    .sort((a, b) => b.rating - a.rating);
}

export function getToolsByCategory(categorySlug: string): Tool[] {
  return getAllTools().filter((t) => t.categorySlug === categorySlug);
}

/**
 * Related tools — same category first (by rating), topped up with the highest
 * rated tools elsewhere until we have `n`. Never includes the source tool.
 */
export function getRelatedTools(tool: Tool, n = 3): Tool[] {
  const sameCategory = tools
    .filter((t) => t.categorySlug === tool.categorySlug && t.slug !== tool.slug)
    .sort((a, b) => b.rating - a.rating);

  const fillers = tools
    .filter(
      (t) => t.categorySlug !== tool.categorySlug && t.slug !== tool.slug,
    )
    .sort((a, b) => b.rating - a.rating);

  return [...sameCategory, ...fillers].slice(0, n);
}

/* -------------------------------------------------------------- categories */

export type CategoryWithCount = Category & { toolCount: number };

export function getCategories(): CategoryWithCount[] {
  return categories
    .map((c) => ({
      ...c,
      toolCount: tools.filter((t) => t.categorySlug === c.slug).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCategoryBySlug(
  slug: string,
): CategoryWithCount | undefined {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return undefined;
  return {
    ...category,
    toolCount: tools.filter((t) => t.categorySlug === category.slug).length,
  };
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
    .sort(
      (a, b) => b.helpful - a.helpful || b.date.localeCompare(a.date),
    );
}

/**
 * Synthesize a plausible 5-bucket star distribution from the aggregate rating
 * and review count. Deterministic — same inputs always yield the same buckets,
 * and the buckets sum exactly to `reviewCount`.
 *
 * Returns buckets ordered 5★ → 1★.
 */
export function getRatingDistribution(
  rating: number,
  reviewCount: number,
): { star: number; count: number; pct: number }[] {
  const stars = [5, 4, 3, 2, 1];

  if (reviewCount <= 0) {
    return stars.map((star) => ({ star, count: 0, pct: 0 }));
  }

  // Weight each star bucket by a Gaussian centred on the mean rating. Tighter
  // spread for higher ratings so top-rated tools skew convincingly to 5★.
  const spread = 1.15;
  const weights = stars.map((star) =>
    Math.exp(-((star - rating) ** 2) / (2 * spread * spread)),
  );
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Floor each bucket, then distribute the leftover to the largest fractional
  // parts so the counts sum exactly to reviewCount.
  const exact = weights.map((w) => (w / weightSum) * reviewCount);
  const counts = exact.map(Math.floor);
  let remainder = reviewCount - counts.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    counts[order[k].i] += 1;
  }

  return stars.map((star, i) => ({
    star,
    count: counts[i],
    pct: reviewCount ? (counts[i] / reviewCount) * 100 : 0,
  }));
}

/* -------------------------------------------------------------------- stats */

export type SiteStats = {
  toolCount: number;
  categoryCount: number;
  reviewCount: number;
  averageRating: number;
};

export function getStats(): SiteStats {
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
  /** Lucide icon name (categories only). */
  icon?: string;
  href: string;
};

/** Lightweight documents for client-side Fuse.js fuzzy search. */
export function getSearchDocs(): SearchDoc[] {
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
