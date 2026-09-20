import { describe, it, expect } from "vitest";
import { isDepsStale, lockfilesMatch } from "./deps.mjs";

describe("isDepsStale", () => {
  it("is stale when nothing has been installed", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: null })).toBe(true);
  });

  it("is stale when the lockfile is meaningfully newer than the last install", () => {
    expect(isDepsStale({ lockMtimeMs: 60_000, modulesMtimeMs: 100 })).toBe(true);
  });

  it("is fresh when the lockfile is newer only by install write ordering", () => {
    // pnpm writes .modules.yaml and then the lockfile in the same install, so a
    // sub-second gap in this direction is normal, not drift.
    expect(isDepsStale({ lockMtimeMs: 1_000_200, modulesMtimeMs: 1_000_000 })).toBe(
      false,
    );
  });

  it("honours an explicit tolerance", () => {
    expect(
      isDepsStale({ lockMtimeMs: 200, modulesMtimeMs: 100, toleranceMs: 0 }),
    ).toBe(true);
  });

  it("is fresh when the install came after the lockfile", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: 200 })).toBe(false);
  });

  it("is fresh when the timestamps match exactly", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: 100 })).toBe(false);
  });

  // --- content comparison (node_modules/.pnpm/lock.yaml present) -----------

  it("is fresh when lockfile content matches, even with a 19s mtime gap", () => {
    // This is the regression that motivated content comparison: a slow
    // install can leave a >5s gap between .modules.yaml and pnpm-lock.yaml
    // even though the install is perfectly up to date.
    expect(
      isDepsStale({
        lockMtimeMs: 19_000,
        modulesMtimeMs: 0,
        repoLock: "lockfile content\n",
        installedLock: "lockfile content\n",
      }),
    ).toBe(false);
  });

  it("is stale when lockfile content differs, regardless of mtimes", () => {
    expect(
      isDepsStale({
        lockMtimeMs: 100,
        modulesMtimeMs: 200, // would read "fresh" under mtime rules
        repoLock: "new content\n",
        installedLock: "old content\n",
      }),
    ).toBe(true);
  });

  it("is fresh when the only difference is CRLF vs LF", () => {
    expect(
      isDepsStale({
        lockMtimeMs: 100,
        modulesMtimeMs: 0,
        repoLock: "lockfile:\r\n  a: 1\r\n",
        installedLock: "lockfile:\n  a: 1\n",
      }),
    ).toBe(false);
  });

  it("falls back to mtime comparison when the installed lockfile copy is missing", () => {
    expect(
      isDepsStale({
        lockMtimeMs: 60_000,
        modulesMtimeMs: 100,
        repoLock: "content\n",
        installedLock: null,
      }),
    ).toBe(true);

    expect(
      isDepsStale({
        lockMtimeMs: 1_000_200,
        modulesMtimeMs: 1_000_000,
        repoLock: "content\n",
        installedLock: undefined,
      }),
    ).toBe(false);
  });

  it("is stale when .modules.yaml is missing, even if lockfile content matches", () => {
    expect(
      isDepsStale({
        lockMtimeMs: 100,
        modulesMtimeMs: null,
        repoLock: "same\n",
        installedLock: "same\n",
      }),
    ).toBe(true);
  });
});

describe("lockfilesMatch", () => {
  it("matches identical content", () => {
    expect(lockfilesMatch("a: 1\n", "a: 1\n")).toBe(true);
  });

  it("ignores CRLF vs LF differences", () => {
    expect(lockfilesMatch("a: 1\r\nb: 2\r\n", "a: 1\nb: 2\n")).toBe(true);
  });

  it("does not match differing content", () => {
    expect(lockfilesMatch("a: 1\n", "a: 2\n")).toBe(false);
  });

  it("does not match when installedLock is null or undefined", () => {
    expect(lockfilesMatch("a: 1\n", null)).toBe(false);
    expect(lockfilesMatch("a: 1\n", undefined)).toBe(false);
  });
});
