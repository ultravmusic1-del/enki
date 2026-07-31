# Phase 0 Launch Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Phase 0 item in `docs/roadmap.md` so Enki stops contradicting its own headline claim and is safe to put in front of a first public visitor.

**Architecture:** Three independent workstreams. (1) **Content correctness** — split "alternatives" from "related tools" in the content layer so alternatives pages stop padding with unrelated tools. (2) **Render correctness** — remove `useSearchParams()` from the three client components that use it only to seed initial state, replacing it with a read-after-mount hook; this deletes the prerender bail-out that currently ships crawlers an empty skeleton on `/tools`, `/compare` and `/finder`. (3) **Trust and safety** — an honest single-reviewer byline, a data-driven tool count, a platform-correct shortcut badge, rate limits on the three unauthenticated write paths, a real favicon, and E2E coverage in CI.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4, Zod v4, Supabase (`@supabase/ssr`), Vitest + jsdom, Playwright, `@vercel/firewall` + BotID.

---

## Context you need before starting

You are working in `C:\Users\Vivaan\Desktop\Enki` on branch `main`.

**Read these first:**
- `docs/roadmap.md` — the single to-do list. This plan implements its Phase 0.
- `handoff.md` §8 (conventions) and §10 (gotchas) — non-negotiable project rules.
- `CLAUDE.md` — the **Visual Sweep** rule.

**Rules that will bite you if you ignore them:**

1. **The pre-commit hook runs `pnpm verify`** (typecheck + lint + test) on any commit touching code. A failing gate blocks the commit. Do not use `--no-verify`.
2. **Visual Sweep is mandatory.** Any change to `.tsx`/`.css` must be verified in a real browser before you claim it is done — measure bounding boxes, do not eyeball. Tasks that need it say so explicitly.
3. **No em-dashes in displayed copy.** Comments are exempt. Use a colon, a comma, or a full stop.
4. **Icons are strings** resolved through `src/components/shared/icon.tsx`.
5. **`content.ts` getters are async.** TypeScript enforces it.
6. **Never fabricate** a sponsored tool, deal, coupon, vetting date, reviewer, or rating in the committed seed. This plan adds exactly one author, and that person is real.
7. **Tests stub Supabase** via `src/test/supabase-stub.ts` (wired in `vitest.setup.ts`), so `content.ts` falls back to the git seed under test. You do not need env vars to run `pnpm test`.

**Commands:**

```bash
pnpm verify
```

```bash
pnpm test
```

```bash
pnpm build
```

```bash
pnpm test:e2e
```

```bash
pnpm sweep
```

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/use-search-params-on-mount.ts` | One client hook: read `window.location.search` once after mount, and report when that has happened. The single mechanism replacing `useSearchParams()` in all three components. |
| `src/lib/use-search-params-on-mount.test.ts` | Unit tests for the hook. |
| `src/components/shared/shortcut-hint.tsx` | Platform-aware keyboard badge (`⌘K` on Mac, `Ctrl K` elsewhere). Renders the neutral form during SSR. |
| `src/components/shared/shortcut-hint.test.tsx` | Unit tests for the badge. |
| `src/lib/rate-limit.ts` | One wrapper over `@vercel/firewall` + BotID so the three write paths share a single policy and a single failure mode. |
| `src/lib/rate-limit.test.ts` | Unit tests for the wrapper's decision logic. |
| `src/app/favicon.ico` | The `.ico` Google's SERP fetcher asks for. |
| `tests/e2e/trust.spec.ts` | E2E over the auth gate, `/submit`, and the admin gate. |

**Modified:**

| File | Change |
|---|---|
| `src/lib/content.ts:179-192` | Add `getAlternatives()`; leave `getRelatedTools()` alone. |
| `src/lib/content.test.ts` | Tests for `getAlternatives()`. |
| `src/app/alternatives/[slug]/page.tsx` | Use `getAlternatives()`; gate thin pages; count-safe copy. |
| `src/components/directory/directory-explorer.tsx:56-74,117-127` | Drop `useSearchParams()`; adopt the hook; gate the URL-sync effect. |
| `src/app/tools/page.tsx:1,37-65` | Drop `Suspense` + `DirectorySkeleton`. |
| `src/components/compare/compare-view.tsx:34-61` | Same hook treatment. |
| `src/app/compare/page.tsx:2,36-39` | Drop `Suspense`. |
| `src/components/finder/oracle-finder.tsx:45-64` | Same hook treatment. |
| `src/app/finder/page.tsx:2,26-30` | Drop `Suspense`. |
| `src/components/layout/site-header.tsx:163-165` | Use `<ShortcutHint />`. |
| `src/components/home/oracle-hero.tsx:15,123-126` | Accept `toolCount`; use `<ShortcutHint />`. |
| `src/app/page.tsx` | Pass `toolCount` to `<OracleHero />`. |
| `src/data/authors.ts` | One real byline. |
| ~10 copy sites | "our editors" → first person singular. |
| `src/app/go/[slug]/route.ts`, `src/app/actions/newsletter.ts`, `src/app/submit/actions.ts` | Apply the rate limit. |
| `next.config.ts` | Wrap with `withBotId`. |
| `.github/workflows/verify.yml` | Add a Playwright job. |
| `public/` | Delete five Next template SVGs. |

---

## Task 1: Split alternatives from related tools

The defect: `getRelatedTools()` appends cross-category "fillers" sorted by editor score, so `/alternatives/cursor` lists Midjourney and ElevenLabs. Padding is correct for a "you might also like" rail and wrong for a page titled "best Cursor alternatives". Two functions, two behaviours.

**Files:**
- Modify: `src/lib/content.ts:175-192`
- Test: `src/lib/content.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/content.test.ts`, inside the existing `describe("content: tools", ...)` block. Add `getAlternatives` to the import list at the top of the file.

```ts
  it("returns only same-category tools as alternatives", async () => {
    const cursor = await getToolBySlug("cursor");
    expect(cursor).toBeDefined();
    const alts = await getAlternatives(cursor!, 6);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((t) => t.categorySlug === cursor!.categorySlug)).toBe(
      true,
    );
    expect(alts.some((t) => t.slug === cursor!.slug)).toBe(false);
  });

  it("returns fewer than n rather than padding a sparse category", async () => {
    const cursor = await getToolBySlug("cursor");
    const sameCategory = (await getToolsByCategory(cursor!.categorySlug)).filter(
      (t) => t.slug !== cursor!.slug,
    );
    // Ask for far more than exist. A padded implementation returns 50.
    const alts = await getAlternatives(cursor!, 50);
    expect(alts.length).toBe(sameCategory.length);
  });

  it("orders alternatives by editor score, highest first", async () => {
    const cursor = await getToolBySlug("cursor");
    const alts = await getAlternatives(cursor!, 6);
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i - 1].editorScore).toBeGreaterThanOrEqual(
        alts[i].editorScore,
      );
    }
  });

  it("keeps getRelatedTools padding for the discovery rail", async () => {
    const cursor = await getToolBySlug("cursor");
    const related = await getRelatedTools(cursor!, 6);
    expect(related.length).toBe(6);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/content.test.ts
```

Expected: FAIL. The first three error with `getAlternatives is not a function` (or a TypeScript import error); the fourth passes already.

- [ ] **Step 3: Implement `getAlternatives`**

In `src/lib/content.ts`, leave `getRelatedTools` exactly as it is and add below it (after line 192):

```ts
/**
 * Genuine alternatives to a tool: same category only, best editor score first.
 *
 * Deliberately NOT `getRelatedTools`. That function tops its list up with
 * high-scoring tools from other categories, which is a reasonable discovery
 * rail on a detail page and indefensible on a page titled "the best X
 * alternatives" — it listed an image generator as a Cursor alternative. If a
 * category holds two real alternatives, this returns two. Never pads.
 */
export async function getAlternatives(tool: Tool, n = 6): Promise<Tool[]> {
  return (await loadTools())
    .filter((t) => t.categorySlug === tool.categorySlug && t.slug !== tool.slug)
    .sort((a, b) => b.editorScore - a.editorScore || a.name.localeCompare(b.name))
    .slice(0, n);
}
```

Also update the doc comment on `getRelatedTools` (line 175-178) so the distinction is documented at both sites:

```ts
/**
 * Related tools for the detail-page discovery rail — same category first (by
 * editor score), topped up with the highest rated tools elsewhere until we have
 * `n`. Never includes the source tool.
 *
 * The top-up crosses categories, so this must never back a page that claims its
 * entries are alternatives. Use `getAlternatives` for that.
 */
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/lib/content.test.ts
```

Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content.ts src/lib/content.test.ts
git commit -m "feat(content): add getAlternatives, same-category only, never padded"
```

---

## Task 2: Wire the alternatives page and stop publishing thin ones

`/alternatives/[slug]` currently calls `getRelatedTools(tool, 6)` and generates a page for **every** tool. With Task 1's honest function, a tool in a two-entry category yields one alternative, which is a thin page Google's scaled-content guidance targets. Publish only where there is a real answer.

**Files:**
- Modify: `src/app/alternatives/[slug]/page.tsx`
- Test: `src/lib/content.test.ts` (gate helper)

- [ ] **Step 1: Write the failing test for the publish gate**

Add to `src/lib/content.test.ts`, and add `getAlternativesSlugs` to the imports:

```ts
describe("content: alternatives publishing gate", () => {
  it("only lists slugs with at least three real alternatives", async () => {
    const slugs = await getAlternativesSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const tool = await getToolBySlug(slug);
      expect((await getAlternatives(tool!, 50)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("excludes tools whose category is too sparse to compare", async () => {
    const slugs = new Set(await getAlternativesSlugs());
    const all = await getAllTools();
    for (const tool of all) {
      if ((await getAlternatives(tool, 50)).length < 3) {
        expect(slugs.has(tool.slug)).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/lib/content.test.ts
```

Expected: FAIL with `getAlternativesSlugs is not a function`.

- [ ] **Step 3: Implement the gate helper**

In `src/lib/content.ts`, directly below `getAlternatives`:

```ts
/** Minimum genuine alternatives before an /alternatives page earns publication. */
export const MIN_ALTERNATIVES = 3;

/**
 * Slugs whose alternatives page is worth publishing.
 *
 * A page listing one alternative is a thin page: it is the shape Google's
 * scaled-content guidance targets, and it reads as automation to a human. Tools
 * below the threshold simply have no alternatives page, and 404.
 */
export async function getAlternativesSlugs(): Promise<string[]> {
  const all = await loadTools();
  const out: string[] = [];
  for (const tool of all) {
    const count = all.filter(
      (t) => t.categorySlug === tool.categorySlug && t.slug !== tool.slug,
    ).length;
    if (count >= MIN_ALTERNATIVES) out.push(tool.slug);
  }
  return out.sort();
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/lib/content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Rewrite the page to use both**

Replace lines 9-49 of `src/app/alternatives/[slug]/page.tsx`. The import block becomes:

```tsx
import {
  getAlternatives,
  getAlternativesSlugs,
  getToolBySlug,
  getCategoryBySlug,
} from "@/lib/content";
```

`generateStaticParams` becomes:

```tsx
export async function generateStaticParams() {
  return (await getAlternativesSlugs()).map((slug) => ({ slug }));
}
```

`generateMetadata` becomes (note: no count in the title, because the count is now variable and "6 best" was a lie whenever fewer existed):

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: "Not found" };
  const alts = await getAlternatives(tool, 6);
  return {
    title: `The best ${tool.name} alternatives (2026)`,
    description: `Looking for an alternative to ${tool.name}? My tested picks: ${alts
      .slice(0, 3)
      .map((t) => t.name)
      .join(", ")}.`,
    alternates: { canonical: `/alternatives/${slug}` },
  };
}
```

The page body's data fetch becomes:

```tsx
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) notFound();

  const alts = await getAlternatives(tool, 6);
  if (alts.length < MIN_ALTERNATIVES) notFound();

  const category = await getCategoryBySlug(tool.categorySlug);
```

Add `MIN_ALTERNATIVES` to the import list from `@/lib/content`.

- [ ] **Step 6: Fix the copy that assumed padding**

Every entry is now same-category, so the conditional note at lines 103-107 is dead. Replace the `<RankedToolRow>` block:

```tsx
          {alts.map((t, i) => (
            <RankedToolRow
              key={t.slug}
              rank={i + 1}
              tool={t}
              note={t.verdict}
            />
          ))}
```

And the intro paragraph at lines 74-78, which also drops the "our editors" claim (Task 9 covers the rest):

```tsx
          <p className="text-pretty text-lg text-muted-foreground">
            {tool.name} is a strong {category?.name.toLowerCase() ?? "AI"} tool,
            but it isn&apos;t the only option. Here are the alternatives I rate
            most highly, all in the same category.
          </p>
```

- [ ] **Step 7: Verify the routes and the content**

```bash
pnpm build
```

Expected: the build succeeds and prints fewer `/alternatives/*` routes than before. Record the before and after counts in the commit message.

- [ ] **Step 8: Visual Sweep (MANDATORY, this is a .tsx change)**

Serve the app, then load `/alternatives/cursor`, plus `/` and `/tools` as the always-check pages. Confirm zero console errors, and measure that each `RankedToolRow` stays inside its container at a narrow and a wide viewport. Cite what you measured.

- [ ] **Step 9: Commit**

```bash
git add src/lib/content.ts src/lib/content.test.ts "src/app/alternatives/[slug]/page.tsx"
git commit -m "fix(seo): alternatives pages list only same-category tools

Padded lists put Midjourney on the Cursor alternatives page. Pages with
fewer than three genuine alternatives are no longer published."
```

---

## Task 3: A hook that reads the URL after mount

All three broken pages share one cause: a client component calls `useSearchParams()` purely to seed initial state, which forces Next to bail the subtree out of the prerender, so the static HTML contains the Suspense fallback instead of the content. Reading `window.location.search` in a mount effect gets the same information without the bail.

One subtlety this hook must handle: each of these components also has an effect that syncs state **back** to the URL. If that effect runs before the URL has been read, it replaces the URL using default state and destroys the incoming query string of a shared link. The hook therefore reports readiness, and each sync effect waits for it.

**Files:**
- Create: `src/lib/use-search-params-on-mount.ts`
- Test: `src/lib/use-search-params-on-mount.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchParamsOnMount } from "@/lib/use-search-params-on-mount";

describe("useSearchParamsOnMount", () => {
  it("passes the current query string to the callback once", () => {
    window.history.replaceState({}, "", "/tools?q=cursor&cat=coding");
    const apply = vi.fn();
    renderHook(() => useSearchParamsOnMount(apply));

    expect(apply).toHaveBeenCalledTimes(1);
    const params = apply.mock.calls[0][0] as URLSearchParams;
    expect(params.get("q")).toBe("cursor");
    expect(params.get("cat")).toBe("coding");
  });

  it("still reports ready when there is no query string", () => {
    window.history.replaceState({}, "", "/tools");
    const apply = vi.fn();
    const { result } = renderHook(() => useSearchParamsOnMount(apply));

    expect(apply).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  it("does not re-run when the callback identity changes", () => {
    window.history.replaceState({}, "", "/tools?q=a");
    const first = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useSearchParamsOnMount(cb),
      { initialProps: { cb: first } },
    );
    const second = vi.fn();
    act(() => rerender({ cb: second }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/lib/use-search-params-on-mount.test.ts
```

Expected: FAIL, cannot resolve `@/lib/use-search-params-on-mount`.

- [ ] **Step 3: Implement the hook**

Create `src/lib/use-search-params-on-mount.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Read the URL's query string once, after mount, and report when that is done.
 *
 * This exists to replace `useSearchParams()` in components that only need the
 * query string to seed initial state. Calling `useSearchParams()` opts the
 * enclosing Suspense boundary out of the prerender, so the static HTML ships
 * the fallback: /tools served crawlers six grey skeleton boxes and not one link
 * to a tool. Reading `window.location.search` after mount costs nothing at
 * render time and lets the server emit the real markup.
 *
 * The trade-off is deliberate: a visitor arriving on a filtered link sees the
 * unfiltered view for one frame before the filters apply. Crawlable content is
 * worth more than that frame.
 *
 * The returned boolean gates any effect that writes state back to the URL.
 * Without it, that effect fires first with default state and wipes the very
 * query string this hook is about to read.
 */
export function useSearchParamsOnMount(
  apply: (params: URLSearchParams) => void,
): boolean {
  const applyRef = useRef(apply);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  useEffect(() => {
    applyRef.current(new URLSearchParams(window.location.search));
    setReady(true);
  }, []);

  return ready;
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/lib/use-search-params-on-mount.test.ts
```

Expected: PASS, all three.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-search-params-on-mount.ts src/lib/use-search-params-on-mount.test.ts
git commit -m "feat(render): add useSearchParamsOnMount to avoid prerender bail-out"
```

---

## Task 4: Server-render the directory

`/tools` is the page the whole directory hangs off, and its static HTML contains zero links to any tool.

**Files:**
- Modify: `src/components/directory/directory-explorer.tsx`
- Modify: `src/app/tools/page.tsx`

- [ ] **Step 1: Replace the state seeding in the explorer**

In `src/components/directory/directory-explorer.tsx`, change the import on line 4:

```tsx
import { usePathname, useRouter } from "next/navigation";
```

Add below the existing `@/lib/filters` import:

```tsx
import { useSearchParamsOnMount } from "@/lib/use-search-params-on-mount";
```

Replace lines 54-74 (the router/state block) with:

```tsx
  const router = useRouter();
  const pathname = usePathname();

  // Defaults render on the server and in the first client pass, so the markup
  // matches and the grid is crawlable. The URL is applied just after mount.
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [pricing, setPricing] = useState<PricingModel[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("relevance");

  const urlRead = useSearchParamsOnMount((params) => {
    const q = params.get("q");
    if (q) setQuery(q);
    const cat = params.get("cat");
    if (cat) setCategory(cat);
    const price = parseList(params.get("price")) as PricingModel[];
    if (price.length) setPricing(price);
    const score = Number(params.get("score") ?? 0);
    if (score) setMinScore(score);
    const tags = parseList(params.get("tags"));
    if (tags.length) setSelectedTags(tags);
    const s = params.get("sort") as SortKey | null;
    if (s) setSort(s);
  });
```

- [ ] **Step 2: Gate the URL-sync effect**

Replace the effect at lines 117-127 with:

```tsx
  // Sync state → URL (shallow, no scroll jump). Waits for the initial read:
  // running first with default state would strip a shared link's filters.
  useEffect(() => {
    if (!urlRead) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "all") params.set("cat", category);
    if (pricing.length) params.set("price", pricing.join(","));
    if (minScore) params.set("score", String(minScore));
    if (selectedTags.length) params.set("tags", selectedTags.join(","));
    if (sort !== "relevance") params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    urlRead,
    query,
    category,
    pricing,
    minScore,
    selectedTags,
    sort,
    pathname,
    router,
  ]);
```

- [ ] **Step 3: Remove the Suspense boundary from the page**

In `src/app/tools/page.tsx`, delete the `import { Suspense } from "react";` on line 1 and the entire `DirectorySkeleton` function (lines 49-65). Replace lines 37-43 with:

```tsx
        <DirectoryExplorer tools={tools} categories={categories} tags={tags} />
```

- [ ] **Step 4: Prove the HTML now carries the tools**

```bash
pnpm build
```

Then serve it and count the tool links in the raw HTML, without executing JavaScript:

```bash
node -e "fetch('http://localhost:3000/tools').then(r=>r.text()).then(h=>console.log('tool links:',(h.match(/\/tools\//g)||[]).length))"
```

Expected: a count in the dozens. Before this change it is 0. If it is 0, the bail-out is still happening: check that no component in the subtree still calls `useSearchParams()`.

- [ ] **Step 5: Run the gate**

```bash
pnpm verify
```

Expected: PASS. The existing `tests/e2e/directory.spec.ts` covers search-to-URL sync; it must still pass in Task 12.

- [ ] **Step 6: Visual Sweep (MANDATORY)**

Load `/tools` at a narrow and a wide viewport plus `/` as the always-check page. Confirm zero console errors — in particular **no hydration mismatch warning**, which is the specific risk of this change. Measure that a tool card's badge stays inside its card (`badge.right <= card.right`). Then load `/tools?cat=coding&price=free` and confirm the filters visibly apply just after load and the URL keeps its query string.

- [ ] **Step 7: Commit**

```bash
git add src/components/directory/directory-explorer.tsx src/app/tools/page.tsx
git commit -m "fix(seo): server-render the directory grid

useSearchParams forced a prerender bail-out, so /tools shipped crawlers a
skeleton with no links to any tool."
```

---

## Task 5: Server-render the compare page

`/compare` renders its header server-side but `fallback={null}` means the tool picker and table are absent from the HTML entirely.

**Files:**
- Modify: `src/components/compare/compare-view.tsx`
- Modify: `src/app/compare/page.tsx`

- [ ] **Step 1: Replace the state seeding**

In `src/components/compare/compare-view.tsx`, change line 5 to:

```tsx
import { usePathname, useRouter } from "next/navigation";
```

Add after the `@/lib/outbound` import:

```tsx
import { useSearchParamsOnMount } from "@/lib/use-search-params-on-mount";
```

Replace lines 32-49 with:

```tsx
  const router = useRouter();
  const pathname = usePathname();

  const bySlug = useMemo(
    () => new Map(tools.map((t) => [t.slug, t])),
    [tools],
  );

  const [selected, setSelected] = useState<string[]>([]);

  const urlRead = useSearchParamsOnMount((params) => {
    const raw = params.get("tools");
    if (!raw) return;
    setSelected(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => bySlug.has(s))
        .slice(0, MAX),
    );
  });
```

- [ ] **Step 2: Gate the URL-sync effect**

Replace lines 52-61 with:

```tsx
  // Mirror the selection into the URL so a comparison is shareable. Waits for
  // the initial read, which would otherwise be erased by this effect.
  useEffect(() => {
    if (!urlRead) return;
    const params = new URLSearchParams(window.location.search);
    if (selected.length) params.set("tools", selected.join(","));
    else params.delete("tools");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Only re-sync when the selection itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, urlRead]);
```

- [ ] **Step 3: Remove the Suspense boundary**

In `src/app/compare/page.tsx`, delete `import { Suspense } from "react";` (line 2) and replace lines 36-39 with:

```tsx
        <CompareView tools={tools} />
```

- [ ] **Step 4: Prove the HTML carries the picker**

```bash
pnpm build
```

```bash
node -e "fetch('http://localhost:3000/compare').then(r=>r.text()).then(h=>console.log('has picker:', h.includes('Add a tool')||h.includes('Compare')))"
```

Expected: `true`, and the raw HTML now contains tool names.

- [ ] **Step 5: Visual Sweep (MANDATORY)**

Load `/compare` and `/compare?tools=cursor,github-copilot` at both viewports. Zero console errors, no hydration warning, and the two-tool comparison applies after mount with the URL intact. Measure that comparison columns do not overflow their container at the narrow viewport.

- [ ] **Step 6: Commit**

```bash
git add src/components/compare/compare-view.tsx src/app/compare/page.tsx
git commit -m "fix(seo): server-render the compare picker and table"
```

---

## Task 6: Server-render the finder

`/finder` is the worst of the three: the **entire** page including its heading sits inside a `<Suspense>` with no fallback, so the static HTML has nothing but the layout shell.

**Files:**
- Modify: `src/components/finder/oracle-finder.tsx`
- Modify: `src/app/finder/page.tsx`

- [ ] **Step 1: Replace the state seeding**

In `src/components/finder/oracle-finder.tsx`, change line 5 to:

```tsx
import { usePathname, useRouter } from "next/navigation";
```

Add after the `@/lib/finder` import block:

```tsx
import { useSearchParamsOnMount } from "@/lib/use-search-params-on-mount";
```

Replace lines 46-64 with:

```tsx
  const router = useRouter();
  const pathname = usePathname();

  const categoryNameMap = useMemo(
    () => new Map(Object.entries(categoryNames)),
    [categoryNames],
  );

  // Question one renders on the server so the page is crawlable. A shared
  // result link jumps to its results just after mount.
  const [answers, setAnswers] = useState<FinderAnswers>({});
  const [stepIndex, setStepIndex] = useState(0);

  useSearchParamsOnMount((params) => {
    const initial = readAnswers(params);
    if (!initial.category && !initial.budget && !initial.platform) return;
    setAnswers(initial);
    setStepIndex(FINDER_STEPS.length);
  });

  const headingRef = useRef<HTMLHeadingElement>(null);
```

`readAnswers` already takes a `URLSearchParams`, so it needs no change. The `hasInitial` and `initial` consts are gone; check for any remaining references before moving on:

```bash
npx tsc --noEmit
```

Expected: no errors mentioning `hasInitial` or `initial`. Fix any that appear.

- [ ] **Step 2: Remove the Suspense boundary**

In `src/app/finder/page.tsx`, delete `import { Suspense } from "react";` (line 2) and replace lines 26-30 with:

```tsx
  return <OracleFinder tools={tools} categoryNames={categoryNames} />;
```

- [ ] **Step 3: Prove the HTML carries the finder**

```bash
pnpm build
```

```bash
node -e "fetch('http://localhost:3000/finder').then(r=>r.text()).then(h=>console.log('has question one:', h.includes('Ask the Oracle')))"
```

Expected: `true`. The first question's options should also appear in the raw HTML.

- [ ] **Step 4: Visual Sweep (MANDATORY)**

Load `/finder` and a completed link such as `/finder?use=coding&budget=paid&platform=web` at both viewports. Zero console errors, no hydration warning. Confirm the shared link lands on results. Measure that the option cards stay inside their container.

- [ ] **Step 5: Run the gate and commit**

```bash
pnpm verify
```

```bash
git add src/components/finder/oracle-finder.tsx src/app/finder/page.tsx
git commit -m "fix(seo): server-render the finder

The whole page sat inside a fallback-less Suspense boundary, so its static
HTML was empty."
```

---

## Task 7: A platform-correct shortcut badge

The handler already accepts `metaKey || ctrlKey`, but the badge hard-codes `⌘K` in two places, so every Windows and Linux visitor is shown a key they do not have.

**Files:**
- Create: `src/components/shared/shortcut-hint.tsx`
- Create: `src/components/shared/shortcut-hint.test.tsx`
- Modify: `src/components/layout/site-header.tsx:163-165`
- Modify: `src/components/home/oracle-hero.tsx:124-126`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ShortcutHint } from "@/components/shared/shortcut-hint";

function setPlatform(value: string) {
  Object.defineProperty(window.navigator, "platform", {
    value,
    configurable: true,
  });
}

afterEach(cleanup);

describe("ShortcutHint", () => {
  it("shows the Ctrl form on Windows", () => {
    setPlatform("Win32");
    render(<ShortcutHint keyName="K" />);
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });

  it("shows the command form on a Mac", () => {
    setPlatform("MacIntel");
    render(<ShortcutHint keyName="K" />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("labels the shortcut for assistive tech", () => {
    setPlatform("Win32");
    render(<ShortcutHint keyName="K" />);
    expect(screen.getByLabelText("Keyboard shortcut: Control K")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/components/shared/shortcut-hint.test.tsx
```

Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Implement the component**

Create `src/components/shared/shortcut-hint.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut badge that tells the truth on the visitor's platform.
 *
 * The command-menu handler has always accepted `metaKey || ctrlKey`, but the
 * badge was hard-coded to the Mac glyph, so most visitors were shown a key
 * their keyboard does not have.
 *
 * Renders the Ctrl form during SSR and the first client pass, then corrects on
 * a Mac after mount: `navigator.platform` does not exist on the server, and
 * branching on it during render would be a hydration mismatch.
 */
export function ShortcutHint({
  keyName,
  className,
}: {
  keyName: string;
  className?: string;
}) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(window.navigator.platform));
  }, []);

  const label = isMac ? `⌘${keyName}` : `Ctrl ${keyName}`;

  return (
    <kbd
      aria-label={`Keyboard shortcut: ${isMac ? "Command" : "Control"} ${keyName}`}
      className={cn(
        "pointer-events-none rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6rem] text-muted-foreground",
        className,
      )}
    >
      {label}
    </kbd>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/components/shared/shortcut-hint.test.tsx
```

Expected: PASS, all three.

- [ ] **Step 5: Use it in the header**

In `src/components/layout/site-header.tsx`, add to the imports:

```tsx
import { ShortcutHint } from "@/components/shared/shortcut-hint";
```

Replace lines 163-165 with:

```tsx
            <ShortcutHint keyName="K" />
```

- [ ] **Step 6: Use it in the hero**

In `src/components/home/oracle-hero.tsx`, add to the imports:

```tsx
import { ShortcutHint } from "@/components/shared/shortcut-hint";
```

Replace lines 124-126 with:

```tsx
            <ShortcutHint keyName="K" className="ml-auto" />
```

- [ ] **Step 7: Visual Sweep (MANDATORY)**

Load `/` and `/tools`. Zero console errors. Measure that the badge stays inside the search button in the hero (`kbd.right <= button.right`) — this is exactly the containment class of bug the sweep rule exists for, since `Ctrl K` is wider than `⌘K` and the hero button is a fixed `w-64`. Check both viewports. If it overflows, widen the button or shorten the label rather than clipping.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/shortcut-hint.tsx src/components/shared/shortcut-hint.test.tsx src/components/layout/site-header.tsx src/components/home/oracle-hero.tsx
git commit -m "fix(ui): show the platform's real shortcut, not always the Mac glyph"
```

---

## Task 8: Drive the hero's tool count from the data

`Search 27 tools…` is a string literal. The admin CMS can publish a 28th tool and the number will not move. The homepage stat cells three files away carry a comment insisting "Every cell here must be checkable"; this is the cell that is not.

You chose to keep a count rather than remove it. Wiring it to the data fixes the correctness bug now; roadmap item 3.1 revisits whether to advertise the number at all, and that is a positioning decision, not this task's.

**Files:**
- Modify: `src/components/home/oracle-hero.tsx:15`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Accept the count as a prop**

In `src/components/home/oracle-hero.tsx`, change line 15:

```tsx
export function OracleHero({ toolCount }: { toolCount: number }) {
```

And the button label (line 123):

```tsx
            Search {toolCount} tools…
```

- [ ] **Step 2: Pass it from the page**

In `src/app/page.tsx`, `stats` is already awaited at line 43, above the return, so nothing needs reordering. Change line 66 from `<OracleHero />` to:

```tsx
      <OracleHero toolCount={stats.toolCount} />
```

Confirm with:

```bash
npx tsc --noEmit
```

Expected: no errors. A missing prop fails the typecheck, which is the point of making it required.

- [ ] **Step 3: Visual Sweep (MANDATORY)**

Load `/`. Zero console errors. Confirm the button reads the real count and that the label plus badge still fit inside the `w-64` button at both viewports.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/oracle-hero.tsx src/app/page.tsx
git commit -m "fix(home): derive the hero tool count from the data

The literal 27 would have gone stale the moment the CMS published a tool."
```

---

## Task 9: One real byline, and copy that matches it

`src/data/authors.ts` is deliberately empty because six invented reviewers were removed. The copy referencing them was never updated, so "our editors" now credits nobody in about ten places, and the homepage makes a testable process claim on their behalf.

You chose to **name yourself**. That is the stronger option: a named solo reviewer is more credible than an imaginary department, and it keeps the "human-vetted" claim honest.

**Confirm before committing:** the display name and role below are inferred from your git identity. Correct them if they are wrong.

**Files:**
- Modify: `src/data/authors.ts`
- Modify: ten copy sites listed in Step 2

- [ ] **Step 1: Add the byline**

Replace line 15 of `src/data/authors.ts`:

```ts
export const authors: Author[] = [
  {
    id: "vivaan-kavalani",
    name: "Vivaan Kavalani",
    role: "Founder and reviewer",
    accent: "#00ADB5",
  },
];
```

Leave the file's existing doc comment intact — it explains why invented entries are forbidden, and that rule still stands.

- [ ] **Step 2: Replace every "our editors" with first person singular**

Make these exact edits. The voice is "I", because there is one reviewer.

| File:line | From | To |
|---|---|---|
| `src/app/page.tsx:26` | `"Every tool is used in real workflows by our editors, not judged from a landing page. We probe strengths, limits, and edge cases."` | `"Every tool here is one I have used in a real workflow, not judged from a landing page. I probe strengths, limits, and edge cases."` |
| `src/app/page.tsx:76` | `description="The standouts our editors keep coming back to, vetted, scored, and worth your attention."` | `description="The standouts I keep coming back to, tested, scored, and worth your attention."` |
| `src/app/best/[category]/page.tsx:44` | `Our editors' ranked pick of the best ${cat.name.toLowerCase()} AI tools in ${YEAR}, vetted and scored.` | `My ranked pick of the best ${cat.name.toLowerCase()} AI tools in ${YEAR}, tested and scored.` |
| `src/app/best/[category]/page.tsx:88` | `Each tool is used in real workflows by our editors and scored on capability, craft, pricing, and trust` | `Each tool is one I have used in a real workflow, scored on capability, craft, pricing, and trust` |
| `src/app/best/[category]/page.tsx:117` | `Ranked by our editors, vetted and scored` | `Ranked, tested, and scored by me` |
| `src/app/vs/[versus]/page.tsx:57` | `By our editors' scoring,` | `By my scoring,` |
| `src/app/deals/page.tsx:42` | `Current offers on the tools our editors actually recommend` | `Current offers on the tools I actually recommend` |
| `src/app/leaderboards/page.tsx:9` | `ranked two ways — by our editors' scores and by the community's ratings.` | `ranked by my editorial scores.` |
| `src/app/leaderboards/page.tsx:35` | `The same tools, ranked two ways. Our editors score for capability and` | `Scored for capability and` |
| `src/app/submit/page.tsx:9` | `Submit it and our editors will review it for the Enki directory.` | `Submit it and I will review it for the Enki directory.` |
| `src/app/submit/page.tsx:28` | `submission is reviewed and vetted by our editors before it's` | `submission is reviewed and tested by me before it's` |
| `src/components/submit/submit-form.tsx:51` | `Our editors review every submission before it's vetted and` | `I review every submission before it's tested and` |

Note the leaderboards edits also drop a second false claim: the copy promises a community ranking, and `getLeaderboards()` returns only an `editor` board. Roadmap item 2.1 handles the rest of that surface.

- [ ] **Step 3: Check nothing was missed**

```bash
npx tsc --noEmit
```

Then search for survivors:

```bash
node -e "const {execSync}=require('child_process');console.log(execSync('git grep -n -i \"our editors\" -- src || true').toString()||'none')"
```

Expected: `none`.

- [ ] **Step 4: Verify the claim is now supportable**

`Human-vetted` stays, in the hero, both OG images, the footer, `siteConfig`, and `/tools` metadata. It is defensible the moment a named person stands behind it, which Step 1 provides. It becomes fully evidenced when roadmap item 1.2 ships tested reviews. Do not change those strings in this task.

- [ ] **Step 5: Visual Sweep (MANDATORY)**

Load `/`, `/tools`, `/leaderboards`, `/submit`, `/deals`, and one `/best/*` page. Zero console errors. The replacement strings are longer in two places, so measure that no heading or description overflows its container at the narrow viewport.

- [ ] **Step 6: Commit**

```bash
git add src/data/authors.ts src/app src/components/submit/submit-form.tsx
git commit -m "fix(copy): credit one real reviewer instead of editors who do not exist

authors.ts has been empty since the invented personas were removed, but the
copy kept crediting them."
```

---

## Task 10: Rate-limit the three unauthenticated write paths

`outbound_clicks`, `subscribers` and `tool_submissions` all accept anonymous `INSERT` with `WITH CHECK (true)`. The only protection today is a honeypot and CHECK constraints, so anyone can inflate affiliate click counts, subscribe third-party addresses, or flood the moderation queue.

**Before writing code:** confirm the installed package APIs. These are first-party Vercel packages and their exports move; the code below is the intended shape, and the typecheck in Step 3 is what proves it.

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/rate-limit.test.ts`
- Modify: `src/app/go/[slug]/route.ts`, `src/app/actions/newsletter.ts`, `src/app/submit/actions.ts`, `next.config.ts`

- [ ] **Step 1: Install and confirm the API**

```bash
pnpm add @vercel/firewall botid
```

Then read the shipped types to confirm the exports before using them:

```bash
node -e "console.log(require('fs').readFileSync('node_modules/@vercel/firewall/dist/index.d.ts','utf8').slice(0,2000))"
```

Confirm `checkRateLimit` exists and note its exact signature and return shape. Do the same for `botid/server` and `checkBotId`. If either differs from Step 3's code, adapt Step 3 to the real API and keep the wrapper's own interface unchanged.

- [ ] **Step 2: Write the failing test**

The wrapper's decision logic is what deserves a test; the network calls do not.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const checkRateLimit = vi.fn();
const checkBotId = vi.fn();

vi.mock("@vercel/firewall", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("botid/server", () => ({ checkBotId: (...a: unknown[]) => checkBotId(...a) }));

const { allowWrite } = await import("@/lib/rate-limit");

beforeEach(() => {
  checkRateLimit.mockReset();
  checkBotId.mockReset();
});

describe("allowWrite", () => {
  it("allows a human within the limit", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    checkRateLimit.mockResolvedValue({ rateLimited: false });
    expect(await allowWrite("newsletter")).toBe(true);
  });

  it("blocks a caller over the limit", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    checkRateLimit.mockResolvedValue({ rateLimited: true });
    expect(await allowWrite("newsletter")).toBe(false);
  });

  it("blocks a detected bot without consulting the rate limiter", async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    expect(await allowWrite("submit")).toBe(false);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("fails open when the limiter itself errors", async () => {
    // A limiter outage must not take the site's write paths down with it.
    checkBotId.mockResolvedValue({ isBot: false });
    checkRateLimit.mockRejectedValue(new Error("network"));
    expect(await allowWrite("outbound")).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to verify it fails, then implement**

```bash
npx vitest run src/lib/rate-limit.test.ts
```

Expected: FAIL, cannot resolve `@/lib/rate-limit`.

Create `src/lib/rate-limit.ts`:

```ts
import { checkRateLimit } from "@vercel/firewall";
import { checkBotId } from "botid/server";

/**
 * One gate for every unauthenticated write path.
 *
 * outbound_clicks, subscribers and tool_submissions all accept anonymous
 * INSERT with WITH CHECK (true). A honeypot stops naive form-fillers and
 * nothing stops a script, so click counts, the subscriber list and the
 * moderation queue were all floodable.
 *
 * Fails OPEN. A rate limiter that takes the newsletter down when it has an
 * outage is worse than the abuse it prevents, and every one of these paths is
 * already validated and constrained in Postgres behind it.
 */
export type WritePath = "outbound" | "newsletter" | "submit";

export async function allowWrite(path: WritePath): Promise<boolean> {
  try {
    const { isBot } = await checkBotId();
    if (isBot) return false;

    const { rateLimited } = await checkRateLimit(`enki-${path}`);
    return !rateLimited;
  } catch {
    return true;
  }
}
```

```bash
npx vitest run src/lib/rate-limit.test.ts
```

Expected: PASS, all four.

- [ ] **Step 4: Configure the limits and enable BotID**

`next.config.ts` currently ends with `export default withSentryConfig(nextConfig, { ... })` at line 110. Add the import beside the Sentry one at the top:

```ts
import { withBotId } from "botid/next/config";
```

Then wrap `nextConfig` **inside** the Sentry call, leaving the entire options object at lines 111-131 untouched:

```ts
export default withSentryConfig(withBotId(nextConfig), {
```

Order matters: BotID rewrites routes and Sentry must wrap the finished config, so `withSentryConfig` stays outermost. Do not touch `headers()`, `redirects()`, or the CSP block: BotID calls the same origin, so `connect-src 'self'` already covers it and the policy needs no new origin.

Define the three limits in the Vercel dashboard under Firewall, keyed `enki-outbound`, `enki-newsletter`, `enki-submit`. Suggested ceilings, per IP: outbound 60/min, newsletter 5/hour, submit 5/hour.

- [ ] **Step 5: Apply the gate to the newsletter**

In `src/app/actions/newsletter.ts`, after the honeypot check on line 13:

```ts
  if (!(await allowWrite("newsletter"))) {
    return { ok: false as const, error: "Too many attempts. Try again later." };
  }
```

Add the import: `import { allowWrite } from "@/lib/rate-limit";`

- [ ] **Step 6: Apply the gate to submissions**

In `src/app/submit/actions.ts`, after the honeypot check on line 15:

```ts
  if (!(await allowWrite("submit"))) {
    return {
      ok: false as const,
      error: "Too many submissions from here. Try again later.",
    };
  }
```

Add the same import.

- [ ] **Step 7: Apply the gate to outbound clicks**

`/go/[slug]` is different: the visitor must still reach the tool. Rate-limit the **logging**, never the redirect. In `src/app/go/[slug]/route.ts`, replace the insert block at lines 45-51:

```ts
  try {
    if (await allowWrite("outbound")) {
      await createAnonClient()
        .from("outbound_clicks")
        .insert({ tool_slug: slug, path });
    }
  } catch {
    // Never let logging failure block the user's navigation.
  }
```

Add the same import.

- [ ] **Step 8: Verify**

```bash
pnpm verify
```

```bash
pnpm build
```

Expected: both pass. Rate limiting is inert on localhost, so functional proof comes from the preview deployment: submit the newsletter form six times in a minute and confirm the sixth is refused with the friendly message rather than an error.

- [ ] **Step 9: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/app/actions/newsletter.ts src/app/submit/actions.ts "src/app/go/[slug]/route.ts" next.config.ts package.json pnpm-lock.yaml
git commit -m "feat(security): rate-limit the anonymous write paths

outbound_clicks, subscribers and tool_submissions accepted unlimited
anonymous inserts. Fails open so a limiter outage cannot break the forms."
```

---

## Task 11: A real favicon

`/favicon.ico` 404s. Only `/icon.svg` and `/apple-icon` exist, and Google's SERP favicon fetcher requests the `.ico` path specifically, so the brand is likely showing blank in search results. Five Next.js template SVGs are also still sitting in `public/`.

**Files:**
- Create: `src/app/favicon.ico`
- Delete: `public/next.svg`, `public/vercel.svg`, `public/globe.svg`, `public/file.svg`, `public/window.svg`

- [ ] **Step 1: Generate the .ico from the existing brand mark**

`sharp` is already a dev dependency and cannot write `.ico`, so render PNGs and pack them. Add `png-to-ico`:

```bash
pnpm add -D png-to-ico
```

Create `scripts/render-favicon.mjs`, following the conventions in the existing `scripts/render-poster.mjs`:

```js
#!/usr/bin/env node
/**
 * Build src/app/favicon.ico from the brand emblem.
 *
 * Google's SERP favicon fetcher requests /favicon.ico by path and does not
 * fall back to icon.svg, so a site with only an SVG icon shows blank in search
 * results. Multi-size because Windows and some feed readers pick 16 or 32.
 */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const SOURCE = "public/icon.svg";
const OUT = "src/app/favicon.ico";
const SIZES = [16, 32, 48];

const svg = await readFile(SOURCE);
const pngs = await Promise.all(
  SIZES.map((size) =>
    sharp(svg, { density: 384 }).resize(size, size).png().toBuffer(),
  ),
);

await writeFile(OUT, await pngToIco(pngs));
console.log(`favicon.ico <- ${SOURCE} (${SIZES.join(", ")}px)`);
```

Register it in `package.json` scripts alongside the other asset commands:

```json
    "favicon": "node scripts/render-favicon.mjs",
```

- [ ] **Step 2: Run it**

```bash
pnpm favicon
```

Expected: `src/app/favicon.ico` is created. Next's App Router serves a `favicon.ico` placed in `src/app/` at the `/favicon.ico` route automatically.

- [ ] **Step 3: Delete the template leftovers**

```bash
git rm public/next.svg public/vercel.svg public/globe.svg public/file.svg public/window.svg
```

Before deleting, confirm nothing references them:

```bash
node -e "const {execSync}=require('child_process');console.log(execSync('git grep -n -E \"next.svg|vercel.svg|globe.svg|file.svg|window.svg\" -- src public || true').toString()||'none')"
```

Expected: `none`. If a reference exists, remove it first.

- [ ] **Step 4: Verify the route**

```bash
pnpm build
```

Serve it, then:

```bash
node -e "fetch('http://localhost:3000/favicon.ico').then(r=>console.log('status',r.status,r.headers.get('content-type')))"
```

Expected: `status 200` and an icon content type. It was 404 before.

- [ ] **Step 5: Commit**

```bash
git add src/app/favicon.ico scripts/render-favicon.mjs package.json pnpm-lock.yaml
git commit -m "fix(brand): serve a real favicon.ico and drop Next's template art

/favicon.ico 404'd, which is the exact path Google's SERP fetcher asks for."
```

---

## Task 12: E2E coverage for the trust paths, wired into CI

`tests/e2e/` already holds `directory.spec.ts` and `finder.spec.ts` — the roadmap's "e2e/ is empty" note is stale, and the real gap is twofold: the auth, submit and admin paths are untested, and **Playwright never runs in CI**, which runs only `pnpm verify`.

Signup cannot be automated end to end (no mailbox, and account creation is out of scope for automation), so test the gates and the form, and leave the mailbox walk to the operator checklist.

**Files:**
- Create: `tests/e2e/trust.spec.ts`
- Modify: `.github/workflows/verify.yml`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

test.describe("trust and gate paths", () => {
  test("the admin route redirects an anonymous visitor to login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the saved page is reachable and does not leak another user's data", async ({
    page,
  }) => {
    await page.goto("/saved");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("submitting a tool validates before it sends", async ({ page }) => {
    await page.goto("/submit");
    // handoff.md gotcha #3: a synthetic click may not fire React Hook Form's
    // handleSubmit, which silently masked this exact flow during an earlier
    // verification. requestSubmit() goes through the real submit path.
    await page.locator("form").first().evaluate((f: HTMLFormElement) => f.requestSubmit());
    // The Zod resolver blocks an empty submit rather than posting it.
    await expect(
      page.getByText(/required|enter|check the form/i).first(),
    ).toBeVisible();
  });

  test("the directory is server-rendered, not JavaScript-only", async ({
    browser,
  }) => {
    // The regression this guards: useSearchParams forced a prerender bail-out
    // and /tools shipped a skeleton with no links to any tool.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/tools");
    const links = page.locator('a[href^="/tools/"]');
    expect(await links.count()).toBeGreaterThan(5);
    await context.close();
  });

  test("an alternatives page lists only same-category tools", async ({
    page,
  }) => {
    await page.goto("/alternatives/cursor");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Cursor",
    );
    // The bug this guards: image and audio tools padded the coding list.
    await expect(page.locator('a[href="/tools/midjourney"]')).toHaveCount(0);
    await expect(page.locator('a[href="/tools/elevenlabs"]')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the suite**

```bash
pnpm test:e2e
```

Expected: PASS. The config builds and starts a production server on port 3100 first, so this takes a few minutes. If the no-JavaScript test fails, Task 4 is not actually finished — fix that before continuing.

- [ ] **Step 3: Wire Playwright into CI**

Add a second job to `.github/workflows/verify.yml`, after the existing `verify` job:

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Only the browser the config actually uses, with its system deps.
      - run: pnpm exec playwright install --with-deps chromium

      # The config's webServer runs `pnpm build && pnpm start`. No secrets: the
      # content layer falls back to the git seed when Supabase is unreachable.
      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 4: Verify the workflow parses**

```bash
node -e "const y=require('fs').readFileSync('.github/workflows/verify.yml','utf8');console.log(y.includes('e2e:')?'job added':'MISSING')"
```

Expected: `job added`. The authoritative check is the run on push.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/trust.spec.ts .github/workflows/verify.yml
git commit -m "test(e2e): cover the gate, submit and server-render paths in CI

Includes a JavaScript-disabled check on /tools so the prerender bail-out
cannot come back unnoticed."
```

---

## Task 13: Final pre-launch sweep

Everything above is done; this proves it together rather than one task at a time.

**Files:** none modified.

- [ ] **Step 1: Full gate**

```bash
pnpm verify
```

```bash
pnpm build
```

```bash
pnpm test:e2e
```

All three must pass.

- [ ] **Step 2: Security**

```bash
pnpm audit:rls
```

```bash
pnpm audit --prod --audit-level high
```

Expected: both exit 0. Then re-run the Supabase advisors through the MCP connector and confirm no new findings, especially on the three tables Task 10 touched.

- [ ] **Step 3: Visual sweep across every route, both viewports**

```bash
pnpm sweep
```

Cover `/`, `/tools`, `/tools/cursor`, `/categories`, `/categories/coding`, `/compare`, `/finder`, `/leaderboards`, `/best/coding`, `/alternatives/cursor`, `/vs/cursor-vs-github-copilot`, `/deals`, `/submit`, `/saved`, `/collections`, `/privacy`, `/terms`, `/login`. Zero console errors, no hydration warnings, no containment failures.

- [ ] **Step 4: Confirm the crawlable surface**

For `/tools`, `/compare` and `/finder`, fetch the raw HTML and confirm real content and links are present. This is the whole point of Tasks 4 to 6 and the easiest thing to regress.

- [ ] **Step 5: Functional pass**

Outbound `/go/cursor` redirects and logs. Submit posts and lands in the admin queue. Review moderation publishes. Saved and collections persist. Compare and finder produce results. `/admin` refuses an anonymous visitor.

- [ ] **Step 6: Commit any fixes and push**

```bash
git push origin main
```

Pushing deploys to `enkitools.com`. Confirm the deployment is green and re-check `/tools` and `/alternatives/cursor` on the live domain, including the `"image generationtool"` string the external review reported, which is not reproducible in the current source (see `docs/roadmap.md` §7) and may have been an artefact of an older deployment.

---

## Operator checklist (not code, cannot be done in-repo)

These are Phase 0 items only you can do. The plan above is not finished until they are.

- [ ] **Enable leaked-password protection** — Supabase → Auth → Policies. One toggle. Users can currently register with known-breached passwords.
- [ ] **Configure a Sentry alert rule** so the first real error reaches a human instead of sitting in a dashboard.
- [ ] **Decide the newsletter.** Addresses are being collected and nothing has ever been sent. Either commit to building sending (roadmap 5.1) or stop collecting until it exists. Also resolve the cadence contradiction: `src/components/layout/site-footer.tsx:113` promises "A monthly dispatch" while the plan has been weekly.
- [ ] **Verify a real signup end to end** on `enkitools.com` with a real mailbox: sign up, confirm, log in, write a review, see it queued as pending.
- [ ] **Confirm the byline** in Task 9 — display name and role.
- [ ] **Define the three Firewall limits** in the Vercel dashboard (Task 10, Step 4).

---

## Definition of done

- `/alternatives/*` lists same-category tools only, and thin pages are not published.
- `/tools`, `/compare` and `/finder` serve real content and links with JavaScript disabled.
- No copy credits an editorial team that does not exist; one real named reviewer stands behind the claim.
- The hero's tool count comes from the data.
- Windows and Linux visitors see `Ctrl K`.
- The three anonymous write paths are rate-limited and fail open.
- `/favicon.ico` returns 200.
- `pnpm verify`, `pnpm build` and `pnpm test:e2e` pass, and E2E runs in CI.
- The operator checklist above is complete.

When all of that holds, Phase 0 of `docs/roadmap.md` is closed and Phase 1 (the scoring rubric, evidence-based reviews, and `/about`) becomes the next plan.
