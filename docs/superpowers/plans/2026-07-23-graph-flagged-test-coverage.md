# Graph-Flagged Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-value gaps behind the code-review-graph's "high risk / 95 test gaps" warning by adding regression tests for the untested pure logic added this session.

**Architecture:** These are characterization/regression tests against the real seed data (matching the existing `content.test.ts` style) — the code already exists and works, so each test asserts current correct behavior; a failure reveals a real bug. Node/vitest environment, no React or mocks.

**Tech Stack:** Vitest, TypeScript, existing `@/lib` path alias.

**Scope note:** The graph also emitted 12 "high coupling" warnings. These are intentionally **out of scope** — they are normal fan-in to the two shared hub modules (`lib-tools`, `shared-card`) and the UI-primitive grab-bag (`ui-dropdown`); refactoring them would be churn with no correctness benefit (YAGNI). This plan targets only the genuine actionable finding: missing tests.

---

### Task 1: Cover `getLeaderboards`

**Files:**
- Modify: `src/lib/content.test.ts` (add import + one `describe` block)

- [ ] **Step 1: Add `getLeaderboards` to the existing import in `src/lib/content.test.ts`**

Add `getLeaderboards` to the import list from `@/lib/content`.

- [ ] **Step 2: Append the test block**

```ts
describe("content: leaderboards", () => {
  it("returns both boards capped at the requested limit", () => {
    const { editor, user } = getLeaderboards(15);
    expect(editor).toHaveLength(15);
    expect(user).toHaveLength(15);
    const small = getLeaderboards(5);
    expect(small.editor).toHaveLength(5);
    expect(small.user).toHaveLength(5);
  });

  it("orders the editor board by descending editor score with 1-based ranks", () => {
    const { editor } = getLeaderboards(15);
    expect(editor[0].rank).toBe(1);
    expect(editor[editor.length - 1].rank).toBe(editor.length);
    for (let i = 1; i < editor.length; i++) {
      expect(editor[i - 1].editorScore).toBeGreaterThanOrEqual(
        editor[i].editorScore,
      );
    }
  });

  it("orders the user board by rating, breaking ties by review count", () => {
    const { user } = getLeaderboards(15);
    for (let i = 1; i < user.length; i++) {
      const prev = user[i - 1];
      const cur = user[i];
      const ok =
        prev.rating > cur.rating ||
        (prev.rating === cur.rating && prev.reviewCount >= cur.reviewCount);
      expect(ok).toBe(true);
    }
  });

  it("carries each entry's standing on the other board", () => {
    const { editor } = getLeaderboards(15);
    expect(editor[0].editorRank).toBe(1);
    expect(editor[0].userRank).toBeGreaterThanOrEqual(1);
  });

  it("puts Cursor atop editors and Midjourney atop the community", () => {
    const { editor, user } = getLeaderboards(15);
    expect(editor[0].slug).toBe("cursor");
    expect(user[0].slug).toBe("midjourney");
  });
});
```

- [ ] **Step 3: Run and verify pass**

Run: `pnpm test`
Expected: PASS (new "content: leaderboards" suite green).

---

### Task 2: Cover `getCompareTools`

**Files:**
- Modify: `src/lib/content.test.ts` (add import + one `describe` block)

- [ ] **Step 1: Add `getCompareTools` to the import list**

- [ ] **Step 2: Append the test block**

```ts
describe("content: compare tools", () => {
  it("returns every tool, sorted by name", () => {
    const compare = getCompareTools();
    expect(compare).toHaveLength(getAllTools().length);
    const names = compare.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("caps pros and cons at three each", () => {
    for (const c of getCompareTools()) {
      expect(c.pros.length).toBeLessThanOrEqual(3);
      expect(c.cons.length).toBeLessThanOrEqual(3);
    }
  });

  it("exposes a valid pricing model and a boolean free-trial flag", () => {
    for (const c of getCompareTools()) {
      expect(["free", "freemium", "paid", "enterprise"]).toContain(
        c.pricingModel,
      );
      expect(typeof c.hasFreeTrial).toBe("boolean");
    }
  });

  it("mirrors the source tool's scores and platforms", () => {
    const cursor = getCompareTools().find((c) => c.slug === "cursor")!;
    const source = getToolBySlug("cursor")!;
    expect(cursor.editorScore).toBe(source.editorScore);
    expect(cursor.rating).toBe(source.rating);
    expect(cursor.platforms).toEqual(source.platforms);
  });
});
```

- [ ] **Step 3: Run and verify pass**

Run: `pnpm test`
Expected: PASS.

---

### Task 3: Cover the `structured-data` builders

**Files:**
- Create: `src/lib/structured-data.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from "vitest";
import { siteJsonLd, toolJsonLd } from "@/lib/structured-data";
import { getToolBySlug, getReviewsForTool } from "@/lib/content";

type Node = { "@type"?: string; [k: string]: unknown };

function graphOf(data: unknown): Node[] {
  return (data as { "@graph": Node[] })["@graph"];
}
function nodeOfType(nodes: Node[], type: string): Node {
  const n = nodes.find((x) => x["@type"] === type);
  if (!n) throw new Error(`no ${type} node`);
  return n;
}

describe("structured-data: site", () => {
  it("emits an Organization and a WebSite with a search action", () => {
    const data = siteJsonLd() as { "@context": string };
    expect(data["@context"]).toBe("https://schema.org");
    const graph = graphOf(data);
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(nodeOfType(graph, "WebSite").potentialAction).toBeTruthy();
  });
});

describe("structured-data: tool", () => {
  const tool = getToolBySlug("cursor")!;
  const reviews = getReviewsForTool("cursor");
  const graph = graphOf(
    toolJsonLd({ tool, categoryName: "Coding & Dev", reviews }),
  );

  it("emits a SoftwareApplication whose rating mirrors the tool", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    const agg = app.aggregateRating as {
      ratingValue: number;
      reviewCount: number;
    };
    expect(agg.ratingValue).toBe(tool.rating);
    expect(agg.reviewCount).toBe(tool.reviewCount);
    expect(String(app.url)).toContain("/tools/cursor");
  });

  it("caps embedded reviews at five", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect((app.review as unknown[]).length).toBeLessThanOrEqual(5);
  });

  it("prices a freemium tool at zero", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    const offer = app.offers as { price: string } | undefined;
    expect(offer?.price).toBe("0");
  });

  it("emits a 3-item breadcrumb ending at the tool", () => {
    const crumb = nodeOfType(graph, "BreadcrumbList");
    const items = crumb.itemListElement as Array<{ name: string }>;
    expect(items).toHaveLength(3);
    expect(items[2].name).toBe(tool.name);
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `pnpm test`
Expected: PASS (new "structured-data" suites green).

---

### Task 4: Verify the whole suite + gates

- [ ] **Step 1: Typecheck, lint, full test run**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: no type errors, no lint errors, all tests pass (31 existing + new).

- [ ] **Step 2: Re-index the graph and confirm the gap shrank**

Run: `code-review-graph update && code-review-graph status`
Expected: `Test` node count and `TESTED_BY` edges increase.
