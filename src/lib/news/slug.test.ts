import { describe, it, expect } from "vitest";
import { makeStorySlug } from "@/lib/news/slug";

const ID = "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("makeStorySlug", () => {
  it("kebab-cases the headline and appends six id characters", () => {
    expect(makeStorySlug("OpenAI ships GPT-6", ID)).toBe("openai-ships-gpt-6-3f2a9c");
  });

  it("folds accents and punctuation", () => {
    expect(makeStorySlug("Mistral’s Café model!", ID)).toBe("mistral-s-cafe-model-3f2a9c");
  });

  it("falls back to 'story' when nothing survives", () => {
    expect(makeStorySlug("🚀🚀", ID)).toBe("story-3f2a9c");
  });

  it("cuts long headlines at a word boundary", () => {
    const slug = makeStorySlug(
      "Anthropic and Google announce a sweeping partnership on compute capacity across three continents",
      ID,
    );
    expect(slug.length).toBeLessThanOrEqual(67);
    expect(slug.endsWith("-3f2a9c")).toBe(true);
    expect(slug).not.toMatch(/--/);
  });

  it("always satisfies the database slug constraint", () => {
    for (const h of ["A", "  --  ", "Ünïcödé", "x".repeat(200), "GPT-5 vs. Claude: who wins?"]) {
      expect(makeStorySlug(h, ID)).toMatch(SLUG_RE);
    }
  });
});
