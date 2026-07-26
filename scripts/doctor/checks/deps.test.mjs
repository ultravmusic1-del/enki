import { describe, it, expect } from "vitest";
import { isDepsStale } from "./deps.mjs";

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
});
