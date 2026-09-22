import { describe, it, expect } from "vitest";
import {
  ANON_INVISIBLE_QUERIES,
  ANON_INVISIBLE_TABLES,
  ANON_REFUSED_RPCS,
  judge,
  judgeQuery,
  judgeRpc,
} from "./expectations.mjs";

describe("ANON_INVISIBLE_TABLES", () => {
  it("covers every table holding private or operational data", () => {
    expect(ANON_INVISIBLE_TABLES).toEqual([
      "admins",
      "collections",
      "news_sources",
      "outbound_clicks",
      "profiles",
      "reviews",
      "story_excerpts",
      "story_views",
      "subscribers",
      "tool_submissions",
    ]);
  });
});

describe("judge", () => {
  it("passes when an anon read returns no rows", () => {
    expect(judge("subscribers", { status: 200, rows: [] }).ok).toBe(true);
  });

  it("passes when the request is refused outright", () => {
    expect(judge("admins", { status: 401, rows: null }).ok).toBe(true);
  });

  it("fails when rows leak", () => {
    const verdict = judge("profiles", { status: 200, rows: [{ id: "x" }] });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("1 row");
  });

  it("reports the row count so the leak size is obvious", () => {
    const verdict = judge("reviews", {
      status: 200,
      rows: [{ id: "a" }, { id: "b" }],
    });
    expect(verdict.detail).toContain("2 row");
  });
});

describe("query probes", () => {
  it("probe unpublished stories and their tools", () => {
    expect(ANON_INVISIBLE_QUERIES.map((q) => q.label)).toEqual([
      "stories (unpublished)",
      "story_tools (unpublished)",
      "stories (merged)",
    ]);
  });

  it("pass on an empty 200", () => {
    expect(judgeQuery("q", { status: 200, rows: [] }).ok).toBe(true);
  });

  it("fail when rows leak", () => {
    expect(judgeQuery("q", { status: 200, rows: [{ id: 1 }] }).ok).toBe(false);
  });

  it("fail when the probe itself errors, so a broken probe cannot pass silently", () => {
    const verdict = judgeQuery("q", { status: 400, rows: null });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("400");
  });
});

describe("rpc probes", () => {
  it("cover the ingest and admin news functions", () => {
    expect(ANON_REFUSED_RPCS.map((r) => r.fn)).toEqual([
      "ingest_sources",
      "ingest_story",
      "touch_news_source",
      "admin_publish_story",
      "admin_set_story_status",
      "admin_merge_story",
    ]);
  });

  it("pass when the call is refused", () => {
    expect(judgeRpc("f", { status: 401, body: null }).ok).toBe(true);
    expect(judgeRpc("f", { status: 403, body: null }).ok).toBe(true);
  });

  it("fail when the call succeeds", () => {
    expect(judgeRpc("f", { status: 200, body: true }).ok).toBe(false);
    expect(judgeRpc("f", { status: 200, body: [] }).ok).toBe(false);
  });

  it("fail when the function is missing or its signature changed (PGRST202), so a renamed function cannot pass silently", () => {
    const verdict = judgeRpc("f", { status: 404, body: { code: "PGRST202" } });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("fix the probe");
  });

  it("fail on a server error, so an RPC that stopped being callable cannot pass silently", () => {
    expect(judgeRpc("f", { status: 500, body: null }).ok).toBe(false);
  });
});
