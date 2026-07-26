import { describe, it, expect } from "vitest";
import { ANON_INVISIBLE_TABLES, judge } from "./expectations.mjs";

describe("ANON_INVISIBLE_TABLES", () => {
  it("covers every table holding private or operational data", () => {
    expect(ANON_INVISIBLE_TABLES).toEqual([
      "admins",
      "collections",
      "outbound_clicks",
      "profiles",
      "reviews",
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
