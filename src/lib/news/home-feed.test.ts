import { describe, it, expect } from "vitest";
import {
  buildHomeFeed,
  LATEST_COUNT,
  POPULAR_MIN_TOP_VIEWS,
  STORIES_PER_BEAT,
  TICKER_MAX_TOOLS,
} from "@/lib/news/home-feed";
import type { PublicStory } from "@/lib/news/stories";
import type { BeatSlug } from "@/data/beats";

const NOW = new Date("2026-09-21T12:00:00Z");

function story(
  id: string,
  opts: { hoursAgo?: number; beat?: BeatSlug; featured?: boolean } = {},
): PublicStory {
  const published = new Date(NOW.getTime() - (opts.hoursAgo ?? 1) * 3_600_000).toISOString();
  return {
    id,
    slug: `story-${id}`,
    headline: `Headline ${id}`,
    summary: "A summary that is comfortably longer than forty characters.",
    take: null,
    beat: opts.beat ?? "models-labs",
    beatName: "Models & Labs",
    imageUrl: null,
    sourceName: "Source",
    sourceSiteUrl: "https://source.example",
    sourceUrl: `https://source.example/${id}`,
    sourcePublishedAt: published,
    publishedAt: published,
    featured: opts.featured ?? false,
  };
}

const known = new Set(["gemini", "claude", "chatgpt", "cursor"]);
const build = (overrides: Partial<Parameters<typeof buildHomeFeed>[0]> = {}) =>
  buildHomeFeed({
    stories: [],
    toolSlugsByStory: new Map(),
    popular: [],
    knownToolSlugs: known,
    now: NOW,
    ...overrides,
  });

describe("buildHomeFeed: sparse states", () => {
  it("is empty everywhere with no stories", () => {
    const feed = build();
    expect(feed.lead).toBeNull();
    expect(feed.rail).toEqual({ title: "Latest", stories: [] });
    expect(feed.beats).toEqual([]);
    expect(feed.latest).toEqual([]);
    expect(feed.ticker).toEqual([]);
  });

  it("shows one story as the lead and nothing else", () => {
    const feed = build({ stories: [story("a")] });
    expect(feed.lead?.id).toBe("a");
    expect(feed.rail.stories).toEqual([]);
    expect(feed.beats).toEqual([]);
    expect(feed.latest).toEqual([]);
  });
});

describe("buildHomeFeed: lead", () => {
  it("prefers a story featured within 48 hours over newer ones", () => {
    const feed = build({ stories: [story("new", { hoursAgo: 1 }), story("feat", { hoursAgo: 30, featured: true })] });
    expect(feed.lead?.id).toBe("feat");
  });

  it("ignores a featured story older than 48 hours", () => {
    const feed = build({ stories: [story("new", { hoursAgo: 1 }), story("old", { hoursAgo: 60, featured: true })] });
    expect(feed.lead?.id).toBe("new");
  });

  it("keeps only directory tools on the lead", () => {
    const feed = build({
      stories: [story("a")],
      toolSlugsByStory: new Map([["a", ["gemini", "removed-tool"]]]),
    });
    expect(feed.leadToolSlugs).toEqual(["gemini"]);
  });
});

describe("buildHomeFeed: rail", () => {
  const many = Array.from({ length: 12 }, (_, i) => story(`s${i}`, { hoursAgo: i + 1 }));

  it("falls back to Latest below the view threshold", () => {
    const feed = build({ stories: many, popular: [{ storyId: "s5", views: POPULAR_MIN_TOP_VIEWS - 1 }] });
    expect(feed.rail.title).toBe("Latest");
    expect(feed.rail.stories.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("shows Popular by views once the top story reaches the threshold, excluding the lead", () => {
    const feed = build({
      stories: many,
      popular: [
        { storyId: "s0", views: 40 },
        { storyId: "s7", views: 25 },
        { storyId: "s3", views: 12 },
      ],
    });
    expect(feed.rail.title).toBe("Popular");
    expect(feed.rail.stories.map((s) => s.id)).toEqual(["s7", "s3"]);
  });

  it("never repeats the rail in the Latest column", () => {
    const feed = build({ stories: many });
    const railIds = new Set(feed.rail.stories.map((s) => s.id));
    expect(feed.latest.some((s) => railIds.has(s.id))).toBe(false);
    expect(feed.latest.some((s) => s.id === feed.lead?.id)).toBe(false);
    expect(feed.latest).toHaveLength(LATEST_COUNT);
  });
});

describe("buildHomeFeed: beats", () => {
  it("omits empty beats, caps each, excludes the lead and anything older than 7 days", () => {
    const stories = [
      story("lead", { hoursAgo: 1, beat: "research" }),
      ...Array.from({ length: 6 }, (_, i) => story(`r${i}`, { hoursAgo: i + 2, beat: "research" })),
      story("old", { hoursAgo: 24 * 8, beat: "policy-safety" }),
    ];
    const feed = build({ stories });
    expect(feed.beats.map((b) => b.slug)).toEqual(["research"]);
    expect(feed.beats[0].stories).toHaveLength(STORIES_PER_BEAT);
    expect(feed.beats[0].stories.some((s) => s.id === "lead")).toBe(false);
  });
});

describe("buildHomeFeed: ticker", () => {
  it("stays hidden until three directory tools have mentions", () => {
    const feed = build({
      stories: [story("a"), story("b")],
      toolSlugsByStory: new Map([
        ["a", ["gemini", "removed-tool"]],
        ["b", ["claude"]],
      ]),
    });
    expect(feed.ticker).toEqual([]);
  });

  it("ranks tools by stories mentioning them in the last 7 days", () => {
    const feed = build({
      stories: [story("a"), story("b"), story("c"), story("old", { hoursAgo: 24 * 8 })],
      toolSlugsByStory: new Map([
        ["a", ["gemini", "claude", "gemini"]],
        ["b", ["gemini", "chatgpt"]],
        ["c", ["cursor"]],
        ["old", ["cursor", "cursor"]],
      ]),
    });
    expect(feed.ticker).toEqual([
      { slug: "gemini", count: 2 },
      { slug: "chatgpt", count: 1 },
      { slug: "claude", count: 1 },
      { slug: "cursor", count: 1 },
    ]);
  });

  it("caps the ticker", () => {
    const slugs = Array.from({ length: TICKER_MAX_TOOLS + 3 }, (_, i) => `tool-${i}`);
    const feed = build({
      stories: [story("a")],
      toolSlugsByStory: new Map([["a", slugs]]),
      knownToolSlugs: new Set(slugs),
    });
    expect(feed.ticker).toHaveLength(TICKER_MAX_TOOLS);
  });
});
