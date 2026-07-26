import { describe, it, expect } from "vitest";
import { probeSupabase } from "./supabase.mjs";

describe("probeSupabase", () => {
  it("skips when credentials are absent", async () => {
    const result = await probeSupabase({ url: null, key: null });
    expect(result.status).toBe("skip");
  });

  it("reports awake on a successful response", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200 });
    const result = await probeSupabase({
      url: "https://x.supabase.co",
      key: "k",
      fetchImpl,
    });
    expect(result.status).toBe("awake");
  });

  it("reports unreachable on an error response", async () => {
    const fetchImpl = async () => ({ ok: false, status: 503 });
    const result = await probeSupabase({
      url: "https://x.supabase.co",
      key: "k",
      fetchImpl,
    });
    expect(result.status).toBe("unreachable");
    expect(result.code).toBe(503);
  });

  it("reports asleep when the request throws or times out", async () => {
    const fetchImpl = async () => {
      throw new Error("aborted");
    };
    const result = await probeSupabase({
      url: "https://x.supabase.co",
      key: "k",
      fetchImpl,
    });
    expect(result.status).toBe("asleep");
  });

  it("sends the anon key as the apikey header", async () => {
    let seen = null;
    const fetchImpl = async (_url, init) => {
      seen = init.headers.apikey;
      return { ok: true, status: 200 };
    };
    await probeSupabase({
      url: "https://x.supabase.co",
      key: "anon-key",
      fetchImpl,
    });
    expect(seen).toBe("anon-key");
  });
});
