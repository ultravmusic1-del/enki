# "Ask the Oracle" Guided Tool Finder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guided, on-brand `/finder` flow that asks 3 short questions (use-case, budget, platform) and returns a reasoned shortlist of the best-fit AI tools — turning the "oracle" brand into a real product surface and creating the high-intent conversion moment future monetization plugs into.

**Architecture:** A pure, deterministic scoring engine (`src/lib/finder.ts`, fully unit-tested — no LLM) ranks the existing static tool catalog against the user's answers and attaches human-readable "reasons". A server route (`src/app/finder/page.tsx`) supplies data + SEO metadata; a client wizard (`src/components/finder/oracle-finder.tsx`) drives the 3-step flow and renders results by reusing the existing `SavableToolCard`. Entry points: a nav link and a home-page CTA band.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, Zod-validated static content (`src/lib/content.ts`), Vitest (unit), Playwright (e2e). No new dependencies, no backend, no DB.

---

## Design decisions (locked)

- **3 questions**, each optional-skippable, all soft-scored so results are never empty (27 tools always yield a top-N):
  1. **Use-case** → `category` slug (8 categories). Dominant signal.
  2. **Budget** → `free` (needs a free tier) · `trial` (wants a free trial) · `pay` (no constraint).
  3. **Platform** → `web` · `mac` · `windows` · `mobile` · `api` · `any`.
- **Deterministic additive scoring** (see Task 1). Quality (editorScore, rating, featured) is always added, so ranking is sensible even with no answers. Category match dominates; budget/platform nudge; off-category/off-platform are penalized but still eligible as fillers.
- **Reasons**: up to 3 short human chips per result ("Built for Coding & Dev", "Free tier to start", "Works on macOS", "Editor's pick · 9.2"). These make the recommendation feel reasoned.
- **Results**: top **3** shown as `SavableToolCard`s with reason chips, plus a "See all in {category}" link into the existing filtered directory (`/tools?cat=…`).
- **Shareable**: final answers reflected to the URL (`/finder?use=coding&budget=free&platform=mac`) and read back on load, mirroring the directory's URL-sync pattern.
- **Accessibility**: options are real `<button>`s in a `radiogroup`; focus moves to the new step heading on advance; `prefers-reduced-motion` already neutralized globally.

### File structure

- Create `src/lib/finder.ts` — types, question config, `scoreTools`, `recommendTools`, platform/label maps. One responsibility: recommendation logic + its presentation config.
- Create `src/lib/finder.test.ts` — unit tests for the engine.
- Create `src/components/finder/oracle-finder.tsx` — client wizard (state, steps, results). `"use client"`.
- Create `src/components/finder/finder-result-card.tsx` — a `SavableToolCard` wrapper that overlays the reason chips.
- Create `src/app/finder/page.tsx` — server page: metadata, canonical, data load, renders `<OracleFinder>`.
- Create `src/components/home/finder-cta.tsx` — home-page CTA band linking to `/finder`.
- Modify `src/lib/site.ts` — add Finder to `nav`.
- Modify `src/app/page.tsx` — render `<FinderCta />`.
- Modify `src/app/sitemap.ts` — add `/finder`.
- Create `tests/e2e/finder.spec.ts` — happy-path e2e.

---

## Task 1: Scoring engine — types, maps, and `scoreTools`

**Files:**
- Create: `src/lib/finder.ts`
- Test: `src/lib/finder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/finder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAllTools, getCategories } from "@/lib/content";
import { recommendTools, scoreTools, type FinderAnswers } from "@/lib/finder";

const tools = getAllTools();
const categoryName = new Map(getCategories().map((c) => [c.slug, c.name]));

function rec(answers: FinderAnswers, n = 3) {
  return recommendTools(tools, answers, categoryName, n);
}

describe("finder: recommendTools", () => {
  it("returns exactly n results and never empty, even with no answers", () => {
    expect(rec({}, 3)).toHaveLength(3);
    expect(rec({ category: "coding", budget: "free", platform: "mac" }, 3)).toHaveLength(3);
  });

  it("ranks the chosen use-case (category) to the top", () => {
    const top3 = rec({ category: "coding" }, 3);
    expect(top3.every((r) => r.tool.categorySlug === "coding")).toBe(true);
  });

  it("prefers free/freemium tools when budget is 'free'", () => {
    // Within the coding category, a free-tier tool should outrank a paid one.
    const scored = scoreTools(tools, { category: "coding", budget: "free" }, categoryName)
      .filter((r) => r.tool.categorySlug === "coding");
    const freeish = scored.find(
      (r) => r.tool.pricing.model === "free" || r.tool.pricing.model === "freemium",
    );
    const paid = scored.find((r) => r.tool.pricing.model === "paid");
    if (freeish && paid) {
      expect(freeish.score).toBeGreaterThan(paid.score);
    }
  });

  it("boosts tools matching the chosen platform", () => {
    const withApi = scoreTools(tools, { platform: "api" }, categoryName);
    const hasApi = withApi.find((r) => r.tool.platforms.includes("API"));
    const noApi = withApi.find(
      (r) => !["API", "VS Code", "JetBrains", "CLI"].some((p) => r.tool.platforms.includes(p)),
    );
    if (hasApi && noApi) {
      expect(hasApi.score).toBeGreaterThan(noApi.score);
    }
  });

  it("attaches a category reason when the use-case matches", () => {
    const top = rec({ category: "image" }, 1)[0];
    expect(top.reasons.some((r) => /Image Generation/i.test(r))).toBe(true);
    expect(top.reasons.length).toBeGreaterThan(0);
    expect(top.reasons.length).toBeLessThanOrEqual(3);
  });

  it("is deterministic and does not mutate the input array", () => {
    const snapshot = tools.map((t) => t.slug);
    const a = rec({ category: "writing", budget: "trial", platform: "web" }, 5).map((r) => r.tool.slug);
    const b = rec({ category: "writing", budget: "trial", platform: "web" }, 5).map((r) => r.tool.slug);
    expect(a).toEqual(b);
    expect(tools.map((t) => t.slug)).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/finder.test.ts`
Expected: FAIL — `finder.ts` does not exist / `recommendTools` is not defined.

- [ ] **Step 3: Implement `src/lib/finder.ts`**

```ts
import type { Tool } from "@/lib/schemas";

/* =========================================================================
   "Ask the Oracle" — guided finder recommendation engine.

   Pure and deterministic: given the user's answers, score every tool and
   return a reasoned shortlist. No network, no LLM — quality (editor score,
   community rating) is always part of the score so the ranking is sensible
   even before any question is answered. Category dominates; budget and
   platform nudge. Off-target tools are penalized but stay eligible as
   fillers, so the shortlist is never empty.
   ========================================================================= */

export type BudgetPref = "free" | "trial" | "pay";
export type PlatformPref = "web" | "mac" | "windows" | "mobile" | "api" | "any";

export type FinderAnswers = {
  /** Category slug, or undefined for "any use-case". */
  category?: string;
  budget?: BudgetPref;
  platform?: PlatformPref;
};

export type FinderResult = {
  tool: Tool;
  score: number;
  /** Up to 3 short, human reasons, match-signals first, quality last. */
  reasons: string[];
};

/** Which stored `platforms` values satisfy each platform preference. */
const PLATFORM_MATCH: Record<Exclude<PlatformPref, "any">, string[]> = {
  web: ["Web", "Browser extension"],
  mac: ["macOS"],
  windows: ["Windows"],
  mobile: ["iOS", "Android"],
  api: ["API", "VS Code", "JetBrains", "CLI"],
};

export const PLATFORM_LABEL: Record<Exclude<PlatformPref, "any">, string> = {
  web: "the web",
  mac: "macOS",
  windows: "Windows",
  mobile: "mobile",
  api: "your dev stack",
};

function scoreOne(
  tool: Tool,
  answers: FinderAnswers,
  categoryName: Map<string, string>,
): FinderResult {
  let score = 0;
  const reasons: string[] = [];

  // Quality baseline — always present so ranking is sensible with no answers.
  score += tool.editorScore * 2; // 0..20
  score += tool.rating * 2; //     2..10
  if (tool.featured) score += 2;

  // Use-case (category) — the dominant signal.
  if (answers.category) {
    if (tool.categorySlug === answers.category) {
      score += 100;
      const name = categoryName.get(tool.categorySlug);
      if (name) reasons.push(`Built for ${name}`);
    } else {
      score -= 40; // strongly deprioritize, but keep as a possible filler
    }
  }

  // Budget.
  const model = tool.pricing.model;
  const freeish = model === "free" || model === "freemium";
  if (answers.budget === "free") {
    if (freeish) {
      score += 18;
      reasons.push(model === "free" ? "Completely free" : "Free tier to start");
    } else if (tool.pricing.hasFreeTrial) {
      score += 6;
      reasons.push("Free trial available");
    } else {
      score -= 12;
    }
  } else if (answers.budget === "trial") {
    if (tool.pricing.hasFreeTrial) {
      score += 16;
      reasons.push("Free trial available");
    } else if (freeish) {
      score += 8;
      reasons.push("Free tier to start");
    }
  } // "pay" imposes no budget constraint

  // Platform.
  if (answers.platform && answers.platform !== "any") {
    const wanted = PLATFORM_MATCH[answers.platform];
    if (tool.platforms.some((p) => wanted.includes(p))) {
      score += 16;
      reasons.push(`Works on ${PLATFORM_LABEL[answers.platform]}`);
    } else {
      score -= 20;
    }
  }

  // A single quality flourish, only for genuine standouts.
  if (tool.editorScore >= 8.7) {
    reasons.push(`Editor's pick · ${tool.editorScore.toFixed(1)}`);
  } else if (tool.rating >= 4.6) {
    reasons.push(`Loved by users · ${tool.rating.toFixed(1)}`);
  }

  return { tool, score, reasons: reasons.slice(0, 3) };
}

/** Score every tool. Order: score desc, then stable quality tie-breaks. */
export function scoreTools(
  tools: Tool[],
  answers: FinderAnswers,
  categoryName: Map<string, string>,
): FinderResult[] {
  return [...tools]
    .map((tool) => scoreOne(tool, answers, categoryName))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.tool.editorScore - a.tool.editorScore ||
        b.tool.rating - a.tool.rating ||
        b.tool.reviewCount - a.tool.reviewCount ||
        a.tool.name.localeCompare(b.tool.name),
    );
}

/** Top `n` recommendations for the given answers. */
export function recommendTools(
  tools: Tool[],
  answers: FinderAnswers,
  categoryName: Map<string, string>,
  n = 3,
): FinderResult[] {
  return scoreTools(tools, answers, categoryName).slice(0, n);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/finder.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finder.ts src/lib/finder.test.ts
git commit -m "feat(finder): deterministic recommendation engine with reasons"
```

---

## Task 2: Question configuration

**Files:**
- Modify: `src/lib/finder.ts` (append config used by the wizard)
- Test: `src/lib/finder.test.ts` (append a shape test)

The wizard renders from data, not hardcoded JSX, so the flow is declarative and testable. Icons are Lucide names already in the registry (`src/components/shared/icon.tsx`).

- [ ] **Step 1: Append a config-shape test to `src/lib/finder.test.ts`**

```ts
import { FINDER_STEPS } from "@/lib/finder";

describe("finder: FINDER_STEPS config", () => {
  it("has three steps, each with a non-empty option set", () => {
    expect(FINDER_STEPS).toHaveLength(3);
    for (const step of FINDER_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.options.length).toBeGreaterThan(1);
      for (const opt of step.options) {
        expect(opt.value).toBeTruthy();
        expect(opt.label).toBeTruthy();
      }
    }
  });

  it("uses the real category slugs for the use-case step", () => {
    const useCase = FINDER_STEPS.find((s) => s.id === "category");
    expect(useCase).toBeDefined();
    // "any" plus the 8 seeded categories
    expect(useCase!.options.length).toBe(9);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/lib/finder.test.ts`
Expected: FAIL — `FINDER_STEPS` is not exported.

- [ ] **Step 3: Append the config to `src/lib/finder.ts`**

Add these exports at the end of the file:

```ts
/* -------------------------------------------------------------- wizard config */

export type FinderStepId = "category" | "budget" | "platform";

export type FinderOption = {
  /** Stored answer value. For the category step this is a category slug or "any". */
  value: string;
  label: string;
  description: string;
  /** Lucide icon name (resolved via the icon registry). */
  icon: string;
};

export type FinderStep = {
  id: FinderStepId;
  /** Eyebrow shown above the question. */
  eyebrow: string;
  /** The question itself. */
  title: string;
  options: FinderOption[];
};

// The 8 seeded categories, phrased as user goals. Kept in sync with
// src/data/categories.ts (slugs must match).
const CATEGORY_OPTIONS: FinderOption[] = [
  { value: "any", label: "Not sure yet", description: "Show me the best all-round tools", icon: "Sparkles" },
  { value: "writing", label: "Write & edit", description: "Draft, rewrite, and polish copy", icon: "PenLine" },
  { value: "image", label: "Create images", description: "Generate art, product shots, illustration", icon: "Image" },
  { value: "coding", label: "Write code", description: "Autocomplete, refactor, and ship faster", icon: "Code" },
  { value: "productivity", label: "Get organized", description: "Notes, planning, and workspace copilots", icon: "Zap" },
  { value: "video", label: "Make video", description: "Generate and edit footage", icon: "Clapperboard" },
  { value: "audio", label: "Work with audio", description: "Voices, narration, and music", icon: "AudioLines" },
  { value: "research", label: "Research & cite", description: "Answers you can actually source", icon: "BookOpen" },
  { value: "marketing", label: "Grow & market", description: "SEO, ads, and agentic campaigns", icon: "Megaphone" },
];

export const FINDER_STEPS: FinderStep[] = [
  {
    id: "category",
    eyebrow: "What brings you here",
    title: "What do you want to do?",
    options: CATEGORY_OPTIONS,
  },
  {
    id: "budget",
    eyebrow: "Your budget",
    title: "How do you want to pay?",
    options: [
      { value: "free", label: "Free to start", description: "I need a genuine free tier", icon: "Gift" },
      { value: "trial", label: "Trial first", description: "Let me try before I buy", icon: "Timer" },
      { value: "pay", label: "Pay for the best", description: "Cost isn't the deciding factor", icon: "Gem" },
    ],
  },
  {
    id: "platform",
    eyebrow: "Where you work",
    title: "Where do you need it to run?",
    options: [
      { value: "any", label: "Anywhere", description: "Platform isn't important", icon: "Globe" },
      { value: "web", label: "In the browser", description: "Web app or extension", icon: "Globe" },
      { value: "mac", label: "macOS", description: "A native Mac app", icon: "Laptop" },
      { value: "windows", label: "Windows", description: "A native Windows app", icon: "Laptop" },
      { value: "mobile", label: "Mobile", description: "iOS or Android", icon: "Smartphone" },
      { value: "api", label: "Dev / API", description: "API, CLI, or IDE integration", icon: "Terminal" },
    ],
  },
];
```

- [ ] **Step 4: Verify tests pass + icon names exist**

Run: `npm run test -- src/lib/finder.test.ts`
Expected: PASS.

Then confirm every icon used above exists in the registry (guards Lucide renames):

Run: `node -e "const s=require('fs').readFileSync('src/components/shared/icon.tsx','utf8'); for (const n of ['Sparkles','PenLine','Image','Code','Zap','Clapperboard','AudioLines','BookOpen','Megaphone','Gift','Timer','Gem','Globe','Laptop','Smartphone','Terminal']) if(!s.includes(n)) console.log('MISSING',n); console.log('icon check done');"`
Expected: prints only `icon check done` (no `MISSING`). If any are MISSING, pick an existing near-equivalent from `icon.tsx` and update the config before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finder.ts src/lib/finder.test.ts
git commit -m "feat(finder): declarative 3-step question config"
```

---

## Task 3: Result card (reason chips over the existing tool card)

**Files:**
- Create: `src/components/finder/finder-result-card.tsx`

Reuses `SavableToolCard` for full visual and behavioral parity with the directory, and stacks reason chips above it.

- [ ] **Step 1: Create `src/components/finder/finder-result-card.tsx`**

```tsx
import type { Tool } from "@/lib/schemas";
import { SavableToolCard } from "@/components/shared/savable-tool-card";
import { Icon } from "@/components/shared/icon";

/**
 * A finder result: the standard directory card with a row of "why this" reason
 * chips above it, so the recommendation reads as reasoned rather than random.
 */
export function FinderResultCard({
  tool,
  categoryName,
  reasons,
}: {
  tool: Tool;
  categoryName?: string;
  reasons: string[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {reasons.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Why we recommend this">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="inline-flex items-center gap-1 rounded-full border border-teal/25 bg-teal/10 px-2.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-teal"
            >
              <Icon name="Check" className="size-3" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      <SavableToolCard tool={tool} categoryName={categoryName} className="flex-1" />
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/finder/finder-result-card.tsx
git commit -m "feat(finder): result card with reason chips"
```

---

## Task 4: The wizard (client component)

**Files:**
- Create: `src/components/finder/oracle-finder.tsx`

Holds the flow state, renders one step at a time, computes results with `recommendTools`, and reflects the final answers to the URL for shareability. Matches the app's aesthetic (Container, Cardot display headings, teal, glass, mono eyebrows).

- [ ] **Step 1: Create `src/components/finder/oracle-finder.tsx`**

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Tool } from "@/lib/schemas";
import {
  FINDER_STEPS,
  recommendTools,
  type BudgetPref,
  type FinderAnswers,
  type FinderStepId,
  type PlatformPref,
} from "@/lib/finder";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { Reveal } from "@/components/shared/reveal";
import { FinderResultCard } from "@/components/finder/finder-result-card";
import { cn } from "@/lib/utils";

type Props = {
  tools: Tool[];
  categoryNames: Record<string, string>;
};

// URL <-> answers helpers. Keeps results shareable/bookmarkable.
const PARAM: Record<FinderStepId, string> = {
  category: "use",
  budget: "budget",
  platform: "platform",
};

function readAnswers(params: URLSearchParams): FinderAnswers {
  const category = params.get(PARAM.category) ?? undefined;
  const budget = params.get(PARAM.budget) as BudgetPref | null;
  const platform = params.get(PARAM.platform) as PlatformPref | null;
  return {
    category: category && category !== "any" ? category : undefined,
    budget: budget ?? undefined,
    platform: platform ?? undefined,
  };
}

export function OracleFinder({ tools, categoryNames }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categoryNameMap = useMemo(
    () => new Map(Object.entries(categoryNames)),
    [categoryNames],
  );

  // If the URL already carries answers (shared link), jump straight to results.
  const initial = useMemo(() => readAnswers(searchParams), [searchParams]);
  const hasInitial = Boolean(
    initial.category || initial.budget || initial.platform,
  );

  const [answers, setAnswers] = useState<FinderAnswers>(initial);
  const [stepIndex, setStepIndex] = useState(hasInitial ? FINDER_STEPS.length : 0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const showResults = stepIndex >= FINDER_STEPS.length;

  const results = useMemo(
    () => (showResults ? recommendTools(tools, answers, categoryNameMap, 3) : []),
    [showResults, tools, answers, categoryNameMap],
  );

  const focusHeading = () =>
    requestAnimationFrame(() => headingRef.current?.focus());

  const choose = (stepId: FinderStepId, value: string) => {
    const next: FinderAnswers = { ...answers };
    if (stepId === "category") next.category = value === "any" ? undefined : value;
    if (stepId === "budget") next.budget = value as BudgetPref;
    if (stepId === "platform")
      next.platform = value === "any" ? undefined : (value as PlatformPref);
    setAnswers(next);

    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    focusHeading();

    // On completion, reflect answers to the URL (shallow, no scroll jump).
    if (nextIndex >= FINDER_STEPS.length) {
      const params = new URLSearchParams();
      if (next.category) params.set(PARAM.category, next.category);
      if (next.budget) params.set(PARAM.budget, next.budget);
      if (next.platform) params.set(PARAM.platform, next.platform);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const back = () => {
    setStepIndex((i) => Math.max(0, i - 1));
    focusHeading();
  };

  const restart = () => {
    setAnswers({});
    setStepIndex(0);
    router.replace(pathname, { scroll: false });
    focusHeading();
  };

  const chosenCategory = answers.category;

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col">
        {/* Masthead */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="emblem size-10"
            style={{ color: "var(--brand-teal)" }}
            aria-hidden
          />
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Ask the Oracle
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            Find the right AI tool
          </h1>
          <p className="max-w-md text-pretty text-muted-foreground">
            Answer three quick questions and the Oracle will name the tools worth
            your trust.
          </p>
        </div>

        {/* Progress */}
        {!showResults && (
          <div className="mt-10 flex items-center justify-center gap-2" aria-hidden>
            {FINDER_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === stepIndex ? "w-8 bg-teal" : i < stepIndex ? "w-4 bg-teal/50" : "w-4 bg-border",
                )}
              />
            ))}
          </div>
        )}

        <div className="mt-8">
          {showResults ? (
            <section aria-live="polite">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="font-mono text-xs tracking-[0.2em] text-teal uppercase">
                  The Oracle recommends
                </p>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display text-2xl font-semibold outline-none"
                >
                  Your top {results.length} matches
                </h2>
              </div>

              <div className="mt-8 flex flex-col gap-5">
                {results.map((r, i) => (
                  <Reveal key={r.tool.slug} index={Math.min(i, 4)}>
                    <FinderResultCard
                      tool={r.tool}
                      categoryName={categoryNameMap.get(r.tool.categorySlug)}
                      reasons={r.reasons}
                    />
                  </Reveal>
                ))}
              </div>

              <div className="mt-10 flex flex-col items-center gap-4">
                {chosenCategory && (
                  <Link
                    href={`/tools?cat=${chosenCategory}`}
                    className="inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
                  >
                    See all {categoryNameMap.get(chosenCategory)} tools
                    <Icon name="ArrowRight" className="size-3.5" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                >
                  <Icon name="RotateCcw" className="size-4" />
                  Start over
                </button>
              </div>
            </section>
          ) : (
            <FinderStepView
              key={FINDER_STEPS[stepIndex].id}
              step={FINDER_STEPS[stepIndex]}
              index={stepIndex}
              total={FINDER_STEPS.length}
              selected={
                FINDER_STEPS[stepIndex].id === "category"
                  ? answers.category ?? "any"
                  : FINDER_STEPS[stepIndex].id === "budget"
                    ? answers.budget
                    : answers.platform ?? "any"
              }
              headingRef={headingRef}
              onChoose={(value) => choose(FINDER_STEPS[stepIndex].id, value)}
              onBack={stepIndex > 0 ? back : undefined}
            />
          )}
        </div>
      </div>
    </Container>
  );
}

function FinderStepView({
  step,
  index,
  total,
  selected,
  headingRef,
  onChoose,
  onBack,
}: {
  step: (typeof FINDER_STEPS)[number];
  index: number;
  total: number;
  selected?: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onChoose: (value: string) => void;
  onBack?: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {step.eyebrow} · {index + 1} of {total}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold outline-none sm:text-3xl"
        >
          {step.title}
        </h2>
      </div>

      <div
        role="radiogroup"
        aria-label={step.title}
        className="mt-8 grid gap-3 sm:grid-cols-2"
      >
        {step.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChoose(opt.value)}
              className={cn(
                "group flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-glow-sm",
                isSelected
                  ? "border-teal/50 bg-teal/5 ring-1 ring-teal/30"
                  : "border-border bg-card",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal ring-1 ring-teal/20">
                <Icon name={opt.icon} className="size-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold">
                  {opt.label}
                </span>
                <span className="block text-sm text-pretty text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {onBack && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="ArrowLeft" className="size-4" />
            Back
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (If `size-4.5` is rejected by Tailwind, replace with `size-5`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/finder/oracle-finder.tsx
git commit -m "feat(finder): the Ask the Oracle wizard"
```

---

## Task 5: The `/finder` route (server page)

**Files:**
- Create: `src/app/finder/page.tsx`

- [ ] **Step 1: Create `src/app/finder/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { OracleFinder } from "@/components/finder/oracle-finder";
import { getAllTools, getCategories } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ask the Oracle — find the right AI tool",
  description:
    "Answer three quick questions and Enki recommends the AI tools worth your trust, matched to your use case, budget, and platform.",
  alternates: { canonical: "/finder" },
  openGraph: {
    title: `Ask the Oracle · ${siteConfig.name}`,
    description:
      "Guided recommendations for the AI tools worth your trust — matched to your use case, budget, and platform.",
    type: "website",
  },
};

export default function FinderPage() {
  const tools = getAllTools();
  const categoryNames = Object.fromEntries(
    getCategories().map((c) => [c.slug, c.name]),
  );

  return (
    <Suspense>
      <OracleFinder tools={tools} categoryNames={categoryNames} />
    </Suspense>
  );
}
```

Note: `<Suspense>` is required because `OracleFinder` calls `useSearchParams()` (Next requires a Suspense boundary around it in a statically-rendered page) — this mirrors `src/app/tools/page.tsx` and `src/app/compare/page.tsx`.

- [ ] **Step 2: Verify build renders the route**

Run: `npm run build`
Expected: build succeeds and the route list includes `○ /finder`.

- [ ] **Step 3: Commit**

```bash
git add src/app/finder/page.tsx
git commit -m "feat(finder): /finder route with metadata and canonical"
```

---

## Task 6: Entry points — nav link, sitemap, home CTA

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/app/sitemap.ts`
- Create: `src/components/home/finder-cta.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add Finder to the nav — `src/lib/site.ts`**

In the `nav` array, add a Finder entry after Directory:

```ts
  nav: [
    { title: "Directory", href: "/tools" },
    { title: "Finder", href: "/finder" },
    { title: "Categories", href: "/categories" },
    { title: "Compare", href: "/compare" },
    { title: "Leaderboards", href: "/leaderboards" },
  ],
```

- [ ] **Step 2: Add `/finder` to the sitemap — `src/app/sitemap.ts`**

In the `staticRoutes` array (in `src/app/sitemap.ts`), add an entry with priority 0.9 right after the `/tools` entry:

```ts
    { path: "/finder", priority: 0.9 },
```

- [ ] **Step 3: Create the home CTA — `src/components/home/finder-cta.tsx`**

```tsx
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";

/**
 * Home-page band inviting visitors into the guided finder. On-brand: a glass
 * panel with the emblem and a single primary action.
 */
export function FinderCta() {
  return (
    <Container className="py-16">
      <div className="relative overflow-hidden rounded-3xl border border-teal/20 bg-card p-8 text-center ring-hairline sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgb(var(--glow) / 0.10), transparent 70%)",
          }}
        />
        <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
          <span
            className="emblem size-9"
            style={{ color: "var(--brand-teal)" }}
            aria-hidden
          />
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Not sure where to start?
          </p>
          <h2 className="text-balance font-display text-3xl font-semibold sm:text-4xl">
            Let the Oracle choose for you
          </h2>
          <p className="max-w-md text-pretty text-muted-foreground">
            Three quick questions — your use case, budget, and platform — and
            we&apos;ll name the tools worth your trust.
          </p>
          <Link
            href="/finder"
            className="group mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] shadow-glow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-bright hover:shadow-glow"
          >
            Ask the Oracle
            <Icon
              name="ArrowRight"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </Container>
  );
}
```

- [ ] **Step 4: Render the CTA on the home page — `src/app/page.tsx`**

Add the import near the other home-component imports:

```tsx
import { FinderCta } from "@/components/home/finder-cta";
```

Then place `<FinderCta />` in the page body. Read `src/app/page.tsx` to find a natural seam — put it immediately **after** the featured-tools section and **before** the "how we vet" (`#how-we-vet`) section. Insert:

```tsx
      <FinderCta />
```

- [ ] **Step 5: Verify types, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS; route list still includes `/finder`, and `/sitemap.xml`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/site.ts src/app/sitemap.ts src/components/home/finder-cta.tsx src/app/page.tsx
git commit -m "feat(finder): nav link, sitemap entry, and home CTA"
```

---

## Task 7: End-to-end happy path

**Files:**
- Create: `tests/e2e/finder.spec.ts`

Mirrors the existing `tests/e2e/directory.spec.ts` conventions (Playwright, `baseURL` from config).

- [ ] **Step 1: Create `tests/e2e/finder.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("Ask the Oracle finder", () => {
  test("walks the 3-step flow and shows reasoned results", async ({ page }) => {
    await page.goto("/finder");

    // Q1 use-case
    await expect(
      page.getByRole("heading", { name: "What do you want to do?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Write code/ }).click();

    // Q2 budget
    await expect(
      page.getByRole("heading", { name: "How do you want to pay?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Free to start/ }).click();

    // Q3 platform
    await expect(
      page.getByRole("heading", { name: "Where do you need it to run?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Dev \/ API/ }).click();

    // Results
    await expect(page.getByText("The Oracle recommends")).toBeVisible();
    const cards = page.locator('a[href^="/tools/"]');
    await expect(cards.first()).toBeVisible();
    // The URL reflects the answers (shareable).
    await expect(page).toHaveURL(/use=coding/);
    await expect(page).toHaveURL(/budget=free/);
    await expect(page).toHaveURL(/platform=api/);

    // Start over returns to Q1.
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(
      page.getByRole("heading", { name: "What do you want to do?" }),
    ).toBeVisible();
  });

  test("a shared URL lands directly on results", async ({ page }) => {
    await page.goto("/finder?use=image&budget=pay&platform=any");
    await expect(page.getByText("The Oracle recommends")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e -- finder`
Expected: 2 finder tests PASS. (The Playwright config builds + starts its own server on port 3100.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/finder.spec.ts
git commit -m "test(finder): e2e happy path and shared-link entry"
```

---

## Final Verification Phase

Run every gate; record real output. Do not claim success without it.

- [ ] **V1: Static gates**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
Expected: all PASS. Unit test count increased by the finder tests; build route list includes `/finder`.

- [ ] **V2: E2E**

```bash
npm run test:e2e
```
Expected: prior suite still green + the 2 new finder tests pass. (If the pre-existing auth-gated review test fails as before, that's the known environmental failure — unrelated.)

- [ ] **V3: Browser visual sweep** (per CLAUDE.md → Visual Sweep — this feature is highly visual)

Serve production (`npx next start` after build) and open via `preview_start { url }`. Then:
1. `/finder` — masthead + Q1 render; console clean (`read_console_messages`).
2. Click through all 3 steps; verify progress dots advance and each step's options render in a 2-col grid.
3. On results: measure with `javascript_tool` that the 3 result cards render, reason chips appear above each card, and nothing overflows its container (`chip/card right <= container right`); check the "See all …" and "Start over" controls.
4. `resize_window` mobile (375) — options stack to 1 col, cards fit, no horizontal scroll.
5. Home `/` — the `FinderCta` band renders between featured tools and "how we vet", styling matches; no console errors.
6. Confirm the nav shows "Finder" and it routes.

- [ ] **V4: Report** — summarize gates + measurements; screenshot if the pane composites, else cite measurements.

---

## Self-Review

- **Spec coverage:** 3-question flow (Task 2 config + Task 4 wizard) ✓; deterministic reasoned scoring (Task 1) ✓; results reuse directory card + reason chips (Task 3) ✓; `/finder` route + SEO (Task 5) ✓; shareable URL (Task 4 + e2e Task 7) ✓; entry points nav/sitemap/home CTA (Task 6) ✓; verification incl. visual sweep (Final) ✓. No backend/DB — matches "self-contained" scope.
- **Placeholder scan:** none — full code in every code step.
- **Type consistency:** `FinderAnswers`, `FinderResult`, `BudgetPref`, `PlatformPref`, `FinderStep(s)`, `FinderStepId`, `FinderOption`, `recommendTools`, `scoreTools`, `PLATFORM_LABEL` defined in Task 1–2 and used consistently in Tasks 3–7. `categoryNames` is passed to the client as a `Record<string,string>` (serializable) and rebuilt into a `Map` inside the wizard — Maps aren't serializable across the server/client boundary, hence the Record.
- **Ambiguity check:** CTA placement is pinned ("after featured tools, before #how-we-vet"); results count pinned at 3; icon names verified against the registry in Task 2 Step 4.
