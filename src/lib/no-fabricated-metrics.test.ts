import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { toolSchema } from "@/lib/schemas";
import { tools } from "@/data/tools";
import { authors } from "@/data/authors";
import { reviews } from "@/data/reviews";

/**
 * Enki earns affiliate revenue from its rankings, so every number it shows has
 * to be one it can stand behind.
 *
 * It previously showed a 1-5 `rating` and a `reviewCount` per tool -- editorial
 * sample figures rendered as "N reviews" and summed into a homepage
 * "Community reviews" cell -- while the reviews table held nothing. The seeded
 * reviews carried six invented bylines with job titles.
 *
 * These tests are the reason those cannot quietly return.
 */

describe("tool content carries no fabricated aggregates", () => {
  it("toolSchema has no rating field", () => {
    expect(Object.keys(toolSchema.shape)).not.toContain("rating");
  });

  it("toolSchema has no reviewCount field", () => {
    expect(Object.keys(toolSchema.shape)).not.toContain("reviewCount");
  });

  it("no seeded tool carries a rating or reviewCount", () => {
    for (const tool of tools) {
      expect(tool).not.toHaveProperty("rating");
      expect(tool).not.toHaveProperty("reviewCount");
    }
  });

  it("every seeded tool still carries an editor score in range", () => {
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.editorScore).toBeGreaterThanOrEqual(0);
      expect(tool.editorScore).toBeLessThanOrEqual(10);
    }
  });
});

describe("no invented editorial identities", () => {
  it("ships no seeded authors", () => {
    expect(authors).toEqual([]);
  });

  it("ships no seeded reviews", () => {
    expect(reviews).toEqual([]);
  });
});

describe("no component displays a fabricated aggregate", () => {
  // Files that render tool data and would be the natural place for a review
  // count or star rating to reappear.
  const RENDER_PATHS = [
    "src/app/page.tsx",
    "src/app/tools/[slug]/page.tsx",
    "src/app/tools/[slug]/opengraph-image.tsx",
    "src/app/vs/[versus]/page.tsx",
    "src/components/shared/tool-card.tsx",
    "src/components/home/featured-tool-card.tsx",
    "src/components/seo/ranked-tool-row.tsx",
    "src/components/compare/compare-view.tsx",
    "src/components/leaderboard/leaderboards-view.tsx",
  ];

  it.each(RENDER_PATHS)("%s exists at the audited path", (path) => {
    // Without this, a rename would make the checks below pass vacuously.
    expect(() => readFileSync(path, "utf8")).not.toThrow();
  });

  it.each(RENDER_PATHS)("%s references no tool rating", (path) => {
    const source = readFileSync(path, "utf8");
    expect(source).not.toContain("tool.rating");
    expect(source).not.toContain("t.rating");
  });

  it.each(RENDER_PATHS)("%s references no review count", (path) => {
    const source = readFileSync(path, "utf8");
    // Property access specifically. Comments explaining why the field was
    // removed mention it in backticks, and those should not fail the check.
    expect(source).not.toContain(".reviewCount");
  });
});

describe("structured data claims no ratings", () => {
  it("emits no AggregateRating or Review markup", () => {
    const source = readFileSync("src/lib/structured-data.ts", "utf8");
    // Comments explaining the absence are fine; an actual schema.org key is not.
    expect(source).not.toContain('"@type": "AggregateRating"');
    expect(source).not.toContain('"@type": "Review"');
  });
});
