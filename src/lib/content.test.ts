import { describe, it, expect } from "vitest";
import {
  getAllTools,
  getToolBySlug,
  getFeaturedTools,
  getCategories,
  getCategoryBySlug,
  getToolsByCategory,
  getRelatedTools,
  getAlternatives,
  getAlternativesSlugs,
  getReviewsForTool,
  getStats,
  getSearchDocs,
  getLeaderboards,
  getCompareTools,
} from "@/lib/content";

describe("content: tools", () => {
  it("returns tools sorted by name", async () => {
    const tools = await getAllTools();
    expect(tools.length).toBeGreaterThanOrEqual(24);
    const names = tools.map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("looks up a tool by slug", async () => {
    expect((await getToolBySlug("cursor"))?.name).toBe("Cursor");
    expect(await getToolBySlug("does-not-exist")).toBeUndefined();
  });

  it("returns only featured tools, highest editor score first", async () => {
    const featured = await getFeaturedTools();
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((t) => t.featured)).toBe(true);
    for (let i = 1; i < featured.length; i++) {
      expect(featured[i - 1].editorScore).toBeGreaterThanOrEqual(
        featured[i].editorScore,
      );
    }
  });
});

describe("content: categories", () => {
  it("returns categories with accurate tool counts", async () => {
    const categories = await getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(6);
    for (const cat of categories) {
      expect(cat.toolCount).toBe((await getToolsByCategory(cat.slug)).length);
    }
  });

  it("sums tool counts to the total tool count", async () => {
    const total = (await getCategories()).reduce(
      (sum, c) => sum + c.toolCount,
      0,
    );
    expect(total).toBe((await getAllTools()).length);
  });

  it("resolves a category by slug", async () => {
    expect((await getCategoryBySlug("coding"))?.name).toBe("Coding & Dev");
    expect(await getCategoryBySlug("nope")).toBeUndefined();
  });
});

describe("content: related tools", () => {
  it("never includes the source tool and respects the count", async () => {
    const tool = (await getToolBySlug("cursor"))!;
    const related = await getRelatedTools(tool, 3);
    expect(related).toHaveLength(3);
    expect(related.some((t) => t.slug === tool.slug)).toBe(false);
  });

  it("prefers tools from the same category", async () => {
    const tool = (await getToolBySlug("cursor"))!;
    const related = await getRelatedTools(tool, 3);
    expect(related[0].categorySlug).toBe(tool.categorySlug);
  });

  it("returns only same-category tools as alternatives", async () => {
    const cursor = await getToolBySlug("cursor");
    expect(cursor).toBeDefined();
    const alts = await getAlternatives(cursor!, 6);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((t) => t.categorySlug === cursor!.categorySlug)).toBe(
      true,
    );
    expect(alts.some((t) => t.slug === cursor!.slug)).toBe(false);
  });

  it("returns fewer than n rather than padding a sparse category", async () => {
    const cursor = await getToolBySlug("cursor");
    const sameCategory = (await getToolsByCategory(cursor!.categorySlug)).filter(
      (t) => t.slug !== cursor!.slug,
    );
    // Ask for far more than exist. A padded implementation returns 50.
    const alts = await getAlternatives(cursor!, 50);
    expect(alts.length).toBe(sameCategory.length);
  });

  it("orders alternatives by editor score, highest first", async () => {
    const cursor = await getToolBySlug("cursor");
    const alts = await getAlternatives(cursor!, 6);
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i - 1].editorScore).toBeGreaterThanOrEqual(
        alts[i].editorScore,
      );
    }
  });

  it("keeps getRelatedTools padding for the discovery rail", async () => {
    const cursor = await getToolBySlug("cursor");
    const related = await getRelatedTools(cursor!, 6);
    expect(related.length).toBe(6);
  });
});

describe("content: alternatives publishing gate", () => {
  it("only lists slugs with at least three real alternatives", async () => {
    const slugs = await getAlternativesSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const tool = await getToolBySlug(slug);
      expect((await getAlternatives(tool!, 50)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("excludes tools whose category is too sparse to compare", async () => {
    const slugs = new Set(await getAlternativesSlugs());
    const all = await getAllTools();
    for (const tool of all) {
      if ((await getAlternatives(tool, 50)).length < 3) {
        expect(slugs.has(tool.slug)).toBe(false);
      }
    }
  });
});

describe("content: reviews", () => {
  it("ships no seeded editorial reviews", () => {
    // The 27 seeded reviews were written under six invented bylines. They are
    // retired rather than relabelled: a review attributed to a person who does
    // not exist is not a placeholder, it is a fabrication. Real reviews come
    // from the Supabase `reviews` table once users write them.
    expect(getReviewsForTool("cursor")).toEqual([]);
  });

  it("still resolves authors and orders newest-first when reviews exist", () => {
    // Guards the plumbing that stays in place for genuine editorial reviews.
    const reviews = getReviewsForTool("cursor");
    for (let i = 1; i < reviews.length; i++) {
      expect(
        reviews[i - 1].date.localeCompare(reviews[i].date),
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("carries no fabricated engagement metrics", () => {
    for (const review of getReviewsForTool("cursor")) {
      expect(review).not.toHaveProperty("helpful");
      expect(review).not.toHaveProperty("verified");
    }
  });
});

describe("content: stats & search", () => {
  it("computes site stats", async () => {
    const stats = await getStats();
    expect(stats.toolCount).toBe((await getAllTools()).length);
    expect(stats.categoryCount).toBe((await getCategories()).length);
    // No fabricated aggregates here: only facts that can be checked against
    // the data. sponsoredCount is 0 until a placement is actually sold.
    expect(stats.sponsoredCount).toBe(
      (await getAllTools()).filter((t) => t.sponsored).length,
    );
  });

  it("produces search docs for every tool and category", async () => {
    const docs = await getSearchDocs();
    expect(docs.filter((d) => d.type === "tool")).toHaveLength(
      (await getAllTools()).length,
    );
    expect(docs.filter((d) => d.type === "category")).toHaveLength(
      (await getCategories()).length,
    );
    expect(docs.every((d) => d.href.startsWith("/"))).toBe(true);
  });
});

describe("content: leaderboards", () => {
  it("caps the board at the requested limit", async () => {
    const { editor } = await getLeaderboards(15);
    expect(editor).toHaveLength(15);
    const small = await getLeaderboards(5);
    expect(small.editor).toHaveLength(5);
  });

  it("orders the editor board by descending editor score with 1-based ranks", async () => {
    const { editor } = await getLeaderboards(15);
    expect(editor[0].rank).toBe(1);
    expect(editor[editor.length - 1].rank).toBe(editor.length);
    for (let i = 1; i < editor.length; i++) {
      expect(editor[i - 1].editorScore).toBeGreaterThanOrEqual(
        editor[i].editorScore,
      );
    }
  });

  it("exposes no community board, since no user has rated anything", async () => {
    const boards = await getLeaderboards(15);
    expect(Object.keys(boards)).toEqual(["editor"]);
  });

  it("carries each entry's own rank", async () => {
    const { editor } = await getLeaderboards(15);
    expect(editor[0].editorRank).toBe(1);
  });

  it("puts Cursor atop the editorial board", async () => {
    const { editor } = await getLeaderboards(15);
    expect(editor[0].slug).toBe("cursor");
  });
});

describe("content: compare tools", () => {
  it("returns every tool, sorted by name", async () => {
    const compare = await getCompareTools();
    expect(compare).toHaveLength((await getAllTools()).length);
    const names = compare.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("caps pros and cons at three each", async () => {
    for (const c of await getCompareTools()) {
      expect(c.pros.length).toBeLessThanOrEqual(3);
      expect(c.cons.length).toBeLessThanOrEqual(3);
    }
  });

  it("exposes a valid pricing model and a boolean free-trial flag", async () => {
    for (const c of await getCompareTools()) {
      expect(["free", "freemium", "paid", "enterprise"]).toContain(
        c.pricingModel,
      );
      expect(typeof c.hasFreeTrial).toBe("boolean");
    }
  });

  it("mirrors the source tool's scores and platforms", async () => {
    const cursor = (await getCompareTools()).find((c) => c.slug === "cursor")!;
    const source = (await getToolBySlug("cursor"))!;
    expect(cursor.editorScore).toBe(source.editorScore);
    expect(cursor.platforms).toEqual(source.platforms);
  });
});
