import { describe, it, expect, vi } from "vitest";
import {
  ingestAll,
  MAX_ITEMS_PER_SOURCE,
  selectRecent,
  type IngestSource,
  type IngestStore,
  type IngestStory,
} from "@/lib/news/ingest";
import type { FeedItem } from "@/lib/news/parse-feed";

const NOW = new Date("2026-09-19T12:00:00Z");

function rssWith(items: { title: string; link: string; date?: string }[]): string {
  const body = items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link>${
          i.date ? `<pubDate>${i.date}</pubDate>` : ""
        }<description>Details here</description></item>`,
    )
    .join("");
  return `<rss version="2.0"><channel><title>t</title>${body}</channel></rss>`;
}

function fakeStore(sources: IngestSource[], existingUrls: string[] = []) {
  const inserted: IngestStory[] = [];
  const touched: { id: string; error: string | null }[] = [];
  const seen = new Set(existingUrls);
  const store: IngestStore = {
    listSources: vi.fn(async () => sources),
    insertStory: vi.fn(async (story: IngestStory) => {
      if (seen.has(story.sourceUrl)) return false;
      seen.add(story.sourceUrl);
      inserted.push(story);
      return true;
    }),
    touchSource: vi.fn(async (id: string, error: string | null) => {
      touched.push({ id, error });
    }),
  };
  return { store, inserted, touched };
}

const tools = [{ slug: "cursor", name: "Cursor" }];

describe("selectRecent", () => {
  const item = (hoursAgo: number | null): FeedItem => ({
    title: "t",
    url: `https://x.com/${hoursAgo}`,
    excerpt: null,
    imageUrl: null,
    publishedAt: hoursAgo === null ? null : new Date(NOW.getTime() - hoursAgo * 3_600_000),
  });

  it("keeps items from the last 72 hours and undated items", () => {
    const kept = selectRecent([item(1), item(71), item(73), item(null)], NOW);
    expect(kept.map((i) => i.url)).toEqual(["https://x.com/1", "https://x.com/71", "https://x.com/null"]);
  });

  it("keeps at most 30 items per source", () => {
    const many = Array.from({ length: 50 }, () => item(1));
    expect(selectRecent(many, NOW)).toHaveLength(MAX_ITEMS_PER_SOURCE);
  });
});

describe("ingestAll", () => {
  const a = { id: "a", name: "Alpha", feedUrl: "https://alpha.test/feed" };
  const b = { id: "b", name: "Beta", feedUrl: "https://beta.test/feed" };

  it("inserts new items with matched tools and marks the source fetched", async () => {
    const { store, inserted, touched } = fakeStore([a]);
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () =>
        rssWith([{ title: "Cursor ships agents", link: "https://alpha.test/1", date: "Fri, 19 Sep 2026 09:00:00 GMT" }]),
    });

    expect(summary).toEqual({ sources: 1, fetched: 1, inserted: 1, failed: [] });
    expect(inserted[0]).toMatchObject({
      sourceId: "a",
      sourceUrl: "https://alpha.test/1",
      headline: "Cursor ships agents",
      excerpt: "Details here",
      sourcePublishedAt: "2026-09-19T09:00:00.000Z",
      toolSlugs: ["cursor"],
    });
    expect(touched).toEqual([{ id: "a", error: null }]);
  });

  it("counts duplicates as fetched but not inserted", async () => {
    const { store } = fakeStore([a], ["https://alpha.test/1"]);
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => rssWith([{ title: "Old", link: "https://alpha.test/1" }]),
    });
    expect(summary).toMatchObject({ fetched: 1, inserted: 0 });
  });

  it("keeps going when one source fails, and records the failure", async () => {
    const { store, inserted, touched } = fakeStore([a, b]);
    const report = vi.fn();
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      report,
      fetchFeed: async (url) => {
        if (url.includes("alpha")) throw new Error("Feed responded 500");
        return rssWith([{ title: "Beta story", link: "https://beta.test/1" }]);
      },
    });

    expect(summary).toEqual({ sources: 2, fetched: 1, inserted: 1, failed: ["Alpha"] });
    expect(inserted.map((s) => s.sourceId)).toEqual(["b"]);
    expect(touched).toContainEqual({ id: "a", error: "Feed responded 500" });
    expect(report).toHaveBeenCalledWith(expect.any(Error), a);
  });

  it("skips a single bad item without failing its source", async () => {
    const { store } = fakeStore([a]);
    let calls = 0;
    store.insertStory = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("check constraint");
      return true;
    });
    const report = vi.fn();
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      report,
      fetchFeed: async () =>
        rssWith([
          { title: "One", link: "https://alpha.test/1" },
          { title: "Two", link: "https://alpha.test/2" },
        ]),
    });
    expect(summary).toMatchObject({ fetched: 2, inserted: 1, failed: [] });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("propagates a failure to list sources", async () => {
    const { store } = fakeStore([]);
    store.listSources = vi.fn(async () => {
      throw new Error("not authorized");
    });
    await expect(ingestAll({ store, tools, now: NOW, fetchFeed: async () => "" })).rejects.toThrow(
      "not authorized",
    );
  });

  it("reports a source that fails to parse", async () => {
    const { store } = fakeStore([a]);
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => "<html>nope</html>",
    });
    expect(summary.failed).toEqual(["Alpha"]);
  });
});
