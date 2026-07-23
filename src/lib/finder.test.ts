import { describe, it, expect } from "vitest";
import { getAllTools, getCategories } from "@/lib/content";
import {
  FINDER_STEPS,
  recommendTools,
  scoreTools,
  type FinderAnswers,
} from "@/lib/finder";

const tools = getAllTools();
const categoryName = new Map(getCategories().map((c) => [c.slug, c.name]));

function rec(answers: FinderAnswers, n = 3) {
  return recommendTools(tools, answers, categoryName, n);
}

describe("finder: recommendTools", () => {
  it("returns exactly n results and never empty, even with no answers", () => {
    expect(rec({}, 3)).toHaveLength(3);
    expect(rec({ category: "coding", budget: "free", platform: "mac" }, 3)).toHaveLength(3);
  });

  it("ranks the chosen use-case (category) to the top", () => {
    const top3 = rec({ category: "coding" }, 3);
    expect(top3.every((r) => r.tool.categorySlug === "coding")).toBe(true);
  });

  it("prefers free/freemium tools when budget is 'free'", () => {
    // Within the coding category, a free-tier tool should outrank a paid one.
    const scored = scoreTools(tools, { category: "coding", budget: "free" }, categoryName)
      .filter((r) => r.tool.categorySlug === "coding");
    const freeish = scored.find(
      (r) => r.tool.pricing.model === "free" || r.tool.pricing.model === "freemium",
    );
    const paid = scored.find((r) => r.tool.pricing.model === "paid");
    if (freeish && paid) {
      expect(freeish.score).toBeGreaterThan(paid.score);
    }
  });

  it("boosts tools matching the chosen platform", () => {
    const withApi = scoreTools(tools, { platform: "api" }, categoryName);
    const hasApi = withApi.find((r) => r.tool.platforms.includes("API"));
    const noApi = withApi.find(
      (r) => !["API", "VS Code", "JetBrains", "CLI"].some((p) => r.tool.platforms.includes(p)),
    );
    if (hasApi && noApi) {
      expect(hasApi.score).toBeGreaterThan(noApi.score);
    }
  });

  it("attaches a category reason when the use-case matches", () => {
    const top = rec({ category: "image" }, 1)[0];
    expect(top.reasons.some((r) => /Image Generation/i.test(r))).toBe(true);
    expect(top.reasons.length).toBeGreaterThan(0);
    expect(top.reasons.length).toBeLessThanOrEqual(3);
  });

  it("is deterministic and does not mutate the input array", () => {
    const snapshot = tools.map((t) => t.slug);
    const a = rec({ category: "writing", budget: "trial", platform: "web" }, 5).map((r) => r.tool.slug);
    const b = rec({ category: "writing", budget: "trial", platform: "web" }, 5).map((r) => r.tool.slug);
    expect(a).toEqual(b);
    expect(tools.map((t) => t.slug)).toEqual(snapshot);
  });
});

describe("finder: FINDER_STEPS config", () => {
  it("has three steps, each with a non-empty option set", () => {
    expect(FINDER_STEPS).toHaveLength(3);
    for (const step of FINDER_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.options.length).toBeGreaterThan(1);
      for (const opt of step.options) {
        expect(opt.value).toBeTruthy();
        expect(opt.label).toBeTruthy();
      }
    }
  });

  it("uses the real category slugs for the use-case step", () => {
    const useCase = FINDER_STEPS.find((s) => s.id === "category");
    expect(useCase).toBeDefined();
    // "any" plus the 8 seeded categories
    expect(useCase!.options.length).toBe(9);
  });
});
