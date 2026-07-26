import { describe, it, expect } from "vitest";
import {
  dedupeProblems,
  isIgnorableConsoleError,
  summarize,
} from "./report.mjs";

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

describe("isIgnorableConsoleError", () => {
  it("ignores a Vercel Analytics 404 identified by its request URL", () => {
    // The 404 line carries no URL in its text, only in the message location.
    expect(
      isIgnorableConsoleError({
        text: "Failed to load resource: the server responded with a status of 404 (Not Found)",
        url: "http://localhost:3100/_vercel/insights/script.js",
      }),
    ).toBe(true);
  });

  it("ignores a Speed Insights MIME type refusal named in the text", () => {
    expect(
      isIgnorableConsoleError({
        text: "Refused to execute script from 'http://localhost:3100/_vercel/speed-insights/script.js' because its MIME type ('text/html') is not executable",
        url: "",
      }),
    ).toBe(true);
  });

  it("keeps a real application error", () => {
    expect(
      isIgnorableConsoleError({
        text: "TypeError: Cannot read properties of undefined (reading 'slug')",
        url: "http://localhost:3100/tools",
      }),
    ).toBe(false);
  });

  it("keeps a 404 for an actual app asset", () => {
    expect(
      isIgnorableConsoleError({
        text: "Failed to load resource: the server responded with a status of 404 (Not Found)",
        url: "http://localhost:3100/screenshots/cursor/hero.png",
      }),
    ).toBe(false);
  });

  it("tolerates missing fields", () => {
    expect(isIgnorableConsoleError({})).toBe(false);
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
