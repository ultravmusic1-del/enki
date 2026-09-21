// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const allowWrite = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ allowWrite: (...a: unknown[]) => allowWrite(...a) }));

const insert = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: () => ({ from: () => ({ insert }) }),
}));

const { POST } = await import("@/app/api/story-view/route");

const STORY = "31fc2bfe-a1c9-467d-9306-de8ae4cf1091";
const post = (body: string) =>
  POST(new NextRequest("http://localhost/api/story-view", { method: "POST", body }));

beforeEach(() => {
  vi.clearAllMocks();
  allowWrite.mockResolvedValue(true);
  insert.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/story-view", () => {
  it("rejects a body that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    expect((await post(JSON.stringify({ storyId: "1 or 1=1" }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("records a view of a valid story with .insert()", async () => {
    const res = await post(JSON.stringify({ storyId: STORY }));
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledWith({ story_id: STORY });
  });

  it("answers 204 without recording when rate limited", async () => {
    allowWrite.mockResolvedValue(false);
    expect((await post(JSON.stringify({ storyId: STORY }))).status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats an RLS refusal (unpublished story) as expected, not an error", async () => {
    insert.mockResolvedValue({ error: { code: "42501" } });
    expect((await post(JSON.stringify({ storyId: STORY }))).status).toBe(204);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs any other database error but still answers 204", async () => {
    insert.mockResolvedValue({ error: { code: "08006", message: "connection failure" } });
    expect((await post(JSON.stringify({ storyId: STORY }))).status).toBe(204);
    expect(console.error).toHaveBeenCalled();
  });
});
