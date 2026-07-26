import { describe, it, expect } from "vitest";
import { parseAheadBehind, countDirtyFiles } from "./git.mjs";

describe("parseAheadBehind", () => {
  // `git rev-list --left-right --count origin/main...HEAD` prints "behind<TAB>ahead".
  it("reads behind and ahead from the counts", () => {
    expect(parseAheadBehind("3\t5\n")).toEqual({ behind: 3, ahead: 5 });
  });

  it("reads a synced branch as zero and zero", () => {
    expect(parseAheadBehind("0\t0\n")).toEqual({ behind: 0, ahead: 0 });
  });

  it("falls back to zero when there is no upstream to compare", () => {
    expect(parseAheadBehind("")).toEqual({ behind: 0, ahead: 0 });
  });
});

describe("countDirtyFiles", () => {
  it("counts each porcelain line", () => {
    expect(countDirtyFiles(" M src/a.ts\n?? src/b.ts\n")).toBe(2);
  });

  it("counts a clean tree as zero", () => {
    expect(countDirtyFiles("")).toBe(0);
  });

  it("ignores trailing blank lines", () => {
    expect(countDirtyFiles(" M src/a.ts\n\n")).toBe(1);
  });
});
