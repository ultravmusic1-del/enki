import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";
import type { StoryPublishInput } from "@/lib/news/schemas";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const runNewsIngest = vi.fn();
vi.mock("@/lib/news/run-ingest", () => ({ runNewsIngest: () => runNewsIngest() }));

const { publishStory, setStoryStatus, fetchNewsNow, addNewsSource, setNewsSourceActive, mergeStory } =
  await import("@/app/admin/news/actions");

const ID = "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b";
const valid: StoryPublishInput = {
  id: ID,
  headline: "OpenAI ships GPT-6",
  summary: "A summary that is comfortably over forty characters long.",
  beat: "models-labs",
  featured: true,
  toolSlugs: ["cursor"],
};

beforeEach(() => vi.clearAllMocks());

describe("publishStory", () => {
  it("refuses a non-admin and revalidates nothing", async () => {
    const stub = supabaseStub({ isAdmin: false });
    createClient.mockReturnValue(stub);
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_publish_story", expect.anything());
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    const stub = supabaseStub({ isAdmin: true });
    createClient.mockReturnValue(stub);
    const res = await publishStory({ ...valid, summary: "too short" });
    expect(res.ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_publish_story", expect.anything());
  });

  it("publishes through the guarded RPC with a generated slug", async () => {
    const stub = supabaseStub({
      isAdmin: true,
      rpc: { admin_publish_story: { data: "openai-ships-gpt-6-3f2a9c", error: null } },
    });
    createClient.mockReturnValue(stub);

    const res = await publishStory({ ...valid, body: "   " });

    expect(res).toEqual({ ok: true, slug: "openai-ships-gpt-6-3f2a9c" });
    expect(stub.rpc).toHaveBeenCalledWith("admin_publish_story", {
      p_story_id: ID,
      p_slug: "openai-ships-gpt-6-3f2a9c",
      p_headline: "OpenAI ships GPT-6",
      p_summary: valid.summary,
      p_body: null,
      p_beat: "models-labs",
      p_featured: true,
      p_tool_slugs: ["cursor"],
    });
    expect(stub.from).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
    expect(revalidatePath).toHaveBeenCalledWith("/news", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("reports a story that left the queue", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_publish_story: { data: null, error: null } } }),
    );
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not leak raw database errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: { admin_publish_story: { data: null, error: { message: 'violates check constraint "stories_beat_check"' } } },
      }),
    );
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("constraint");
  });

  it("names the body check constraint plainly when the database refuses it", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: {
          admin_publish_story: {
            data: null,
            error: { code: "23514", message: 'violates check constraint "stories_body_check"' },
          },
        },
      }),
    );
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(
        "The database refused the story body (word count, dash or founders heading).",
      );
    }
  });
});

describe("setStoryStatus", () => {
  it("rejects a status outside the whitelist", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    // @ts-expect-error deliberately invalid
    expect((await setStoryStatus(ID, "published")).ok).toBe(false);
  });

  it("writes through the guarded RPC", async () => {
    const stub = supabaseStub({
      isAdmin: true,
      rpc: { admin_set_story_status: { data: true, error: null } },
    });
    createClient.mockReturnValue(stub);
    expect((await setStoryStatus(ID, "rejected")).ok).toBe(true);
    expect(stub.rpc).toHaveBeenCalledWith("admin_set_story_status", {
      p_story_id: ID,
      p_status: "rejected",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
  });

  it("reports a miss", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_set_story_status: { data: false, error: null } } }),
    );
    expect((await setStoryStatus(ID, "rejected")).ok).toBe(false);
  });

  it("refreshes public news pages when a story is unpublished", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_set_story_status: { data: true, error: null } } }),
    );
    await setStoryStatus(ID, "pending");
    expect(revalidatePath).toHaveBeenCalledWith("/news", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("fetchNewsNow", () => {
  it("refuses a non-admin without fetching anything", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    expect((await fetchNewsNow()).ok).toBe(false);
    expect(runNewsIngest).not.toHaveBeenCalled();
  });

  it("returns the run summary", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    const summary = { sources: 3, fetched: 20, inserted: 7, failed: [] };
    runNewsIngest.mockResolvedValue(summary);
    expect(await fetchNewsNow()).toEqual({ ok: true, summary });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
  });

  it("turns a failed run into a friendly error", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    runNewsIngest.mockRejectedValue(new Error("ingest_sources failed: not authorized"));
    const res = await fetchNewsNow();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("ingest_sources");
  });
});

describe("addNewsSource", () => {
  const source = { name: "Ars Technica", feedUrl: "https://arstechnica.com/ai/feed/", siteUrl: "https://arstechnica.com" };

  it("rejects a non-http feed URL", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    expect((await addNewsSource({ ...source, feedUrl: "ftp://x" })).ok).toBe(false);
  });

  it("treats a duplicate feed as a friendly error", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: null, error: { code: "23505" } } }),
    );
    const res = await addNewsSource(source);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("already");
  });

  it("inserts and revalidates the sources page", async () => {
    const stub = supabaseStub({ isAdmin: true, table: { data: [{ id: "s-1" }], error: null } });
    createClient.mockReturnValue(stub);
    expect((await addNewsSource(source)).ok).toBe(true);
    expect(stub.builder.insert).toHaveBeenCalledWith({
      name: "Ars Technica",
      feed_url: "https://arstechnica.com/ai/feed/",
      site_url: "https://arstechnica.com",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news/sources");
  });
});

describe("setNewsSourceActive", () => {
  it("refuses a non-admin", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    expect((await setNewsSourceActive("s-1", false)).ok).toBe(false);
  });

  it("reports a miss when no row matched", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true, table: { data: [], error: null } }));
    expect((await setNewsSourceActive("s-1", false)).ok).toBe(false);
  });

  it("updates and revalidates", async () => {
    const stub = supabaseStub({ isAdmin: true, table: { data: [{ id: "s-1" }], error: null } });
    createClient.mockReturnValue(stub);
    expect((await setNewsSourceActive("s-1", false)).ok).toBe(true);
    expect(stub.builder.update).toHaveBeenCalledWith({ active: false });
  });
});

const INTO = "9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d";

describe("mergeStory", () => {
  it("refuses a non-admin", async () => {
    const stub = supabaseStub({ isAdmin: false });
    createClient.mockReturnValue(stub);
    expect((await mergeStory(ID, INTO)).ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_merge_story", expect.anything());
  });

  it("refuses bad ids and self-merges before touching the database", async () => {
    const stub = supabaseStub({ isAdmin: true });
    createClient.mockReturnValue(stub);
    expect((await mergeStory("not-a-uuid", INTO)).ok).toBe(false);
    expect((await mergeStory(ID, ID)).ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_merge_story", expect.anything());
  });

  it("merges through the guarded RPC and refreshes the queue", async () => {
    const stub = supabaseStub({ isAdmin: true, rpc: { admin_merge_story: { data: true, error: null } } });
    createClient.mockReturnValue(stub);
    expect(await mergeStory(ID, INTO)).toEqual({ ok: true });
    expect(stub.rpc).toHaveBeenCalledWith("admin_merge_story", { p_story_id: ID, p_into_id: INTO });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
    expect(revalidatePath).toHaveBeenCalledWith("/news", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("reports a merge the database refused", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_merge_story: { data: false, error: null } } }),
    );
    const res = await mergeStory(ID, INTO);
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("publishStory body", () => {
  it("passes a valid body to the RPC", async () => {
    const stub = supabaseStub({ isAdmin: true, rpc: { admin_publish_story: { data: "s-3f2a9c", error: null } } });
    createClient.mockReturnValue(stub);
    const body = `${"word ".repeat(295)}\n## What it means for founders\n`;
    await publishStory({ ...valid, body });
    expect(stub.rpc).toHaveBeenCalledWith("admin_publish_story", expect.objectContaining({ p_body: body.trim() }));
  });

  it("refuses an invalid body before the database", async () => {
    const stub = supabaseStub({ isAdmin: true });
    createClient.mockReturnValue(stub);
    const res = await publishStory({ ...valid, body: "far too short" });
    expect(res.ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_publish_story", expect.anything());
  });
});
