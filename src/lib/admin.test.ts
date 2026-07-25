import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));

const { assertAdmin, requireAdmin } = await import("@/lib/admin");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin: assertAdmin", () => {
  it("returns the user id for an admin", async () => {
    createClient.mockReturnValue(supabaseStub({ user: { id: "u-9" }, isAdmin: true }));
    await expect(assertAdmin()).resolves.toEqual({ ok: true, userId: "u-9" });
  });

  it("reports unauthenticated when there is no session", async () => {
    createClient.mockReturnValue(supabaseStub({ user: null }));
    const result = await assertAdmin();
    expect(result).toMatchObject({ ok: false, reason: "unauthenticated" });
  });

  it("reports forbidden for a signed-in non-admin", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    const result = await assertAdmin();
    expect(result).toMatchObject({ ok: false, reason: "forbidden" });
  });

  it("fails closed when the admin check itself errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdminError: { message: "connection refused" } }),
    );
    const result = await assertAdmin();
    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("never leaks the underlying error to the caller", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdminError: { message: "connection refused" } }),
    );
    const result = await assertAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("connection refused");
  });
});

describe("admin: requireAdmin", () => {
  it("sends a signed-out visitor to the login page", async () => {
    createClient.mockReturnValue(supabaseStub({ user: null }));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login?redirect=/admin");
  });

  it("sends a signed-in non-admin home", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("returns the user id for an admin", async () => {
    createClient.mockReturnValue(supabaseStub({ user: { id: "u-3" }, isAdmin: true }));
    await expect(requireAdmin()).resolves.toBe("u-3");
  });
});
