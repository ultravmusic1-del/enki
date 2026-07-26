import { describe, it, expect } from "vitest";
import { isDepsStale } from "./deps.mjs";

describe("isDepsStale", () => {
  it("is stale when nothing has been installed", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: null })).toBe(true);
  });

  it("is stale when the lockfile is newer than the last install", () => {
    expect(isDepsStale({ lockMtimeMs: 200, modulesMtimeMs: 100 })).toBe(true);
  });

  it("is fresh when the install came after the lockfile", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: 200 })).toBe(false);
  });

  it("is fresh when the timestamps match exactly", () => {
    expect(isDepsStale({ lockMtimeMs: 100, modulesMtimeMs: 100 })).toBe(false);
  });
});
