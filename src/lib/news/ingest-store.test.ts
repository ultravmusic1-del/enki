import { describe, it, expect, vi } from "vitest";
import { createSupabaseIngestStore } from "@/lib/news/ingest-store";

function client(result: { data?: unknown; error?: unknown }) {
  return { rpc: vi.fn(async () => ({ data: null, error: null, ...result })) };
}

const story = {
  sourceId: "s-1",
  sourceUrl: "https://a.test/1",
  headline: "H",
  excerpt: null,
  imageUrl: null,
  sourcePublishedAt: null,
  toolSlugs: ["cursor"],
};

describe("createSupabaseIngestStore", () => {
  it("maps source rows and passes the secret", async () => {
    const c = client({ data: [{ id: "s-1", name: "A", feed_url: "https://a.test/feed" }] });
    const store = createSupabaseIngestStore(c as never, "secret-value");
    await expect(store.listSources()).resolves.toEqual([
      { id: "s-1", name: "A", feedUrl: "https://a.test/feed" },
    ]);
    expect(c.rpc).toHaveBeenCalledWith("ingest_sources", { secret: "secret-value" });
  });

  it("maps a story onto ingest_story's arguments", async () => {
    const c = client({ data: true });
    await expect(createSupabaseIngestStore(c as never, "k").insertStory(story)).resolves.toBe(true);
    expect(c.rpc).toHaveBeenCalledWith("ingest_story", {
      secret: "k",
      p_source_id: "s-1",
      p_source_url: "https://a.test/1",
      p_headline: "H",
      p_excerpt: null,
      p_image_url: null,
      p_source_published_at: null,
      p_tool_slugs: ["cursor"],
    });
  });

  it("reports a duplicate as false", async () => {
    const c = client({ data: false });
    await expect(createSupabaseIngestStore(c as never, "k").insertStory(story)).resolves.toBe(false);
  });

  it("throws on an RPC error so the caller can report it", async () => {
    const c = client({ error: { message: "not authorized" } });
    await expect(createSupabaseIngestStore(c as never, "k").listSources()).rejects.toThrow(
      "not authorized",
    );
  });
});
