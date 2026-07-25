import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

const { setReviewStatus, setSubmissionStatus } = await import("@/app/admin/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin actions: setReviewStatus", () => {
  it("rejects a status outside the whitelist", async () => {
    createClient.mockReturnValue(supabaseStub());
    // @ts-expect-error deliberately invalid status
    const res = await setReviewStatus("r-1", "published");
    expect(res.ok).toBe(false);
  });

  it("refuses a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await setReviewStatus("r-1", "approved");
    expect(res.ok).toBe(false);
  });

  it("does not revalidate anything for a non-admin caller", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    await setReviewStatus("r-1", "approved");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("writes through the guarded RPC, never a direct table update", async () => {
    const stub = supabaseStub({
      isAdmin: true,
      rpc: { admin_set_review_status: { data: true, error: null } },
    });
    createClient.mockReturnValue(stub);

    const res = await setReviewStatus("r-1", "approved");

    expect(res.ok).toBe(true);
    expect(stub.rpc).toHaveBeenCalledWith("admin_set_review_status", {
      review_id: "r-1",
      new_status: "approved",
    });
    expect(stub.from).not.toHaveBeenCalled();
  });

  it("reports a miss when the RPC matched no row", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: { admin_set_review_status: { data: false, error: null } },
      }),
    );
    const res = await setReviewStatus("nope", "approved");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts the pending status", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: { admin_set_review_status: { data: true, error: null } },
      }),
    );
    await expect(setReviewStatus("r-1", "pending")).resolves.toMatchObject({
      ok: true,
    });
  });

  it("does not leak raw database errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: {
          admin_set_review_status: {
            data: null,
            error: { message: 'relation "reviews" does not exist' },
          },
        },
      }),
    );
    const res = await setReviewStatus("r-1", "approved");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("relation");
  });
});

describe("admin actions: setSubmissionStatus", () => {
  it("refuses a non-admin caller and revalidates nothing", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const res = await setSubmissionStatus("s-1", "approved");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the admin page after a real update", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [{ id: "s-1" }], error: null } }),
    );
    const res = await setSubmissionStatus("s-1", "approved");
    expect(res.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("reports a miss when no submission row matched", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: [], error: null } }),
    );
    const res = await setSubmissionStatus("gone", "approved");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
