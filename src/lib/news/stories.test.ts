import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { queryStub, type StubResult } from "@/test/supabase-stub";

const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ from, rpc }) }));

const knownTools: Record<string, { slug: string; name: string }> = {
  gemini: { slug: "gemini", name: "Gemini" },
  cursor: { slug: "cursor", name: "Cursor" },
};
vi.mock("@/lib/content", () => ({
  getToolBySlug: async (slug: string) => knownTools[slug],
}));

const {
  toPublicStory,
  getPublishedStory,
  getStorySources,
  getStoryTools,
  listPublishedStories,
  listIndexableStories,
  listRecentStories,
  getToolSlugsForStories,
  getPopularStoryViews,
  listActiveBeats,
  searchStories,
  dbTimeoutMs,
} = await import("@/lib/news/stories");

const row = {
  id: "31fc2bfe-a1c9-467d-9306-de8ae4cf1091",
  slug: "gemini-hacked-three-real-companies-31fc2b",
  headline: "Gemini hacked three real companies",
  summary: "A summary comfortably longer than forty characters in total.",
  take: null,
  beat: "policy-safety",
  image_url: null,
  source_name: "The Verge",
  source_site_url: "https://www.theverge.com",
  source_url: "https://www.theverge.com/story",
  source_published_at: "2026-09-19T15:25:00Z",
  published_at: "2026-09-21T10:01:35Z",
  featured: true,
};

/** Every from() call gets a fresh stub; results are consumed in call order. */
function respond(...results: StubResult[]) {
  const queue = [...results];
  from.mockImplementation(() => queryStub(queue.shift() ?? { data: [], error: null }));
}
const builder = (i = 0) => from.mock.results[i]?.value as ReturnType<typeof queryStub>;

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("toPublicStory", () => {
  it("maps a complete published row", () => {
    expect(toPublicStory(row)).toMatchObject({
      slug: row.slug,
      beat: "policy-safety",
      beatName: "Policy & Safety",
      sourceName: "The Verge",
      sourceSiteUrl: "https://www.theverge.com",
      publishedAt: row.published_at,
    });
  });
  it("drops rows missing what a public page needs", () => {
    expect(toPublicStory({ ...row, slug: null })).toBeNull();
    expect(toPublicStory({ ...row, summary: null })).toBeNull();
    expect(toPublicStory({ ...row, published_at: null })).toBeNull();
    expect(toPublicStory({ ...row, beat: "sports" })).toBeNull();
  });
});

describe("getPublishedStory", () => {
  it("only ever asks for published stories", async () => {
    respond({ data: row, error: null });
    expect(await getPublishedStory(row.slug)).toMatchObject({ slug: row.slug });
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
    expect(builder().eq).toHaveBeenCalledWith("slug", row.slug);
  });
  it("returns null without querying for a malformed slug", async () => {
    expect(await getPublishedStory("../etc/passwd")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("returns null when the database errors", async () => {
    respond({ data: null, error: { message: "paused" } });
    expect(await getPublishedStory(row.slug)).toBeNull();
  });
  it("returns null when the database never answers", async () => {
    vi.useFakeTimers();
    const hung = queryStub({ data: row, error: null }) as Record<string, unknown>;
    hung.then = () => new Promise(() => {});
    from.mockImplementation(() => hung);
    const pending = getPublishedStory(row.slug);
    await vi.advanceTimersByTimeAsync(2600);
    expect(await pending).toBeNull();
  });
  it("returns the body and its word count with the story", async () => {
    respond({ data: { ...row, body: "Some body.", body_words: 2 }, error: null });
    const story = await getPublishedStory(row.slug);
    expect(story?.body).toBe("Some body.");
    expect(story?.bodyWords).toBe(2);
  });
});

describe("getStoryTools", () => {
  it("keeps position order and skips tools no longer in the directory", async () => {
    respond({
      data: [
        { tool_slug: "gemini", position: 0 },
        { tool_slug: "removed-tool", position: 1 },
        { tool_slug: "cursor", position: 2 },
      ],
      error: null,
    });
    const tools = await getStoryTools(row.id);
    expect(tools.map((t) => t.slug)).toEqual(["gemini", "cursor"]);
  });
});

describe("listPublishedStories", () => {
  it("returns mapped stories and the exact total", async () => {
    respond({ data: [row], error: null, count: 41 });
    const result = await listPublishedStories({ page: 2 });
    expect(result.total).toBe(41);
    expect(result.stories).toHaveLength(1);
    expect(builder().range).toHaveBeenCalledWith(30, 59);
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
  });
  it("filters by beat when asked", async () => {
    respond({ data: [], error: null, count: 0 });
    await listPublishedStories({ beat: "research" });
    expect(builder().eq).toHaveBeenCalledWith("beat", "research");
  });
  it("degrades to an empty archive when the database errors", async () => {
    respond({ data: null, error: { message: "paused" } });
    expect(await listPublishedStories()).toEqual({ stories: [], total: 0 });
  });
  it("treats an out-of-range page (PGRST103) as an empty archive, silently", async () => {
    respond({
      data: null,
      error: { code: "PGRST103", message: "Requested range not satisfiable" },
    });
    expect(await listPublishedStories({ page: 99999 })).toEqual({ stories: [], total: 0 });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("listIndexableStories", () => {
  it("keeps only stories whose body is long enough to index", async () => {
    respond({
      data: [
        { slug: "a-story", body_words: 300, published_at: "2026-09-21T10:00:00Z" },
        { slug: "b-story", body_words: 120, published_at: "2026-09-21T09:00:00Z" },
        { slug: "c-story", body_words: 0, published_at: "2026-09-21T08:00:00Z" },
      ],
      error: null,
    });
    expect(await listIndexableStories()).toEqual([
      { slug: "a-story", publishedAt: "2026-09-21T10:00:00Z" },
    ]);
    expect(builder().gte).toHaveBeenCalledWith("body_words", 300);
  });
});

describe("getStorySources", () => {
  it("maps the RPC rows to sources, primary first", async () => {
    rpc.mockResolvedValue({
      data: [
        { source_name: "TechCrunch", source_site_url: "https://techcrunch.com", source_url: "https://techcrunch.com/a" },
        { source_name: "Ars Technica", source_site_url: "https://arstechnica.com", source_url: "https://arstechnica.com/b" },
      ],
      error: null,
    });
    expect(await getStorySources(row.id)).toEqual([
      { name: "TechCrunch", siteUrl: "https://techcrunch.com", url: "https://techcrunch.com/a" },
      { name: "Ars Technica", siteUrl: "https://arstechnica.com", url: "https://arstechnica.com/b" },
    ]);
    expect(rpc).toHaveBeenCalledWith("story_sources", { p_story_id: row.id });
  });

  it("degrades to an empty list when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await getStorySources(row.id)).toEqual([]);
  });
});

describe("listRecentStories", () => {
  it("asks for the newest published stories", async () => {
    respond({ data: [row], error: null });
    const stories = await listRecentStories();
    expect(stories).toHaveLength(1);
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
    expect(builder().limit).toHaveBeenCalledWith(200);
  });
});

describe("getToolSlugsForStories", () => {
  it("does not query for an empty list", async () => {
    expect(await getToolSlugsForStories([])).toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
  });

  it("groups tool slugs by story, in position order", async () => {
    respond({
      data: [
        { story_id: "a", tool_slug: "gemini", position: 0 },
        { story_id: "b", tool_slug: "claude", position: 0 },
        { story_id: "a", tool_slug: "cursor", position: 1 },
      ],
      error: null,
    });
    const map = await getToolSlugsForStories(["a", "b"]);
    expect(map.get("a")).toEqual(["gemini", "cursor"]);
    expect(map.get("b")).toEqual(["claude"]);
    expect(builder().in).toHaveBeenCalledWith("story_id", ["a", "b"]);
  });
});

describe("dbTimeoutMs", () => {
  it("is short at request time", () => {
    expect(dbTimeoutMs(undefined)).toBe(2_500);
    expect(dbTimeoutMs("phase-production-server")).toBe(2_500);
  });
  it("is long during the production build", () => {
    expect(dbTimeoutMs("phase-production-build")).toBe(20_000);
  });
});

describe("getPopularStoryViews", () => {
  it("maps the RPC's rows", async () => {
    rpc.mockResolvedValue({ data: [{ story_id: "a", views: 12 }], error: null });
    expect(await getPopularStoryViews()).toEqual([{ storyId: "a", views: 12 }]);
    expect(rpc).toHaveBeenCalledWith("popular_stories", { p_hours: 48, p_limit: 5 });
  });

  it("degrades to no popular stories on error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "paused" } });
    expect(await getPopularStoryViews()).toEqual([]);
  });
});

describe("takeaways on public stories", () => {
  it("carries the founder takeaway from the body, never the body itself", () => {
    const body = "Lede.\n\n## What it means for founders\n\n- **Budget for agents.** Tokens cost money. More.";
    const story = toPublicStory({ ...row, body });
    expect(story?.takeaway).toBe("Budget for agents. Tokens cost money.");
    expect(story).not.toHaveProperty("body");
  });
  it("is null for legacy stories without a body", () => {
    expect(toPublicStory(row)?.takeaway).toBeNull();
  });
});

describe("listActiveBeats", () => {
  it("lists beats with published stories in the fixed beat order", async () => {
    respond({ data: [{ beat: "research" }, { beat: "policy-safety" }, { beat: "research" }], error: null });
    expect(await listActiveBeats()).toEqual(["policy-safety", "research"]);
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
  });
  it("is null when the read fails, so callers can show every beat", async () => {
    respond({ data: null, error: { message: "paused" } });
    expect(await listActiveBeats()).toBeNull();
  });
});

describe("searchStories", () => {
  it("requires every sanitised term in the headline, summary or body of a published story", async () => {
    respond({ data: [row], error: null });
    const found = await searchStories("Gemini (hack),");
    expect(found.map((s) => s.slug)).toEqual([row.slug]);
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
    expect(builder().or).toHaveBeenCalledTimes(2);
    expect(builder().or).toHaveBeenCalledWith("headline.ilike.*gemini*,summary.ilike.*gemini*,body.ilike.*gemini*");
    expect(builder().or).toHaveBeenCalledWith("headline.ilike.*hack*,summary.ilike.*hack*,body.ilike.*hack*");
  });
  it("does not query for an empty or unsearchable query", async () => {
    respond();
    expect(await searchStories(" ., ")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
  it("degrades to no results on failure", async () => {
    respond({ data: null, error: { message: "down" } });
    expect(await searchStories("gemini")).toEqual([]);
  });
});
