import { describe, it, expect } from "vitest";
import { dedupeProblems, summarize } from "./report.mjs";

const problem = (container, child) => ({
  container,
  child,
  overflowRight: 12,
  overflowLeft: 0,
});

describe("dedupeProblems", () => {
  it("collapses repeats of the same container and child pair", () => {
    const problems = [
      problem("div.card", "span.badge"),
      problem("div.card", "span.badge"),
    ];
    expect(dedupeProblems(problems)).toHaveLength(1);
  });

  it("keeps distinct pairs", () => {
    const problems = [
      problem("div.card", "span.badge"),
      problem("div.card", "span.price"),
    ];
    expect(dedupeProblems(problems)).toHaveLength(2);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeProblems([])).toEqual([]);
  });
});

describe("summarize", () => {
  it("passes when every route is clean", () => {
    const result = summarize([
      { route: "/", viewport: "narrow", consoleErrors: [], problems: [] },
    ]);
    expect(result.ok).toBe(true);
    expect(result.failureCount).toBe(0);
  });

  it("fails when a console error is present", () => {
    const result = summarize([
      {
        route: "/",
        viewport: "narrow",
        consoleErrors: ["boom"],
        problems: [],
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("fails when an element overflows its clipping container", () => {
    const result = summarize([
      {
        route: "/tools",
        viewport: "wide",
        consoleErrors: [],
        problems: [problem("div.card", "span.badge")],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failureCount).toBe(1);
  });

  it("counts each failing route and viewport separately", () => {
    const result = summarize([
      { route: "/", viewport: "narrow", consoleErrors: ["a"], problems: [] },
      {
        route: "/",
        viewport: "wide",
        consoleErrors: [],
        problems: [problem("div.card", "span.badge")],
      },
    ]);
    expect(result.failureCount).toBe(2);
  });
});
