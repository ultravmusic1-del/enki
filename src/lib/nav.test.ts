import { describe, it, expect } from "vitest";
import { activeBeatFor, isNavActive } from "@/lib/nav";

describe("isNavActive", () => {
  it.each([
    ["/", "/", true],
    ["/", "/news", true],
    ["/", "/news/beat/research", true],
    ["/", "/news/some-story-31fc2b", true],
    ["/", "/newsletter", false],
    ["/", "/tools", false],
    ["/tools", "/tools", true],
    ["/tools", "/tools/cursor", true],
    ["/tools", "/news", false],
    ["/deals", "/deals", true],
    ["/finder", "/finder/results", true],
  ])("%s on %s is %s", (href, pathname, expected) => {
    expect(isNavActive(href, pathname)).toBe(expected);
  });
});

describe("activeBeatFor", () => {
  it.each([
    ["/", "latest"],
    ["/news", "latest"],
    ["/news/page/2", "latest"],
    ["/news/beat/research", "research"],
    ["/news/beat/sports", null],
    ["/news/some-story-31fc2b", null],
    ["/tools", null],
  ])("%s → %s", (pathname, expected) => {
    expect(activeBeatFor(pathname)).toBe(expected);
  });
});
