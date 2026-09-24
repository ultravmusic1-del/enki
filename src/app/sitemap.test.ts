import { describe, it, expect, vi } from "vitest";

const activeBeats = vi.fn<() => Promise<string[] | null>>(async () => null);
vi.mock("@/lib/news/stories", () => ({
  listActiveBeats: () => activeBeats(),
  listIndexableStories: async () => [
    { slug: "a-story-with-a-take", publishedAt: "2026-09-21T10:00:00Z" },
  ],
}));

const { default: sitemap } = await import("@/app/sitemap");

describe("sitemap", () => {
  it("lists the news routes and every indexable story", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/news"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/news/about"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/news/corrections"))).toBe(true);
    expect(urls.filter((u) => u.includes("/news/beat/"))).toHaveLength(5);
    expect(urls.some((u) => u.endsWith("/news/a-story-with-a-take"))).toBe(true);
  });

  it("leaves out beats with no published stories", async () => {
    activeBeats.mockResolvedValueOnce(["research", "policy-safety"]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.filter((u) => u.includes("/news/beat/")).map((u) => u.split("/").pop())).toEqual([
      "policy-safety",
      "research",
    ]);
  });

  it("does not list archive pages, which are noindex", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.includes("/news/page/"))).toBe(false);
  });
});
