// @vitest-environment node
// The directive must be the first line: the route uses NextRequest/Response,
// which the project's default jsdom environment doesn't provide faithfully.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const runNewsIngest = vi.fn();
vi.mock("@/lib/news/run-ingest", () => ({ runNewsIngest: () => runNewsIngest() }));

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  withMonitor: (_slug: string, callback: () => unknown) => callback(),
  captureException: (...args: unknown[]) => captureException(...args),
  flush: async () => true,
}));

const { GET } = await import("@/app/api/ingest-news/route");

function request(auth?: string) {
  return new NextRequest("http://localhost/api/ingest-news", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/ingest-news", () => {
  it("refuses a request without the cron secret", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(runNewsIngest).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request("Bearer "));
    expect(res.status).toBe(401);
    expect(runNewsIngest).not.toHaveBeenCalled();
  });

  it("runs ingestion and returns the summary", async () => {
    runNewsIngest.mockResolvedValue({ sources: 2, fetched: 5, inserted: 3, failed: ["Beta"] });
    const res = await GET(request("Bearer cron-secret"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      sources: 2,
      fetched: 5,
      inserted: 3,
      failed: ["Beta"],
    });
  });

  it("returns 503 when every source failed", async () => {
    runNewsIngest.mockResolvedValue({ sources: 2, fetched: 0, inserted: 0, failed: ["A", "B"] });
    const res = await GET(request("Bearer cron-secret"));
    expect(res.status).toBe(503);
    expect(captureException).toHaveBeenCalled();
  });

  it("returns 503 when ingestion throws", async () => {
    runNewsIngest.mockRejectedValue(new Error("not authorized"));
    const res = await GET(request("Bearer cron-secret"));
    expect(res.status).toBe(503);
  });
});
