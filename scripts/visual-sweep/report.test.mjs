import { describe, it, expect } from "vitest";
import {
  dedupeProblems,
  isIgnorableConsoleError,
  isStyled,
  selectRoutes,
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

describe("isStyled", () => {
  it("accepts a real Tailwind page", () => {
    expect(
      isStyled({ ruleCount: 1200, fontFamily: '"Hanken Grotesk", sans-serif' }),
    ).toBe(true);
  });

  it("rejects a page serving no stylesheets at all", () => {
    expect(isStyled({ ruleCount: 0, fontFamily: '"Times New Roman", serif' })).toBe(
      false,
    );
  });

  it("rejects a browser-default serif even when some rules loaded", () => {
    // A stale server can still serve a stub stylesheet. The default font is the
    // stronger signal that the real bundle never arrived.
    expect(
      isStyled({ ruleCount: 300, fontFamily: '"Times New Roman"' }),
    ).toBe(false);
  });

  it("rejects a page with too few rules for a Tailwind build", () => {
    expect(isStyled({ ruleCount: 12, fontFamily: "Inter, sans-serif" })).toBe(
      false,
    );
  });

  it("treats a bare serif or sans-serif as a browser default", () => {
    expect(isStyled({ ruleCount: 1200, fontFamily: "serif" })).toBe(false);
  });
});

describe("selectRoutes", () => {
  it("defaults to / and /tools when no positional args are given", () => {
    expect(selectRoutes([])).toEqual({ ok: true, routes: ["/", "/tools"] });
  });

  it("defaults to / and /tools when only --base is given", () => {
    expect(
      selectRoutes(["--base", "http://localhost:3100"]),
    ).toEqual({ ok: true, routes: ["/", "/tools"] });
  });

  it("uses explicit routes when they are all recognized", () => {
    expect(selectRoutes(["/tools/cursor", "/best/writing"])).toEqual({
      ok: true,
      routes: ["/tools/cursor", "/best/writing"],
    });
  });

  it("does not mistake the --base URL for a route", () => {
    expect(
      selectRoutes(["--base", "http://localhost:3100", "/tools/cursor"]),
    ).toEqual({ ok: true, routes: ["/tools/cursor"] });
  });

  it("ignores the literal -- that pnpm forwards through, not a route", () => {
    // `pnpm sweep -- --base URL /route` puts a literal "--" in argv ahead of
    // everything else; it must not be misdiagnosed as an unrecognized route.
    expect(
      selectRoutes(["--", "--base", "http://localhost:3100", "/tools/cursor"]),
    ).toEqual({ ok: true, routes: ["/tools/cursor"] });
  });

  it("fails when every positional argument was mangled by Git Bash's path conversion", () => {
    // This is what Git Bash actually turns a bare `/tools` into.
    const result = selectRoutes([
      "--base",
      "http://localhost:3100",
      "C:/Program Files/Git/tools",
    ]);
    expect(result.ok).toBe(false);
    expect(result.positionals).toEqual(["C:/Program Files/Git/tools"]);
    expect(result.unrecognized).toEqual(["C:/Program Files/Git/tools"]);
  });

  it("fails on a mix of a good route and a mangled one, naming the bad one", () => {
    const result = selectRoutes(["/tools", "C:/Program Files/Git/tools"]);
    expect(result.ok).toBe(false);
    expect(result.positionals).toEqual([
      "/tools",
      "C:/Program Files/Git/tools",
    ]);
    expect(result.unrecognized).toEqual(["C:/Program Files/Git/tools"]);
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
