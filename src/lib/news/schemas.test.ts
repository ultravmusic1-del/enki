import { describe, it, expect } from "vitest";
import {
  isIndexableTake,
  newsSourceInputSchema,
  storyPublishSchema,
} from "@/lib/news/schemas";

const base = {
  id: "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b",
  headline: "OpenAI ships GPT-6",
  summary: "x".repeat(40),
  beat: "models-labs",
  featured: false,
  toolSlugs: ["cursor"],
};

describe("storyPublishSchema", () => {
  it("accepts a complete story", () => {
    expect(storyPublishSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    [39, false],
    [40, true],
    [320, true],
    [321, false],
  ])("summary of %i chars → valid %s", (n, ok) => {
    expect(storyPublishSchema.safeParse({ ...base, summary: "x".repeat(n) }).success).toBe(ok);
  });

  it("counts the summary after trimming", () => {
    expect(
      storyPublishSchema.safeParse({ ...base, summary: `  ${"x".repeat(39)}  ` }).success,
    ).toBe(false);
  });

  it("rejects an unknown beat", () => {
    expect(storyPublishSchema.safeParse({ ...base, beat: "sports" }).success).toBe(false);
  });

  it("caps tools at five and rejects duplicates", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(storyPublishSchema.safeParse({ ...base, toolSlugs: six }).success).toBe(false);
    expect(
      storyPublishSchema.safeParse({ ...base, toolSlugs: ["cursor", "cursor"] }).success,
    ).toBe(false);
  });

  it("turns a whitespace-only take into no take", () => {
    const parsed = storyPublishSchema.parse({ ...base, take: "   " });
    expect(parsed.take).toBeUndefined();
  });

  it("rejects an id that is not a uuid", () => {
    expect(storyPublishSchema.safeParse({ ...base, id: "42" }).success).toBe(false);
  });
});

describe("isIndexableTake", () => {
  it.each([
    [299, false],
    [300, true],
    [301, true],
  ])("take of %i chars → %s", (n, expected) => {
    expect(isIndexableTake("y".repeat(n))).toBe(expected);
  });

  it("ignores surrounding whitespace and handles no take", () => {
    expect(isIndexableTake(`   ${"y".repeat(299)}   `)).toBe(false);
    expect(isIndexableTake(null)).toBe(false);
    expect(isIndexableTake(undefined)).toBe(false);
  });
});

describe("newsSourceInputSchema", () => {
  const source = {
    name: "TechCrunch AI",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
    siteUrl: "https://techcrunch.com",
  };

  it("accepts http(s) URLs", () => {
    expect(newsSourceInputSchema.safeParse(source).success).toBe(true);
  });

  it("rejects non-http feed URLs", () => {
    expect(
      newsSourceInputSchema.safeParse({ ...source, feedUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });

  it("requires a name", () => {
    expect(newsSourceInputSchema.safeParse({ ...source, name: " " }).success).toBe(false);
  });
});
