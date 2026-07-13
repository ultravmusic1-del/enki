import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import { applyFilters, sortTools, getAllTags } from "@/lib/filters";
import { getAllTools, getCategories } from "@/lib/content";

const tools = getAllTools();
const categoryName = new Map(getCategories().map((c) => [c.slug, c.name]));

describe("filters: applyFilters", () => {
  it("filters by category", () => {
    const result = applyFilters(tools, { category: "coding" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.categorySlug === "coding")).toBe(true);
  });

  it("treats 'all' / undefined category as no filter", () => {
    expect(applyFilters(tools, { category: "all" })).toHaveLength(tools.length);
    expect(applyFilters(tools, {})).toHaveLength(tools.length);
  });

  it("filters by pricing model (OR across selected)", () => {
    const result = applyFilters(tools, { pricing: ["free", "enterprise"] });
    expect(
      result.every(
        (t) => t.pricing.model === "free" || t.pricing.model === "enterprise",
      ),
    ).toBe(true);
  });

  it("filters by minimum rating", () => {
    const result = applyFilters(tools, { minRating: 4.5 });
    expect(result.every((t) => t.rating >= 4.5)).toBe(true);
  });

  it("filters by tags (a tool passes if it has any selected tag)", () => {
    const result = applyFilters(tools, { tags: ["agents"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.tags.includes("agents"))).toBe(true);
  });

  it("combines filters conjunctively", () => {
    const result = applyFilters(tools, {
      category: "coding",
      pricing: ["freemium"],
      minRating: 4.4,
    });
    expect(
      result.every(
        (t) =>
          t.categorySlug === "coding" &&
          t.pricing.model === "freemium" &&
          t.rating >= 4.4,
      ),
    ).toBe(true);
  });
});

describe("filters: sortTools", () => {
  it("sorts by rating descending", () => {
    const sorted = sortTools(tools, "rating");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].rating).toBeGreaterThanOrEqual(sorted[i].rating);
    }
  });

  it("sorts by review count descending", () => {
    const sorted = sortTools(tools, "reviews");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].reviewCount).toBeGreaterThanOrEqual(
        sorted[i].reviewCount,
      );
    }
  });

  it("sorts by name ascending", () => {
    const sorted = sortTools(tools, "name");
    const names = sorted.map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("sorts by newest (founded year descending)", () => {
    const sorted = sortTools(tools, "newest");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].foundedYear).toBeGreaterThanOrEqual(
        sorted[i].foundedYear,
      );
    }
  });

  it("preserves order for 'relevance' and does not mutate input", () => {
    const input = tools.slice(0, 5);
    const snapshot = input.map((t) => t.slug);
    const sorted = sortTools(input, "relevance");
    expect(sorted.map((t) => t.slug)).toEqual(snapshot);
    expect(input.map((t) => t.slug)).toEqual(snapshot);
  });
});

describe("filters: getAllTags", () => {
  it("returns unique tags, most frequent first", () => {
    const tags = getAllTags(tools);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags.length).toBeGreaterThan(5);
  });
});

describe("search: Fuse ranking", () => {
  const fuse = new Fuse(tools, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.4,
    keys: [
      { name: "name", weight: 0.35 },
      { name: "tagline", weight: 0.2 },
      { name: "tags", weight: 0.2 },
      {
        name: "categoryName",
        weight: 0.15,
        getFn: (t) => categoryName.get(t.categorySlug) ?? "",
      },
      { name: "description", weight: 0.05 },
      { name: "company", weight: 0.05 },
    ],
  });

  it("ranks an exact name match first", () => {
    const results = fuse.search("Cursor");
    expect(results[0]?.item.slug).toBe("cursor");
  });

  it("finds tools by use case in the top results", () => {
    const results = fuse.search("image generation");
    const topSlugs = results.slice(0, 4).map((r) => r.item.slug);
    expect(topSlugs).toContain("midjourney");
  });

  it("tolerates a typo in the tool name", () => {
    const results = fuse.search("perplexty");
    expect(results.slice(0, 3).some((r) => r.item.slug === "perplexity")).toBe(
      true,
    );
  });
});
