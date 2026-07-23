import { describe, it, expect } from "vitest";
import {
  STALE_AFTER_DAYS,
  toolsNeedingRevet,
  vettingStatus,
} from "@/lib/freshness";

const NOW = new Date("2026-07-23T12:00:00Z");

describe("freshness: vettingStatus", () => {
  it("treats a missing date as never vetted", () => {
    expect(vettingStatus(undefined, NOW)).toEqual({
      state: "never",
      daysAgo: null,
    });
  });

  it("treats an unparseable date as never vetted", () => {
    expect(vettingStatus("not-a-date", NOW)).toEqual({
      state: "never",
      daysAgo: null,
    });
  });

  it("marks a recent vetting as fresh", () => {
    expect(vettingStatus("2026-07-20", NOW)).toEqual({
      state: "fresh",
      daysAgo: 3,
    });
  });

  it("is still fresh exactly at the threshold", () => {
    // 90 days before 2026-07-23 is 2026-04-24
    const status = vettingStatus("2026-04-24", NOW);
    expect(status.daysAgo).toBe(STALE_AFTER_DAYS);
    expect(status.state).toBe("fresh");
  });

  it("becomes stale one day past the threshold", () => {
    const status = vettingStatus("2026-04-23", NOW);
    expect(status.daysAgo).toBe(STALE_AFTER_DAYS + 1);
    expect(status.state).toBe("stale");
  });
});

describe("freshness: toolsNeedingRevet", () => {
  const tools = [
    { slug: "fresh-one", lastVetted: "2026-07-20" },
    { slug: "stale-older", lastVetted: "2025-01-01" },
    { slug: "never-vetted" },
    { slug: "stale-newer", lastVetted: "2026-01-01" },
  ];

  it("omits fresh tools", () => {
    const result = toolsNeedingRevet(tools, NOW);
    expect(result.some((r) => r.tool.slug === "fresh-one")).toBe(false);
  });

  it("orders never-vetted first, then longest overdue", () => {
    const result = toolsNeedingRevet(tools, NOW);
    expect(result.map((r) => r.tool.slug)).toEqual([
      "never-vetted",
      "stale-older",
      "stale-newer",
    ]);
  });

  it("does not mutate the input", () => {
    const snapshot = tools.map((t) => t.slug);
    toolsNeedingRevet(tools, NOW);
    expect(tools.map((t) => t.slug)).toEqual(snapshot);
  });

  it("returns everything as 'never' when no tool has been vetted", () => {
    const unvetted: { slug: string; lastVetted?: string }[] = [
      { slug: "a" },
      { slug: "b" },
    ];
    const result = toolsNeedingRevet(unvetted, NOW);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status.state === "never")).toBe(true);
  });
});
