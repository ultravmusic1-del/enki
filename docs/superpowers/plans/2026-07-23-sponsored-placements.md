# Sponsored / Promoted Placements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sellable, clearly-labeled promoted placements — a `sponsored` flag pins a tool to the top of browse results with a "Promoted" label and a subtle accent, while editorial scores, verdicts, rankings, leaderboards, and search results stay untouched.

**Architecture:** A pure `pinSponsored()` reorders a tool list (sponsored first, stable) — applied only to **browse** surfaces (category pages, directory default view), never to search or leaderboards. A "Promoted" label + faint ring renders on `ToolCard` when `tool.sponsored`. Sponsored-click reporting comes free via the existing `/go/[slug]` tracker (feature #2).

**Tech Stack:** Zod content schema (`sponsored` defaulted flag), pure list helper (Vitest), Tailwind. No DB, no new deps.

**Integrity guardrail:** No real tool is marked sponsored in committed code (no real deal exists). The mechanism is verified by unit tests + a temporary, reverted local demonstration. Editorial data is never altered by sponsorship.

---

## Task 1: `sponsored` schema flag + `pinSponsored` helper (TDD)

**Files:** Modify `src/lib/schemas.ts`; modify `src/lib/filters.ts`; modify `src/lib/filters.test.ts`.

- [ ] **Step 1: Add the flag** — in `src/lib/schemas.ts`, in `toolSchema` right after `featured: z.boolean(),` add:

```ts
  /** Paid promoted placement. Defaults false; never affects editorial score/rank. */
  sponsored: z.boolean().default(false),
```

- [ ] **Step 2: Write failing tests** — append to `src/lib/filters.test.ts`:

```ts
import { pinSponsored } from "@/lib/filters";

describe("filters: pinSponsored", () => {
  it("moves sponsored tools to the front, preserving relative order, without mutating", () => {
    const input = tools.slice(0, 6);
    const withFlags = input.map((t, i) => ({ ...t, sponsored: i === 2 || i === 4 }));
    const snapshot = withFlags.map((t) => t.slug);
    const pinned = pinSponsored(withFlags);
    // sponsored first (indices 2 then 4), then the rest in original order
    expect(pinned.slice(0, 2).every((t) => t.sponsored)).toBe(true);
    expect(pinned.slice(2).every((t) => !t.sponsored)).toBe(true);
    expect(pinned[0].slug).toBe(withFlags[2].slug);
    expect(pinned[1].slug).toBe(withFlags[4].slug);
    // no mutation of input
    expect(withFlags.map((t) => t.slug)).toEqual(snapshot);
  });

  it("returns the list unchanged when nothing is sponsored", () => {
    const input = tools.slice(0, 5);
    expect(pinSponsored(input).map((t) => t.slug)).toEqual(input.map((t) => t.slug));
  });
});
```

- [ ] **Step 3: Run → fail** — `npm run test -- src/lib/filters.test.ts` → FAIL (pinSponsored missing).

- [ ] **Step 4: Implement** — append to `src/lib/filters.ts`:

```ts
/**
 * Stable partition that pins sponsored tools to the front (preserving their
 * relative order), then everything else in its original order. Use only on
 * *browse* surfaces — never on search results or leaderboards, which must stay
 * merit-ordered. Pure; never mutates the input.
 */
export function pinSponsored(tools: Tool[]): Tool[] {
  const sponsored = tools.filter((t) => t.sponsored);
  if (sponsored.length === 0) return tools;
  const rest = tools.filter((t) => !t.sponsored);
  return [...sponsored, ...rest];
}
```

- [ ] **Step 5: Run → pass** — `npm run test -- src/lib/filters.test.ts` → PASS. Then `npm run typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas.ts src/lib/filters.ts src/lib/filters.test.ts
git commit -m "feat(sponsored): sponsored flag and pinSponsored browse helper"
```

---

## Task 2: "Promoted" label on the tool card

**Files:** Modify `src/components/shared/tool-card.tsx`.

- [ ] **Step 1: Label + accent** — in `src/components/shared/tool-card.tsx`:

Add a faint sponsored accent to the card's outer `<Link>` className via `cn(...)` — append this as an extra argument after `className` in the `cn()` call:

```ts
        tool.sponsored && "border-teal/30 ring-1 ring-teal/15",
```

Then, inside the identity block, immediately after the `{categoryName && (…)}` span (the category line), add a labeled chip:

```tsx
          {tool.sponsored && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.15em] text-teal uppercase">
              Promoted
            </span>
          )}
```

(The identity `<div className="min-w-0">` stacks name → category → this chip.)

- [ ] **Step 2: Verify** — `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/tool-card.tsx
git commit -m "feat(sponsored): labeled Promoted treatment on tool cards"
```

---

## Task 3: Apply pinning to browse surfaces (not search, not leaderboards)

**Files:** Modify `src/app/categories/[slug]/page.tsx`; modify `src/components/directory/directory-explorer.tsx`.

- [ ] **Step 1: Category page** — in `src/app/categories/[slug]/page.tsx`, add the import (with the other `@/lib/filters` import):

```ts
import { sortTools, pinSponsored } from "@/lib/filters";
```

(replace the existing `import { sortTools } from "@/lib/filters";`)

Then change line 45 from:

```ts
  const tools = sortTools(getToolsByCategory(category.slug), "rating");
```

to:

```ts
  const tools = pinSponsored(sortTools(getToolsByCategory(category.slug), "rating"));
```

- [ ] **Step 2: Directory (browse only)** — in `src/components/directory/directory-explorer.tsx`, update the `@/lib/filters` import to include `pinSponsored`:

```ts
import {
  applyFilters,
  sortTools,
  pinSponsored,
  PRICING_OPTIONS,
  SORT_OPTIONS,
  type SortKey,
  type ToolFilters,
} from "@/lib/filters";
```

Then in the `results` useMemo, change the final `return sortTools(filtered, effectiveSort);` to pin sponsored only when the user is browsing (no active text query):

```ts
    const sorted = sortTools(filtered, effectiveSort);
    // Promoted tools pin to the top when browsing; an explicit search stays
    // merit-ranked so results remain honest.
    return q ? sorted : pinSponsored(sorted);
```

(`q` is already defined above as `const q = query.trim();`.)

- [ ] **Step 3: Verify** — `npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/categories/[slug]/page.tsx" src/components/directory/directory-explorer.tsx
git commit -m "feat(sponsored): pin promoted tools atop category and directory browse"
```

---

## Final Verification Phase

- [ ] **V1: Static gates** — `npm run typecheck && npm run lint && npm run test && npm run build` → all PASS; unit count up by 2.

- [ ] **V2: Temporary demonstration (reverted)** — to prove the label + pin render (no committed fake sponsor):
  1. Temporarily set `sponsored: true` on ONE tool in `src/data/tools.ts` (pick a lower-ranked one so the pin is visible, e.g. a paid tool that isn't already first).
  2. `npm run build` + serve; open `/tools` (browse) and its category page.
  3. `javascript_tool`: assert that tool's card is **first** in the grid and shows a "Promoted" chip; confirm no layout overflow and console clean; check a search query does NOT pin it.
  4. **Revert** the seed edit (`git checkout src/data/tools.ts`); rebuild. Confirm no tool is sponsored in committed code.

- [ ] **V3: Visual sweep** — with the temporary sponsor active, screenshot/measure `/tools` and `/tools/<category>` per CLAUDE.md → Visual Sweep (label legible, card pinned, no regression); verify the mobile layout too.

- [ ] **V4: Report** — gates + the demonstration measurements + confirmation the committed seed has zero sponsored tools.

---

## Self-Review
- **Coverage:** flag (T1) ✓; pure pin helper + tests (T1) ✓; labeled card treatment (T2) ✓; browse-only application, search/leaderboards excluded (T3) ✓; integrity guardrail + reverted demo (Final) ✓; reporting via existing #2 tracker (noted, no work).
- **Placeholders:** none.
- **Type consistency:** `pinSponsored(tools: Tool[]): Tool[]`; `tool.sponsored: boolean` (defaulted) used in helper + card + import sites.
- **Integrity:** editorial score/verdict/leaderboards/search untouched; label always present; no committed sponsorship.
