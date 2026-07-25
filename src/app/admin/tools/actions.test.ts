import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";
import { tools } from "@/data/tools";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

const invalidateToolCache = vi.fn();
vi.mock("@/lib/content", () => ({
  invalidateToolCache: () => invalidateToolCache(),
}));

const { saveTool, deleteTool } = await import("@/app/admin/tools/actions");

const validToolJson = JSON.stringify(tools[0]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tool CMS actions: deleteTool", () => {
  it("refuses a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await deleteTool("cursor");
    expect(res.ok).toBe(false);
  });

  it("does not invalidate caches or revalidate for a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    await deleteTool("cursor");
    expect(invalidateToolCache).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not revalidate when no row was deleted", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [], error: null } }),
    );
    const res = await deleteTool("not-in-db");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the whole app after a real delete", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        table: { data: [{ slug: "cursor" }], error: null },
      }),
    );
    const res = await deleteTool("cursor");
    expect(res.ok).toBe(true);
    expect(invalidateToolCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("tool CMS actions: saveTool", () => {
  it("refuses a non-admin caller before parsing the payload", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await saveTool(validToolJson, true);
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON for an admin", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    const res = await saveTool("{ not json", true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("JSON");
  });

  it("rejects a payload that fails the tool schema", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    const res = await saveTool(JSON.stringify({ slug: "x" }), true);
    expect(res.ok).toBe(false);
  });

  it("saves a valid tool and revalidates", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        table: { data: [{ slug: tools[0].slug }], error: null },
      }),
    );
    const res = await saveTool(validToolJson, true);
    expect(res).toMatchObject({ ok: true, slug: tools[0].slug });
    expect(invalidateToolCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not leak raw database errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        table: {
          data: null,
          error: { message: 'duplicate key value violates "tools_pkey"' },
        },
      }),
    );
    const res = await saveTool(validToolJson, true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("tools_pkey");
  });
});
