import { describe, it, expect } from "vitest";
import { graphSyncPlan } from "./graph-sync-plan.mjs";

const refs = (...names) => new Set(names);

describe("graphSyncPlan", () => {
  it("re-parses the single new commit after a normal commit", () => {
    expect(graphSyncPlan("post-commit", refs("HEAD~1"))).toEqual({
      base: "HEAD~1",
    });
  });

  it("falls back to a full rebuild on a root commit", () => {
    expect(graphSyncPlan("post-commit", refs())).toEqual({ fullRebuild: true });
  });

  it("spans the whole pull after a merge, not just its last commit", () => {
    // A fast-forward pull moves HEAD many commits at once. HEAD~1 would leave
    // every file touched before the final commit unparsed.
    expect(graphSyncPlan("post-merge", refs("HEAD~1", "ORIG_HEAD"))).toEqual({
      base: "ORIG_HEAD",
    });
  });

  it("still updates after a merge when ORIG_HEAD is missing", () => {
    expect(graphSyncPlan("post-merge", refs("HEAD~1"))).toEqual({
      base: "HEAD~1",
    });
  });

  it("spans the rewritten range after a rebase or amend", () => {
    expect(graphSyncPlan("post-rewrite", refs("HEAD~1", "ORIG_HEAD"))).toEqual({
      base: "ORIG_HEAD",
    });
  });

  it("treats an unrecognised event as an ordinary commit", () => {
    expect(graphSyncPlan("post-checkout", refs("HEAD~1"))).toEqual({
      base: "HEAD~1",
    });
  });
});
