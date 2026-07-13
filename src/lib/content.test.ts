import { describe, it, expect } from "vitest";
import {
  getAllTools,
  getToolBySlug,
  getFeaturedTools,
  getCategories,
  getCategoryBySlug,
  getToolsByCategory,
  getRelatedTools,
  getReviewsForTool,
  getRatingDistribution,
  getStats,
  getSearchDocs,
} from "@/lib/content";

describe("content: tools", () => {
  it("returns tools sorted by name", () => {
    const tools = getAllTools();
    expect(tools.length).toBeGreaterThanOrEqual(24);
    const names = tools.map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("looks up a tool by slug", () => {
    expect(getToolBySlug("cursor")?.name).toBe("Cursor");
    expect(getToolBySlug("does-not-exist")).toBeUndefined();
  });

  it("returns only featured tools, highest rated first", () => {
    const featured = getFeaturedTools();
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((t) => t.featured)).toBe(true);
    for (let i = 1; i < featured.length; i++) {
      expect(featured[i - 1].rating).toBeGreaterThanOrEqual(featured[i].rating);
    }
  });
});

describe("content: categories", () => {
  it("returns categories with accurate tool counts", () => {
    const categories = getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(6);
    for (const cat of categories) {
      expect(cat.toolCount).toBe(getToolsByCategory(cat.slug).length);
    }
  });

  it("sums tool counts to the total tool count", () => {
    const total = getCategories().reduce((sum, c) => sum + c.toolCount, 0);
    expect(total).toBe(getAllTools().length);
  });

  it("resolves a category by slug", () => {
    expect(getCategoryBySlug("coding")?.name).toBe("Coding & Dev");
    expect(getCategoryBySlug("nope")).toBeUndefined();
  });
});

describe("content: related tools", () => {
  it("never includes the source tool and respects the count", () => {
    const tool = getToolBySlug("cursor")!;
    const related = getRelatedTools(tool, 3);
    expect(related).toHaveLength(3);
    expect(related.some((t) => t.slug === tool.slug)).toBe(false);
  });

  it("prefers tools from the same category", () => {
    const tool = getToolBySlug("cursor")!;
    const related = getRelatedTools(tool, 3);
    // The coding category has several tools, so the first result should share it.
    expect(related[0].categorySlug).toBe(tool.categorySlug);
  });
});

describe("content: reviews", () => {
  it("returns authored reviews with resolved authors, sorted by helpful", () => {
    const reviews = getReviewsForTool("cursor");
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0].author?.name).toBeTruthy();
    for (let i = 1; i < reviews.length; i++) {
      expect(reviews[i - 1].helpful).toBeGreaterThanOrEqual(reviews[i].helpful);
    }
  });
});

describe("content: rating distribution", () => {
  it("buckets sum exactly to the review count", () => {
    for (const [rating, count] of [
      [4.7, 2450],
      [4.0, 720],
      [4.3, 1],
      [3.5, 7],
    ] as const) {
      const dist = getRatingDistribution(rating, count);
      const sum = dist.reduce((s, b) => s + b.count, 0);
      expect(sum).toBe(count);
    }
  });

  it("returns buckets ordered 5 to 1 star", () => {
    const dist = getRatingDistribution(4.5, 100);
    expect(dist.map((b) => b.star)).toEqual([5, 4, 3, 2, 1]);
  });

  it("skews toward higher stars for a high rating", () => {
    const dist = getRatingDistribution(4.7, 1000);
    const fiveStar = dist.find((b) => b.star === 5)!.count;
    const oneStar = dist.find((b) => b.star === 1)!.count;
    expect(fiveStar).toBeGreaterThan(oneStar);
  });

  it("handles a zero review count", () => {
    const dist = getRatingDistribution(0, 0);
    expect(dist.every((b) => b.count === 0 && b.pct === 0)).toBe(true);
  });

  it("is deterministic", () => {
    const a = getRatingDistribution(4.2, 843);
    const b = getRatingDistribution(4.2, 843);
    expect(a).toEqual(b);
  });
});

describe("content: stats & search", () => {
  it("computes site stats", () => {
    const stats = getStats();
    expect(stats.toolCount).toBe(getAllTools().length);
    expect(stats.categoryCount).toBe(getCategories().length);
    expect(stats.reviewCount).toBeGreaterThan(0);
    expect(stats.averageRating).toBeGreaterThan(0);
    expect(stats.averageRating).toBeLessThanOrEqual(5);
  });

  it("produces search docs for every tool and category", () => {
    const docs = getSearchDocs();
    expect(docs.filter((d) => d.type === "tool")).toHaveLength(
      getAllTools().length,
    );
    expect(docs.filter((d) => d.type === "category")).toHaveLength(
      getCategories().length,
    );
    expect(docs.every((d) => d.href.startsWith("/"))).toBe(true);
  });
});
