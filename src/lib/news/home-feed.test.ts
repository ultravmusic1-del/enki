import { describe, it, expect } from "vitest";
import {
  BRIEF_MAX,
  BRIEF_MIN,
  briefMinutes,
  buildHomeFeed,
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
    takeaway: null,
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
    expect(feed.brief).toEqual([]);
    expect(feed.mostRead).toEqual([]);
    expect(feed.beats).toEqual([]);
    expect(feed.ticker).toEqual([]);
  });

  it("shows one story as the lead of the brief and nothing else", () => {
    const feed = build({ stories: [story("a")] });
    expect(feed.lead?.id).toBe("a");
    expect(feed.brief.map((s) => s.id)).toEqual(["a"]);
    expect(feed.beats).toEqual([]);
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

describe("buildHomeFeed: brief", () => {
  it("takes the stories from the newest story's day, newest first", () => {
    const stories = [
      story("a", { hoursAgo: 1 }),
      story("b", { hoursAgo: 5 }),
      story("c", { hoursAgo: 20 }),
      story("d", { hoursAgo: 24 }),
      story("e", { hoursAgo: 30 }),
    ];
    expect(build({ stories }).brief.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("tops a thin day up to the minimum with the next newest stories", () => {
    const stories = [story("a", { hoursAgo: 1 }), story("b", { hoursAgo: 40 }), story("c", { hoursAgo: 60 }), story("d", { hoursAgo: 80 })];
    const brief = build({ stories }).brief;
    expect(brief).toHaveLength(BRIEF_MIN);
    expect(brief.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("caps a busy day", () => {
    const stories = Array.from({ length: 12 }, (_, i) => story(`s${i}`, { hoursAgo: i + 1 }));
    expect(build({ stories }).brief).toHaveLength(BRIEF_MAX);
  });

  it("puts a featured story first even when it is older than the day", () => {
    const stories = [story("a", { hoursAgo: 1 }), story("b", { hoursAgo: 2 }), story("f", { hoursAgo: 40, featured: true })];
    expect(build({ stories }).brief.map((s) => s.id)).toEqual(["f", "a", "b"]);
  });

  it("estimates reading time from what the brief shows", () => {
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    const s = { ...story("a"), headline: words(10), summary: words(200), takeaway: words(50) };
    expect(briefMinutes([s])).toBe(2);
    expect(briefMinutes([])).toBe(1);
  });
});

describe("buildHomeFeed: most read", () => {
  const many = Array.from({ length: 12 }, (_, i) => story(`s${i}`, { hoursAgo: i * 10 + 1 }));

  it("stays hidden below the view threshold", () => {
    const feed = build({ stories: many, popular: [{ storyId: "s8", views: POPULAR_MIN_TOP_VIEWS - 1 }] });
    expect(feed.mostRead).toEqual([]);
  });

  it("lists popular stories not already in the brief", () => {
    const feed = build({
      stories: many,
      popular: [
        { storyId: "s0", views: 40 },
        { storyId: "s7", views: 25 },
        { storyId: "s5", views: 12 },
      ],
    });
    const briefIds = new Set(feed.brief.map((s) => s.id));
    expect(briefIds.has("s0")).toBe(true);
    expect(feed.mostRead.map((s) => s.id)).toEqual(["s7", "s5"]);
  });

  it("ignores a popular id that is not among the loaded stories", () => {
    const feed = build({ stories: many, popular: [{ storyId: "ghost", views: 99 }] });
    expect(feed.mostRead).toEqual([]);
  });
});

describe("buildHomeFeed: no repeated stories", () => {
  it("shows every story at most once across brief, most read and beats", () => {
    const beatsCycle: BeatSlug[] = ["research", "policy-safety", "products-launches"];
    const stories = Array.from({ length: 30 }, (_, i) => story(`s${i}`, { hoursAgo: i * 5 + 1, beat: beatsCycle[i % 3] }));
    const feed = build({ stories, popular: [{ storyId: "s12", views: 50 }, { storyId: "s0", views: 40 }] });
    const ids = [...feed.brief, ...feed.mostRead, ...feed.beats.flatMap((b) => b.stories)].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildHomeFeed: beats", () => {
  it("omits empty beats, caps each, excludes the brief and anything older than 7 days", () => {
    const stories = [
      story("lead", { hoursAgo: 1, beat: "research" }),
      ...Array.from({ length: 8 }, (_, i) => story(`r${i}`, { hoursAgo: 30 + i, beat: "research" })),
      story("old", { hoursAgo: 24 * 8, beat: "policy-safety" }),
    ];
    const feed = build({ stories });
    expect(feed.beats.map((b) => b.slug)).toEqual(["research"]);
    expect(feed.beats[0].stories).toHaveLength(STORIES_PER_BEAT);
    const briefIds = new Set(feed.brief.map((s) => s.id));
    expect(feed.beats[0].stories.some((s) => briefIds.has(s.id))).toBe(false);
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
