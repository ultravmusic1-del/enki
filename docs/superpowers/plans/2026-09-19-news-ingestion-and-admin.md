# News Ingestion and Admin Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 1 of the AI news pivot: Enki pulls AI news from RSS/Atom feeds into a private queue every day, suggests the directory tools each story mentions, and gives the owner an admin queue to summarise, tag and publish stories. No public page changes.

**Architecture:** Feeds are fetched and parsed in `src/lib/news/*` (pure, unit-tested modules). The cron route and an admin "Fetch now" action both call one `runNewsIngest()`, which writes through secret-gated `SECURITY DEFINER` RPCs using the anon client, so the `service_role` key is never used. Admin writes to stories go only through `is_admin()`-guarded RPCs; `stories` has no table-level write grant for any API role.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS + Vault), Zod v4, Vitest, `fast-xml-parser` 5.x, Sentry.

**Spec:** `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md` (sections 3, 4, 5, 9, 10, 11 item 1).

---

## Deviations from the spec (deliberate, all tighten it)

1. **The excerpt lives in its own table, `story_excerpts`**, instead of a column-revoked `stories.excerpt`. Row-level RLS (`is_admin()` only) is simpler to prove than a column grant, and it keeps the excerpt away from signed-in non-admins too.
2. **Admin story writes go through two RPCs** (`admin_publish_story`, `admin_set_story_status`) rather than table updates. Publishing (story fields + tool list) becomes atomic, and no API role holds UPDATE on `stories`.
3. **The ingest RPCs raise `42501` on a wrong secret** instead of returning `false`. A misconfigured secret then fails the cron loudly instead of producing a healthy-looking empty run.
4. **`story_views` is deferred to merge 2**, where its only writer (`/api/story-view`) is built.
5. **Public revalidation (`/`, `/news`, beat and story pages) is deferred to merge 2.** Merge 1 revalidates `/admin/news` only, because no public route reads stories yet.
6. **The cron route fails closed without `CRON_SECRET`.** `keep-warm` allows an unset secret; this route triggers outbound fetches, so it refuses instead.

---

## File map

| File | Responsibility |
|---|---|
| `src/data/beats.ts` | The five news beats (slug, name) |
| `src/lib/schemas.ts` | Add optional `aliases` to `toolSchema` |
| `src/data/tools.ts` | Seed aliases on 7 tools |
| `src/lib/news/schemas.ts` | Zod schemas and limits for publishing a story and adding a source; `isIndexableTake` |
| `src/lib/news/slug.ts` | `makeStorySlug(headline, id)` |
| `src/lib/news/format-age.ts` | `formatAge(iso, now)` for "3h ago" labels (server-rendered only) |
| `src/lib/news/match-tools.ts` | `matchTools(text, tools)` |
| `src/lib/news/parse-feed.ts` | `parseFeed(xml)` for RSS 2.0, RSS 1.0 (RDF) and Atom |
| `src/lib/news/ingest.ts` | `ingestAll(deps)`, `IngestStore` interface, `fetchFeedText` |
| `src/lib/news/ingest-store.ts` | `createSupabaseIngestStore(client, secret)` over the three ingest RPCs |
| `src/lib/news/run-ingest.ts` | `runNewsIngest()`: wires env, anon client, tools and Sentry into `ingestAll` |
| `src/app/api/ingest-news/route.ts` | Daily cron entry point |
| `src/app/admin/news/actions.ts` | Server actions: publish, set status, fetch now, add/toggle source |
| `src/app/admin/news/types.ts` | `QueueStory`, `ToolOption` |
| `src/app/admin/news/page.tsx` | Queue page (pending / published views) |
| `src/app/admin/news/news-queue.tsx` | Client list with J/K/P/R keyboard flow |
| `src/app/admin/news/story-editor.tsx` | Client form for one story |
| `src/app/admin/news/tool-picker.tsx` | Client chip list + search for tools |
| `src/app/admin/news/fetch-now-button.tsx` | Client "Fetch now" button |
| `src/app/admin/news/sources/page.tsx` | Sources page |
| `src/app/admin/news/sources/source-form.tsx` | Client add-source form |
| `src/app/admin/news/sources/source-toggle.tsx` | Client active toggle |
| `src/app/admin/page.tsx` | "Pending stories" KPI and "News queue" link |
| `src/lib/supabase/database.types.ts` | Hand-maintained types for the new tables and RPCs |
| `scripts/audit-rls/expectations.mjs`, `scripts/audit-rls.mjs` | RLS probes for the new tables and RPCs |
| `vercel.json`, `.env.example`, `handoff.md` | Cron entry, env contract, docs |

Every new `*.ts` module gets a sibling `*.test.ts`.

---

### Task 1: Add the feed parser dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run: `pnpm add fast-xml-parser@^5.11.1`
Expected: `dependencies` gains `"fast-xml-parser": "^5.11.1"`. If pnpm refuses because of `minimumReleaseAge`, install the newest version it allows (`pnpm view fast-xml-parser versions`), not an exclusion.

- [ ] **Step 2: Confirm the audit gate still passes**

Run: `pnpm audit --prod`
Expected: no high or critical advisories (CI gates on this).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add fast-xml-parser for news feed ingestion"
```

---

### Task 2: Beats

**Files:**
- Create: `src/data/beats.ts`
- Test: `src/data/beats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/beats.test.ts
import { describe, it, expect } from "vitest";
import { beats, beatSlugs, getBeat } from "@/data/beats";

describe("beats", () => {
  it("matches the database check constraint on stories.beat", () => {
    // The migration in Task 8 hardcodes this list. Changing one without the
    // other makes publishing fail with a constraint violation.
    expect(beatSlugs).toEqual([
      "models-labs",
      "products-launches",
      "funding-business",
      "policy-safety",
      "research",
    ]);
  });

  it("names every beat", () => {
    for (const beat of beats) expect(beat.name.length).toBeGreaterThan(0);
  });

  it("looks a beat up by slug", () => {
    expect(getBeat("research")?.name).toBe("Research");
    expect(getBeat("sports")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/data/beats.test.ts`
Expected: FAIL, cannot resolve `@/data/beats`.

- [ ] **Step 3: Implement**

```ts
// src/data/beats.ts
/**
 * News beats: the fixed sections stories are filed under.
 *
 * Deliberately separate from directory categories. News breaks along lines
 * like funding rounds and regulation that no tool category covers.
 * `stories.beat` has a check constraint listing these slugs; keep them in step.
 */
export const beats = [
  { slug: "models-labs", name: "Models & Labs" },
  { slug: "products-launches", name: "Products & Launches" },
  { slug: "funding-business", name: "Funding & Business" },
  { slug: "policy-safety", name: "Policy & Safety" },
  { slug: "research", name: "Research" },
] as const;

export type Beat = (typeof beats)[number];
export type BeatSlug = Beat["slug"];

export const beatSlugs = beats.map((b) => b.slug) as [BeatSlug, ...BeatSlug[]];

export function getBeat(slug: string): Beat | undefined {
  return beats.find((b) => b.slug === slug);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/data/beats.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/data/beats.ts src/data/beats.test.ts
git commit -m "feat(news): add the five news beats"
```

---

### Task 3: Tool aliases

**Files:**
- Modify: `src/lib/schemas.ts` (the `toolSchema` object, currently around line 93)
- Modify: `src/data/tools.ts`
- Test: `src/lib/schemas.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `src/lib/schemas.test.ts`)

```ts
import { tools as seedTools } from "@/data/tools";

describe("toolSchema aliases", () => {
  it("keeps aliases instead of stripping them", () => {
    const parsed = toolSchema.parse({ ...seedTools[0], aliases: ["Alt name"] });
    expect(parsed.aliases).toEqual(["Alt name"]);
  });

  it("rejects an empty alias", () => {
    expect(toolSchema.safeParse({ ...seedTools[0], aliases: [""] }).success).toBe(false);
  });

  it("leaves aliases optional", () => {
    const withoutAliases = seedTools.find((t) => t.aliases === undefined);
    expect(withoutAliases).toBeDefined();
    expect(toolSchema.safeParse(withoutAliases).success).toBe(true);
  });

  it("never gives two seed tools the same name or alias", () => {
    // A shared term would attach both tools to every story that mentions it.
    const seen = new Map<string, string>();
    for (const tool of seedTools) {
      for (const term of [tool.name, ...(tool.aliases ?? [])]) {
        const key = term.toLowerCase();
        expect(seen.get(key) ?? tool.slug, `"${term}"`).toBe(tool.slug);
        seen.set(key, tool.slug);
      }
    }
  });
});
```

If `toolSchema` isn't already imported at the top of the test file, add `import { toolSchema } from "@/lib/schemas";`. Check how `src/data/tools.ts` exports the array (`export const tools`) and match the import to it.

- [ ] **Step 2: Run and watch the first test fail**

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: "keeps aliases" FAILS (Zod strips the unknown key, so `parsed.aliases` is `undefined`).

- [ ] **Step 3: Add the field** in `src/lib/schemas.ts`, directly after `name: z.string().min(1),` inside `toolSchema`:

```ts
  /**
   * Other names news coverage uses for this tool ("Codeium" for Windsurf).
   * Read by the news tool matcher only; never displayed.
   */
  aliases: z.array(z.string().min(1)).optional(),
```

- [ ] **Step 4: Seed aliases** in `src/data/tools.ts`. Each edit adds one line directly after the tool's existing `name:` line:

| After this line | Add |
|---|---|
| `name: "Windsurf",` | `aliases: ["Codeium"],` |
| `name: "Replit Agent",` | `aliases: ["Replit"],` |
| `name: "Notion AI",` | `aliases: ["Notion"],` |
| `name: "DALL·E 3",` | `aliases: ["DALL-E", "DALL·E", "DALL-E 3"],` |
| `name: "Stable Diffusion",` | `aliases: ["Stability AI"],` |
| `name: "Adobe Firefly",` | `aliases: ["Firefly"],` |
| `name: "ElevenLabs",` | `aliases: ["Eleven Labs"],` |

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/lib/schemas.test.ts src/lib/content.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/data/tools.ts
git commit -m "feat(tools): add optional aliases for news tool matching"
```

---

### Task 4: Story schemas, slug and age helpers

**Files:**
- Create: `src/lib/news/schemas.ts`, `src/lib/news/slug.ts`, `src/lib/news/format-age.ts`
- Test: `src/lib/news/schemas.test.ts`, `src/lib/news/slug.test.ts`, `src/lib/news/format-age.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/news/slug.test.ts
import { describe, it, expect } from "vitest";
import { makeStorySlug } from "@/lib/news/slug";

const ID = "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("makeStorySlug", () => {
  it("kebab-cases the headline and appends six id characters", () => {
    expect(makeStorySlug("OpenAI ships GPT-6", ID)).toBe("openai-ships-gpt-6-3f2a9c");
  });

  it("folds accents and punctuation", () => {
    expect(makeStorySlug("Mistral’s Café model!", ID)).toBe("mistral-s-cafe-model-3f2a9c");
  });

  it("falls back to 'story' when nothing survives", () => {
    expect(makeStorySlug("🚀🚀", ID)).toBe("story-3f2a9c");
  });

  it("cuts long headlines at a word boundary", () => {
    const slug = makeStorySlug(
      "Anthropic and Google announce a sweeping partnership on compute capacity across three continents",
      ID,
    );
    expect(slug.length).toBeLessThanOrEqual(67);
    expect(slug.endsWith("-3f2a9c")).toBe(true);
    expect(slug).not.toMatch(/--/);
  });

  it("always satisfies the database slug constraint", () => {
    for (const h of ["A", "  --  ", "Ünïcödé", "x".repeat(200), "GPT-5 vs. Claude: who wins?"]) {
      expect(makeStorySlug(h, ID)).toMatch(SLUG_RE);
    }
  });
});
```

```ts
// src/lib/news/format-age.test.ts
import { describe, it, expect } from "vitest";
import { formatAge } from "@/lib/news/format-age";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("formatAge", () => {
  it.each([
    ["2026-09-19T11:59:40Z", "just now"],
    ["2026-09-19T11:48:00Z", "12m ago"],
    ["2026-09-19T09:00:00Z", "3h ago"],
    ["2026-09-16T12:00:00Z", "3d ago"],
  ])("%s → %s", (iso, expected) => {
    expect(formatAge(iso, NOW)).toBe(expected);
  });

  it("treats a future time as just now", () => {
    expect(formatAge("2026-09-19T13:00:00Z", NOW)).toBe("just now");
  });

  it("reports unknown for missing or invalid input", () => {
    expect(formatAge(null, NOW)).toBe("unknown");
    expect(formatAge("not a date", NOW)).toBe("unknown");
  });
});
```

```ts
// src/lib/news/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  isIndexableTake,
  newsSourceInputSchema,
  storyPublishSchema,
} from "@/lib/news/schemas";

const base = {
  id: "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b",
  headline: "OpenAI ships GPT-6",
  summary: "x".repeat(40),
  beat: "models-labs",
  featured: false,
  toolSlugs: ["cursor"],
};

describe("storyPublishSchema", () => {
  it("accepts a complete story", () => {
    expect(storyPublishSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    [39, false],
    [40, true],
    [320, true],
    [321, false],
  ])("summary of %i chars → valid %s", (n, ok) => {
    expect(storyPublishSchema.safeParse({ ...base, summary: "x".repeat(n) }).success).toBe(ok);
  });

  it("counts the summary after trimming", () => {
    expect(
      storyPublishSchema.safeParse({ ...base, summary: `  ${"x".repeat(39)}  ` }).success,
    ).toBe(false);
  });

  it("rejects an unknown beat", () => {
    expect(storyPublishSchema.safeParse({ ...base, beat: "sports" }).success).toBe(false);
  });

  it("caps tools at five and rejects duplicates", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(storyPublishSchema.safeParse({ ...base, toolSlugs: six }).success).toBe(false);
    expect(
      storyPublishSchema.safeParse({ ...base, toolSlugs: ["cursor", "cursor"] }).success,
    ).toBe(false);
  });

  it("turns a whitespace-only take into no take", () => {
    const parsed = storyPublishSchema.parse({ ...base, take: "   " });
    expect(parsed.take).toBeUndefined();
  });

  it("rejects an id that is not a uuid", () => {
    expect(storyPublishSchema.safeParse({ ...base, id: "42" }).success).toBe(false);
  });
});

describe("isIndexableTake", () => {
  it.each([
    [299, false],
    [300, true],
    [301, true],
  ])("take of %i chars → %s", (n, expected) => {
    expect(isIndexableTake("y".repeat(n))).toBe(expected);
  });

  it("ignores surrounding whitespace and handles no take", () => {
    expect(isIndexableTake(`   ${"y".repeat(299)}   `)).toBe(false);
    expect(isIndexableTake(null)).toBe(false);
    expect(isIndexableTake(undefined)).toBe(false);
  });
});

describe("newsSourceInputSchema", () => {
  const source = {
    name: "TechCrunch AI",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
    siteUrl: "https://techcrunch.com",
  };

  it("accepts http(s) URLs", () => {
    expect(newsSourceInputSchema.safeParse(source).success).toBe(true);
  });

  it("rejects non-http feed URLs", () => {
    expect(
      newsSourceInputSchema.safeParse({ ...source, feedUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });

  it("requires a name", () => {
    expect(newsSourceInputSchema.safeParse({ ...source, name: " " }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/news`
Expected: FAIL, the three modules don't exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/news/slug.ts
const MAX_BASE = 60;

/**
 * A story's public slug: the headline in kebab-case plus the first six
 * characters of its id. The suffix keeps two stories with the same headline
 * apart without a database round trip.
 */
export function makeStorySlug(headline: string, id: string): string {
  const suffix = id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6);
  const base = headline
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${trimAtDash(base, MAX_BASE) || "story"}-${suffix}`;
}

function trimAtDash(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}
```

```ts
// src/lib/news/format-age.ts
/**
 * "12m ago" / "3h ago" / "3d ago".
 *
 * Call it on the server and pass the string down. Computing it inside a client
 * component renders one value on the server and another on hydration.
 */
export function formatAge(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const minutes = Math.floor(Math.max(0, now.getTime() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

```ts
// src/lib/news/schemas.ts
import { z } from "zod";
import { beatSlugs } from "@/data/beats";
import { isHttpUrl } from "@/lib/safe-url";

export const HEADLINE_MAX = 300;
export const SUMMARY_MIN = 40;
export const SUMMARY_MAX = 320;
export const TAKE_MAX = 5000;
/** A take this long makes a story page indexable (spec §6.1). */
export const TAKE_INDEXABLE_MIN = 300;
export const MAX_STORY_TOOLS = 5;

const toolSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const storyPublishSchema = z.object({
  id: z.uuid(),
  headline: z.string().trim().min(1, "Add a headline.").max(HEADLINE_MAX),
  summary: z
    .string()
    .trim()
    .min(SUMMARY_MIN, `The summary needs at least ${SUMMARY_MIN} characters.`)
    .max(SUMMARY_MAX, `Keep the summary under ${SUMMARY_MAX} characters.`),
  take: z
    .string()
    .trim()
    .max(TAKE_MAX)
    .optional()
    .transform((v) => (v ? v : undefined)),
  beat: z.enum(beatSlugs, "Pick a beat."),
  featured: z.boolean(),
  toolSlugs: z
    .array(toolSlug)
    .max(MAX_STORY_TOOLS, `At most ${MAX_STORY_TOOLS} tools.`)
    .refine((slugs) => new Set(slugs).size === slugs.length, "A tool is listed twice."),
});

export type StoryPublishInput = z.input<typeof storyPublishSchema>;

export function isIndexableTake(take: string | null | undefined): boolean {
  return (take?.trim().length ?? 0) >= TAKE_INDEXABLE_MIN;
}

const httpUrl = z.string().trim().refine(isHttpUrl, "Must be an http:// or https:// URL.");

export const newsSourceInputSchema = z.object({
  name: z.string().trim().min(1, "Name the source.").max(80),
  feedUrl: httpUrl,
  siteUrl: httpUrl,
});

export type NewsSourceInput = z.input<typeof newsSourceInputSchema>;
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/lib/news`
Expected: all pass. If the "cuts long headlines" test fails on length, check that `trimAtDash` runs before the suffix is appended.

- [ ] **Step 5: Commit**

```bash
git add src/lib/news
git commit -m "feat(news): story publish schema, slug and age helpers"
```

---

### Task 5: Tool matcher

**Files:**
- Create: `src/lib/news/match-tools.ts`
- Test: `src/lib/news/match-tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/news/match-tools.test.ts
import { describe, it, expect } from "vitest";
import { matchTools, type MatchableTool } from "@/lib/news/match-tools";

const tools: MatchableTool[] = [
  { slug: "cursor", name: "Cursor" },
  { slug: "runway", name: "Runway" },
  { slug: "pika", name: "Pika" },
  { slug: "elevenlabs", name: "ElevenLabs", aliases: ["Eleven Labs"] },
  { slug: "windsurf", name: "Windsurf", aliases: ["Codeium"] },
  { slug: "midjourney", name: "Midjourney" },
  { slug: "suno", name: "Suno" },
  { slug: "github-copilot", name: "GitHub Copilot" },
  { slug: "dall-e-3", name: "DALL·E 3", aliases: ["DALL-E"] },
];

describe("matchTools", () => {
  it("matches an unambiguous name in any case", () => {
    expect(matchTools("elevenlabs raises $180M", tools)).toEqual(["elevenlabs"]);
  });

  it("matches aliases", () => {
    expect(matchTools("Codeium rebrands its editor", tools)).toEqual(["windsurf"]);
    expect(matchTools("Eleven Labs opens a Tokyo office", tools)).toEqual(["elevenlabs"]);
  });

  it("matches whole words only", () => {
    expect(matchTools("A cursory glance at Pikachu", tools)).toEqual([]);
  });

  it("matches ambiguous names only in their exact casing", () => {
    expect(matchTools("The startup has 18 months of runway", tools)).toEqual([]);
    expect(matchTools("Runway launches Gen-5", tools)).toEqual(["runway"]);
    expect(matchTools("move the cursor to the end", tools)).toEqual([]);
  });

  it("matches through possessives and punctuation", () => {
    expect(matchTools("Midjourney's new model, explained", tools)).toEqual(["midjourney"]);
  });

  it("matches names containing punctuation", () => {
    expect(matchTools("DALL-E gets a successor", tools)).toEqual(["dall-e-3"]);
    expect(matchTools("Hands on with DALL·E 3", tools)).toEqual(["dall-e-3"]);
  });

  it("orders results by first appearance", () => {
    expect(matchTools("Suno sues, while Cursor ships", tools)).toEqual(["suno", "cursor"]);
  });

  it("returns each tool once", () => {
    expect(matchTools("Cursor, Cursor, Cursor", tools)).toEqual(["cursor"]);
  });

  it("caps the result at five", () => {
    const text = "Cursor Runway Pika ElevenLabs Windsurf Midjourney Suno";
    expect(matchTools(text, tools)).toHaveLength(5);
  });

  it("does not match a partial multi-word name", () => {
    expect(matchTools("GitHub ships Actions v5", tools)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/news/match-tools.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/news/match-tools.ts
export type MatchableTool = {
  slug: string;
  name: string;
  aliases?: readonly string[];
};

export const MAX_MATCHES = 5;

/**
 * Names that are also ordinary words ("runway", "cursor", "motion") or that
 * several products share. These match only in their exact casing, so "18
 * months of runway" never tags Runway. Every suggestion is still confirmed by
 * a person before it goes live; this only keeps the queue free of obvious noise.
 */
export const CASE_SENSITIVE_TERMS: ReadonlySet<string> = new Set([
  "Claude",
  "Clay",
  "Consensus",
  "Copilot",
  "Cursor",
  "Elicit",
  "Firefly",
  "Gemini",
  "Mem",
  "Motion",
  "Notion",
  "Perplexity",
  "Pika",
  "Runway",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstIndex(text: string, term: string): number {
  const flags = CASE_SENSITIVE_TERMS.has(term) ? "u" : "iu";
  // A letter or digit on either side means the term is part of a longer word.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
    flags,
  );
  return pattern.exec(text)?.index ?? -1;
}

/** Slugs of the tools `text` mentions, in order of first mention, at most `max`. */
export function matchTools(
  text: string,
  tools: readonly MatchableTool[],
  max: number = MAX_MATCHES,
): string[] {
  const hits: { slug: string; index: number }[] = [];
  for (const tool of tools) {
    let earliest = -1;
    for (const term of [tool.name, ...(tool.aliases ?? [])]) {
      const index = firstIndex(text, term);
      if (index !== -1 && (earliest === -1 || index < earliest)) earliest = index;
    }
    if (earliest !== -1) hits.push({ slug: tool.slug, index: earliest });
  }
  return hits
    .sort((a, b) => a.index - b.index || a.slug.localeCompare(b.slug))
    .slice(0, max)
    .map((hit) => hit.slug);
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/news/match-tools.test.ts`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/news/match-tools.ts src/lib/news/match-tools.test.ts
git commit -m "feat(news): match directory tools mentioned in a story"
```

---

### Task 6: Feed parser

**Files:**
- Create: `src/lib/news/parse-feed.ts`
- Test: `src/lib/news/parse-feed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/news/parse-feed.test.ts
import { describe, it, expect } from "vitest";
import { cleanText, FeedParseError, parseFeed } from "@/lib/news/parse-feed";

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example AI</title>
    <item>
      <title><![CDATA[Cursor raises $900M & ships agents]]></title>
      <link>https://example.com/cursor-raise</link>
      <description>&lt;p&gt;The editor&amp;nbsp;maker&lt;/p&gt; grew fast.</description>
      <pubDate>Fri, 19 Sep 2026 09:00:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/cursor.jpg" type="image/jpeg" length="1"/>
    </item>
    <item>
      <title>Media image wins over body image</title>
      <link>https://example.com/two</link>
      <media:content url="https://cdn.example.com/media.jpg" medium="image"/>
      <content:encoded><![CDATA[<p><img src="https://cdn.example.com/body.jpg"></p><p>Body</p>]]></content:encoded>
    </item>
    <item>
      <title>Body image as a fallback</title>
      <link>https://example.com/three</link>
      <content:encoded><![CDATA[<img src="https://cdn.example.com/body.jpg"> Text]]></content:encoded>
    </item>
    <item>
      <title>Plain http image is dropped</title>
      <link>https://example.com/four</link>
      <enclosure url="http://cdn.example.com/insecure.jpg" type="image/jpeg"/>
      <pubDate>not a date</pubDate>
    </item>
    <item>
      <title>No link</title>
    </item>
    <item>
      <title>Script link</title>
      <link>javascript:alert(1)</link>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Lab blog</title>
  <entry>
    <title type="html">Gemini &amp;amp; friends</title>
    <link rel="self" href="https://lab.example.com/feed/1"/>
    <link rel="alternate" type="text/html" href="https://lab.example.com/posts/1"/>
    <summary>Short summary.</summary>
    <published>2026-09-18T10:00:00Z</published>
    <media:thumbnail url="https://lab.example.com/thumb.png"/>
  </entry>
  <entry>
    <title>Updated only</title>
    <link href="https://lab.example.com/posts/2"/>
    <content type="html">&lt;b&gt;Content&lt;/b&gt; body</content>
    <updated>2026-09-17T08:00:00Z</updated>
  </entry>
</feed>`;

const rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>RDF</title></channel>
  <item>
    <title>RDF story</title>
    <link>https://rdf.example.com/1</link>
    <description>Desc</description>
    <dc:date>2026-09-18T07:00:00Z</dc:date>
  </item>
</rdf:RDF>`;

describe("parseFeed: RSS 2.0", () => {
  const items = parseFeed(rss);

  it("keeps items with an http(s) link and skips the rest", () => {
    expect(items.map((i) => i.url)).toEqual([
      "https://example.com/cursor-raise",
      "https://example.com/two",
      "https://example.com/three",
      "https://example.com/four",
    ]);
  });

  it("reads CDATA titles", () => {
    expect(items[0].title).toBe("Cursor raises $900M & ships agents");
  });

  it("strips HTML from the excerpt", () => {
    expect(items[0].excerpt).toBe("The editor maker grew fast.");
  });

  it("parses the publish date", () => {
    expect(items[0].publishedAt?.toISOString()).toBe("2026-09-19T09:00:00.000Z");
  });

  it("reads images from the enclosure, then media tags, then the body", () => {
    expect(items[0].imageUrl).toBe("https://cdn.example.com/cursor.jpg");
    expect(items[1].imageUrl).toBe("https://cdn.example.com/media.jpg");
    expect(items[2].imageUrl).toBe("https://cdn.example.com/body.jpg");
  });

  it("drops non-https images and invalid dates", () => {
    expect(items[3].imageUrl).toBeNull();
    expect(items[3].publishedAt).toBeNull();
  });
});

describe("parseFeed: Atom", () => {
  const items = parseFeed(atom);

  it("prefers the alternate link over rel=self", () => {
    expect(items[0].url).toBe("https://lab.example.com/posts/1");
  });

  it("uses a link without rel as the alternate", () => {
    expect(items[1].url).toBe("https://lab.example.com/posts/2");
  });

  it("decodes an html-typed title", () => {
    expect(items[0].title).toBe("Gemini & friends");
  });

  it("falls back from summary to content and from published to updated", () => {
    expect(items[1].excerpt).toBe("Content body");
    expect(items[1].publishedAt?.toISOString()).toBe("2026-09-17T08:00:00.000Z");
  });

  it("reads media:thumbnail", () => {
    expect(items[0].imageUrl).toBe("https://lab.example.com/thumb.png");
  });
});

describe("parseFeed: RSS 1.0 (RDF)", () => {
  it("reads items and dc:date", () => {
    const [item] = parseFeed(rdf);
    expect(item.title).toBe("RDF story");
    expect(item.publishedAt?.toISOString()).toBe("2026-09-18T07:00:00.000Z");
  });
});

describe("parseFeed: bad input", () => {
  it("throws FeedParseError on a document that is not a feed", () => {
    expect(() => parseFeed("<html><body>Not a feed</body></html>")).toThrow(FeedParseError);
  });

  it("truncates a long excerpt to 1000 characters", () => {
    const long = rss.replace("grew fast.", "a".repeat(5000));
    expect(parseFeed(long)[0].excerpt?.length).toBeLessThanOrEqual(1000);
  });
});

describe("cleanText", () => {
  it("decodes numeric and named entities and collapses whitespace", () => {
    expect(cleanText("A&#8217;s &mdash;\n\n  B&#x2019;s")).toBe("A’s — B’s");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/news/parse-feed.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/news/parse-feed.ts
import { XMLParser } from "fast-xml-parser";
import { isHttpUrl } from "@/lib/safe-url";

export type FeedItem = {
  title: string;
  url: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
};

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

const EXCERPT_MAX = 1000;
const ARRAY_TAGS = new Set([
  "item",
  "entry",
  "link",
  "enclosure",
  "media:content",
  "media:thumbnail",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ARRAY_TAGS.has(name),
});

type Node = Record<string, unknown>;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

/** HTML fragment → plain text: tags removed, entities decoded, whitespace collapsed. */
export function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#")) {
        const hex = entity[1]?.toLowerCase() === "x";
        const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object" && "#text" in value) return text((value as Node)["#text"]);
  return "";
}

function attr(value: unknown, name: string): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const found = (value as Node)[`@_${name}`];
    return typeof found === "string" ? found.trim() : "";
  }
  return "";
}

/** Only https images: an http image on an https page is blocked as mixed content. */
function httpsOnly(url: string): string | null {
  return /^https:\/\//i.test(url) && isHttpUrl(url) ? url : null;
}

function parseDate(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function excerptFrom(html: string): string | null {
  const cleaned = cleanText(html);
  if (!cleaned) return null;
  return cleaned.length > EXCERPT_MAX ? `${cleaned.slice(0, EXCERPT_MAX - 1)}…` : cleaned;
}

function imageFrom(node: Node, bodyHtml: string): string | null {
  for (const enclosure of asArray(node.enclosure)) {
    if (attr(enclosure, "type").startsWith("image/")) {
      const url = httpsOnly(attr(enclosure, "url"));
      if (url) return url;
    }
  }
  for (const key of ["media:content", "media:thumbnail"]) {
    for (const media of asArray(node[key])) {
      const medium = attr(media, "medium");
      const type = attr(media, "type");
      if ((medium && medium !== "image") || (type && !type.startsWith("image/"))) continue;
      const url = httpsOnly(attr(media, "url"));
      if (url) return url;
    }
  }
  const inline = /<img[^>]+src=["']([^"']+)["']/i.exec(bodyHtml);
  return inline ? httpsOnly(inline[1]) : null;
}

type RawItem = {
  title: string;
  url: string;
  excerptHtml: string;
  bodyHtml: string;
  date: string;
  node: Node;
};

function toItem(raw: RawItem): FeedItem | null {
  const title = cleanText(raw.title);
  const url = raw.url.trim();
  if (!title || !isHttpUrl(url)) return null;
  return {
    title,
    url,
    excerpt: excerptFrom(raw.excerptHtml || raw.bodyHtml),
    imageUrl: imageFrom(raw.node, raw.bodyHtml),
    publishedAt: parseDate(raw.date),
  };
}

function fromRss(node: Node): FeedItem | null {
  const guid = text(node.guid);
  const description = text(node.description);
  return toItem({
    title: text(node.title),
    url: text(node.link) || (isHttpUrl(guid) ? guid : ""),
    excerptHtml: description,
    bodyHtml: text(node["content:encoded"]) || description,
    date: text(node.pubDate) || text(node["dc:date"]),
    node,
  });
}

function fromAtom(node: Node): FeedItem | null {
  const links = asArray(node.link);
  const alternate = links.find((l) => ["", "alternate"].includes(attr(l, "rel"))) ?? links[0];
  const summary = text(node.summary);
  return toItem({
    title: text(node.title),
    url: attr(alternate, "href"),
    excerptHtml: summary,
    bodyHtml: text(node.content) || summary,
    date: text(node.published) || text(node.updated),
    node,
  });
}

/** Parse an RSS 2.0, RSS 1.0 (RDF) or Atom document into feed items. */
export function parseFeed(xml: string): FeedItem[] {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (error) {
    throw new FeedParseError(`Not well-formed XML: ${(error as Error).message}`);
  }

  const rss = doc.rss as Node | undefined;
  const rdf = doc["rdf:RDF"] as Node | undefined;
  const atom = doc.feed as Node | undefined;

  let nodes: unknown[];
  let read: (node: Node) => FeedItem | null;
  if (rss?.channel) {
    nodes = asArray((rss.channel as Node).item);
    read = fromRss;
  } else if (rdf) {
    nodes = asArray(rdf.item);
    read = fromRss;
  } else if (atom) {
    nodes = asArray(atom.entry);
    read = fromAtom;
  } else {
    throw new FeedParseError("Document is not an RSS or Atom feed");
  }

  return nodes
    .filter((n): n is Node => typeof n === "object" && n !== null)
    .map(read)
    .filter((i): i is FeedItem => i !== null);
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/news/parse-feed.test.ts`
Expected: all pass. Two likely failure points, and their fixes:
- The Atom title comes out as `Gemini &amp; friends`: the parser decoded `&amp;amp;` once and `cleanText` should decode the rest. If the value arrives as an object instead, log `doc.feed.entry[0].title` and adjust `text()`.
- The excerpt keeps a literal `&nbsp;` or a ` `: `\s` matches ` `, so the collapse step handles the character; a literal entity means the parser passed it through undecoded, which `NAMED_ENTITIES` covers.

- [ ] **Step 5: Commit**

```bash
git add src/lib/news/parse-feed.ts src/lib/news/parse-feed.test.ts
git commit -m "feat(news): parse RSS 2.0, RSS 1.0 and Atom feeds"
```

---

### Task 7: Ingest orchestration

**Files:**
- Create: `src/lib/news/ingest.ts`
- Test: `src/lib/news/ingest.test.ts`

`ingestAll` takes its storage as an `IngestStore` interface, so the tests run against an in-memory fake and never touch Supabase. The Supabase implementation comes in Task 9, after the RPCs exist.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/news/ingest.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  ingestAll,
  MAX_ITEMS_PER_SOURCE,
  selectRecent,
  type IngestSource,
  type IngestStore,
  type IngestStory,
} from "@/lib/news/ingest";
import type { FeedItem } from "@/lib/news/parse-feed";

const NOW = new Date("2026-09-19T12:00:00Z");

function rssWith(items: { title: string; link: string; date?: string }[]): string {
  const body = items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link>${
          i.date ? `<pubDate>${i.date}</pubDate>` : ""
        }<description>Details here</description></item>`,
    )
    .join("");
  return `<rss version="2.0"><channel><title>t</title>${body}</channel></rss>`;
}

function fakeStore(sources: IngestSource[], existingUrls: string[] = []) {
  const inserted: IngestStory[] = [];
  const touched: { id: string; error: string | null }[] = [];
  const seen = new Set(existingUrls);
  const store: IngestStore = {
    listSources: vi.fn(async () => sources),
    insertStory: vi.fn(async (story: IngestStory) => {
      if (seen.has(story.sourceUrl)) return false;
      seen.add(story.sourceUrl);
      inserted.push(story);
      return true;
    }),
    touchSource: vi.fn(async (id: string, error: string | null) => {
      touched.push({ id, error });
    }),
  };
  return { store, inserted, touched };
}

const tools = [{ slug: "cursor", name: "Cursor" }];

describe("selectRecent", () => {
  const item = (hoursAgo: number | null): FeedItem => ({
    title: "t",
    url: `https://x.com/${hoursAgo}`,
    excerpt: null,
    imageUrl: null,
    publishedAt: hoursAgo === null ? null : new Date(NOW.getTime() - hoursAgo * 3_600_000),
  });

  it("keeps items from the last 72 hours and undated items", () => {
    const kept = selectRecent([item(1), item(71), item(73), item(null)], NOW);
    expect(kept.map((i) => i.url)).toEqual(["https://x.com/1", "https://x.com/71", "https://x.com/null"]);
  });

  it("keeps at most 30 items per source", () => {
    const many = Array.from({ length: 50 }, () => item(1));
    expect(selectRecent(many, NOW)).toHaveLength(MAX_ITEMS_PER_SOURCE);
  });
});

describe("ingestAll", () => {
  const a = { id: "a", name: "Alpha", feedUrl: "https://alpha.test/feed" };
  const b = { id: "b", name: "Beta", feedUrl: "https://beta.test/feed" };

  it("inserts new items with matched tools and marks the source fetched", async () => {
    const { store, inserted, touched } = fakeStore([a]);
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () =>
        rssWith([{ title: "Cursor ships agents", link: "https://alpha.test/1", date: "Fri, 19 Sep 2026 09:00:00 GMT" }]),
    });

    expect(summary).toEqual({ sources: 1, fetched: 1, inserted: 1, failed: [] });
    expect(inserted[0]).toMatchObject({
      sourceId: "a",
      sourceUrl: "https://alpha.test/1",
      headline: "Cursor ships agents",
      excerpt: "Details here",
      sourcePublishedAt: "2026-09-19T09:00:00.000Z",
      toolSlugs: ["cursor"],
    });
    expect(touched).toEqual([{ id: "a", error: null }]);
  });

  it("counts duplicates as fetched but not inserted", async () => {
    const { store } = fakeStore([a], ["https://alpha.test/1"]);
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => rssWith([{ title: "Old", link: "https://alpha.test/1" }]),
    });
    expect(summary).toMatchObject({ fetched: 1, inserted: 0 });
  });

  it("keeps going when one source fails, and records the failure", async () => {
    const { store, inserted, touched } = fakeStore([a, b]);
    const report = vi.fn();
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      report,
      fetchFeed: async (url) => {
        if (url.includes("alpha")) throw new Error("Feed responded 500");
        return rssWith([{ title: "Beta story", link: "https://beta.test/1" }]);
      },
    });

    expect(summary).toEqual({ sources: 2, fetched: 1, inserted: 1, failed: ["Alpha"] });
    expect(inserted.map((s) => s.sourceId)).toEqual(["b"]);
    expect(touched).toContainEqual({ id: "a", error: "Feed responded 500" });
    expect(report).toHaveBeenCalledWith(expect.any(Error), a);
  });

  it("skips a single bad item without failing its source", async () => {
    const { store } = fakeStore([a]);
    let calls = 0;
    store.insertStory = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("check constraint");
      return true;
    });
    const report = vi.fn();
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      report,
      fetchFeed: async () =>
        rssWith([
          { title: "One", link: "https://alpha.test/1" },
          { title: "Two", link: "https://alpha.test/2" },
        ]),
    });
    expect(summary).toMatchObject({ fetched: 2, inserted: 1, failed: [] });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("propagates a failure to list sources", async () => {
    const { store } = fakeStore([]);
    store.listSources = vi.fn(async () => {
      throw new Error("not authorized");
    });
    await expect(ingestAll({ store, tools, now: NOW, fetchFeed: async () => "" })).rejects.toThrow(
      "not authorized",
    );
  });

  it("reports a source that fails to parse", async () => {
    const { store } = fakeStore([a]);
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => "<html>nope</html>",
    });
    expect(summary.failed).toEqual(["Alpha"]);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/news/ingest.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/news/ingest.ts
import { siteConfig } from "@/lib/site";
import { matchTools, type MatchableTool } from "@/lib/news/match-tools";
import { parseFeed, type FeedItem } from "@/lib/news/parse-feed";

export const INGEST_WINDOW_HOURS = 72;
export const MAX_ITEMS_PER_SOURCE = 30;
export const FEED_TIMEOUT_MS = 10_000;
const MAX_FEED_CHARS = 2_000_000;

export type IngestSource = { id: string; name: string; feedUrl: string };

export type IngestStory = {
  sourceId: string;
  sourceUrl: string;
  headline: string;
  excerpt: string | null;
  imageUrl: string | null;
  sourcePublishedAt: string | null;
  toolSlugs: string[];
};

/** Where ingestion reads sources from and writes stories to. */
export interface IngestStore {
  listSources(): Promise<IngestSource[]>;
  /** Resolves true for a new row, false for a duplicate. */
  insertStory(story: IngestStory): Promise<boolean>;
  touchSource(id: string, error: string | null): Promise<void>;
}

export type IngestDeps = {
  store: IngestStore;
  tools: readonly MatchableTool[];
  fetchFeed?: (url: string) => Promise<string>;
  now?: Date;
  report?: (error: unknown, source: IngestSource) => void;
};

export type IngestSummary = {
  sources: number;
  fetched: number;
  inserted: number;
  /** Names of sources that could not be fetched or parsed. */
  failed: string[];
};

export async function fetchFeedText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    cache: "no-store",
    headers: {
      "user-agent": `EnkiNewsBot/1.0 (+${siteConfig.url}/news/about)`,
      accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Feed responded ${response.status}`);
  const body = await response.text();
  if (body.length > MAX_FEED_CHARS) throw new Error("Feed is larger than 2 MB");
  return body;
}

/** Items from the ingest window, newest-first as the feed ordered them, capped per source. */
export function selectRecent(items: FeedItem[], now: Date): FeedItem[] {
  const cutoff = now.getTime() - INGEST_WINDOW_HOURS * 3_600_000;
  return items
    .filter((item) => item.publishedAt === null || item.publishedAt.getTime() >= cutoff)
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

function toStory(item: FeedItem, sourceId: string, tools: readonly MatchableTool[]): IngestStory {
  return {
    sourceId,
    sourceUrl: item.url,
    headline: item.title.slice(0, 300),
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    sourcePublishedAt: item.publishedAt?.toISOString() ?? null,
    toolSlugs: matchTools(`${item.title}\n${item.excerpt ?? ""}`, tools),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fetch every active source and queue its recent items as pending stories.
 *
 * One broken feed never fails the run: it is reported, recorded on the source,
 * and skipped. Only a failure to list sources (a bad secret, the database
 * down) rejects, because then nothing ran at all.
 */
export async function ingestAll({
  store,
  tools,
  fetchFeed = fetchFeedText,
  now = new Date(),
  report = () => {},
}: IngestDeps): Promise<IngestSummary> {
  const sources = await store.listSources();
  const summary: IngestSummary = { sources: sources.length, fetched: 0, inserted: 0, failed: [] };

  await Promise.all(
    sources.map(async (source) => {
      try {
        const items = selectRecent(parseFeed(await fetchFeed(source.feedUrl)), now);
        summary.fetched += items.length;
        for (const item of items) {
          try {
            if (await store.insertStory(toStory(item, source.id, tools))) summary.inserted += 1;
          } catch (error) {
            report(error, source);
          }
        }
        await store.touchSource(source.id, null);
      } catch (error) {
        summary.failed.push(source.name);
        report(error, source);
        await store.touchSource(source.id, message(error)).catch((touchError) => report(touchError, source));
      }
    }),
  );

  summary.failed.sort();
  return summary;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/news/ingest.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/news/ingest.ts src/lib/news/ingest.test.ts
git commit -m "feat(news): ingest feeds into the story queue"
```

---

### Task 8: Database migration

**Files:**
- Apply via the Supabase MCP connector (`apply_migration`), migration name `create_news_tables`. The repo keeps no SQL files; `handoff.md` §4 is the record (Task 16).

Follow `.claude/skills/enki-supabase-change`. The traps that apply here: Supabase grants new tables and functions to `anon` and `authenticated` by default, and `revoke ... from anon` on a function does nothing while `PUBLIC` still holds EXECUTE. Every object below revokes from `public, anon, authenticated` first and then grants exactly what it needs.

- [ ] **Step 1: Confirm the project is awake and Vault is installed**

Run: `pnpm doctor` (reports whether Supabase is awake). Then, via MCP `list_extensions`, confirm `supabase_vault` is installed. If it isn't, stop and ask the owner: Vault is how the ingest secret is stored.

- [ ] **Step 2: Apply the migration** (MCP `apply_migration`, name `create_news_tables`)

```sql
-- ── news_sources ────────────────────────────────────────────────────────────
create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  feed_url text not null unique check (feed_url ~ '^https?://'),
  site_url text not null check (site_url ~ '^https?://'),
  active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.news_sources enable row level security;
revoke all on public.news_sources from public, anon, authenticated;
grant select, insert, update on public.news_sources to authenticated;
create policy "admins read news sources" on public.news_sources
  for select to authenticated using (public.is_admin());
create policy "admins add news sources" on public.news_sources
  for insert to authenticated with check (public.is_admin());
create policy "admins update news sources" on public.news_sources
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── stories ─────────────────────────────────────────────────────────────────
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  source_id uuid not null references public.news_sources(id) on delete restrict,
  source_url text not null unique check (source_url ~ '^https?://'),
  headline text not null check (char_length(headline) between 1 and 300),
  summary text check (summary is null or char_length(summary) between 40 and 320),
  take text check (take is null or char_length(take) <= 5000),
  beat text check (beat is null or beat in (
    'models-labs', 'products-launches', 'funding-business', 'policy-safety', 'research')),
  image_url text check (image_url is null or image_url ~ '^https://'),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  featured boolean not null default false,
  source_published_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint published_story_is_complete check (
    status <> 'published'
    or (slug is not null and summary is not null and beat is not null and published_at is not null)
  )
);
create index stories_status_created_at_idx on public.stories (status, created_at desc);
create index stories_status_published_at_idx on public.stories (status, published_at desc);
alter table public.stories enable row level security;
revoke all on public.stories from public, anon, authenticated;
-- Read-only for every API role. Writes happen only inside the RPCs below.
grant select on public.stories to anon, authenticated;
create policy "published stories are public" on public.stories
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

-- ── story_excerpts (publisher text: admin reference only, never public) ─────
create table public.story_excerpts (
  story_id uuid primary key references public.stories(id) on delete cascade,
  excerpt text not null check (char_length(excerpt) <= 4000)
);
alter table public.story_excerpts enable row level security;
revoke all on public.story_excerpts from public, anon, authenticated;
grant select on public.story_excerpts to authenticated;
create policy "admins read excerpts" on public.story_excerpts
  for select to authenticated using (public.is_admin());

-- ── story_tools ─────────────────────────────────────────────────────────────
create table public.story_tools (
  story_id uuid not null references public.stories(id) on delete cascade,
  tool_slug text not null check (tool_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position smallint not null default 0,
  primary key (story_id, tool_slug)
);
alter table public.story_tools enable row level security;
revoke all on public.story_tools from public, anon, authenticated;
grant select on public.story_tools to anon, authenticated;
-- Readable exactly when the parent story is: the subquery runs under the
-- caller's own RLS on stories, so a pending story's tools stay hidden.
create policy "story tools follow their story" on public.story_tools
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = story_id));

-- ── ingest secret check (internal) ──────────────────────────────────────────
create or replace function public.news_ingest_authorized(secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(length(secret) >= 32, false)
     and exists (
       select 1 from vault.decrypted_secrets d
        where d.name = 'news_ingest_secret' and d.decrypted_secret = secret
     );
$$;
revoke all on function public.news_ingest_authorized(text) from public, anon, authenticated;

-- ── ingest_sources ──────────────────────────────────────────────────────────
create or replace function public.ingest_sources(secret text)
returns table (id uuid, name text, feed_url text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.news_ingest_authorized(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, s.feed_url from public.news_sources s
     where s.active order by s.name;
end;
$$;

-- ── ingest_story ────────────────────────────────────────────────────────────
create or replace function public.ingest_story(
  secret text,
  p_source_id uuid,
  p_source_url text,
  p_headline text,
  p_excerpt text,
  p_image_url text,
  p_source_published_at timestamptz,
  p_tool_slugs text[]
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.news_ingest_authorized(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.stories (source_id, source_url, headline, image_url, source_published_at)
  values (
    p_source_id,
    p_source_url,
    left(btrim(p_headline), 300),
    case when p_image_url ~ '^https://' then left(p_image_url, 2000) end,
    p_source_published_at
  )
  on conflict (source_url) do nothing
  returning id into v_id;

  if v_id is null then
    return false; -- already queued, published or rejected
  end if;

  if nullif(btrim(coalesce(p_excerpt, '')), '') is not null then
    insert into public.story_excerpts (story_id, excerpt)
    values (v_id, left(btrim(p_excerpt), 4000));
  end if;

  insert into public.story_tools (story_id, tool_slug, position)
  select v_id, t.slug, (t.ord - 1)::smallint
    from unnest(coalesce(p_tool_slugs, '{}'::text[])) with ordinality as t(slug, ord)
   where t.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
   order by t.ord
   limit 5
  on conflict do nothing;

  return true;
end;
$$;

-- ── touch_news_source ───────────────────────────────────────────────────────
create or replace function public.touch_news_source(secret text, p_source_id uuid, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.news_ingest_authorized(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.news_sources
     set last_fetched_at = now(), last_error = left(p_error, 500)
   where id = p_source_id;
end;
$$;

revoke all on function public.ingest_sources(text) from public, anon, authenticated;
revoke all on function public.ingest_story(text, uuid, text, text, text, text, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.touch_news_source(text, uuid, text) from public, anon, authenticated;
grant execute on function public.ingest_sources(text) to anon, authenticated;
grant execute on function public.ingest_story(text, uuid, text, text, text, text, timestamptz, text[]) to anon, authenticated;
grant execute on function public.touch_news_source(text, uuid, text) to anon, authenticated;

-- ── admin_publish_story ─────────────────────────────────────────────────────
create or replace function public.admin_publish_story(
  p_story_id uuid,
  p_slug text,
  p_headline text,
  p_summary text,
  p_take text,
  p_beat text,
  p_featured boolean,
  p_tool_slugs text[]
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_slug text;
begin
  if not public.is_admin() then
    return null;
  end if;

  update public.stories
     set headline = btrim(p_headline),
         summary = btrim(p_summary),
         take = nullif(btrim(coalesce(p_take, '')), ''),
         beat = p_beat,
         featured = coalesce(p_featured, false),
         -- A slug and publish time are set once and never change, so a
         -- shared link keeps working through later edits.
         slug = coalesce(slug, p_slug),
         published_at = coalesce(published_at, now()),
         status = 'published'
   where id = p_story_id and status in ('pending', 'published')
  returning slug into v_slug;

  if v_slug is null then
    return null;
  end if;

  delete from public.story_tools where story_id = p_story_id;
  insert into public.story_tools (story_id, tool_slug, position)
  select p_story_id, t.slug, (t.ord - 1)::smallint
    from unnest(coalesce(p_tool_slugs, '{}'::text[])) with ordinality as t(slug, ord)
   where t.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
   order by t.ord
   limit 5
  on conflict do nothing;

  return v_slug;
end;
$$;

-- ── admin_set_story_status ──────────────────────────────────────────────────
create or replace function public.admin_set_story_status(p_story_id uuid, p_status text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  if p_status = 'rejected' then
    update public.stories set status = 'rejected'
     where id = p_story_id and status = 'pending';
  elsif p_status = 'pending' then
    -- Unpublish. Slug and published_at are kept for a later re-publish.
    update public.stories set status = 'pending', featured = false
     where id = p_story_id and status = 'published';
  else
    return false;
  end if;
  return found;
end;
$$;

revoke all on function public.admin_publish_story(uuid, text, text, text, text, text, boolean, text[]) from public, anon, authenticated;
revoke all on function public.admin_set_story_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_publish_story(uuid, text, text, text, text, text, boolean, text[]) to authenticated;
grant execute on function public.admin_set_story_status(uuid, text) to authenticated;
```

- [ ] **Step 3: Verify the grants** (MCP `execute_sql`)

```sql
select proname, proacl::text
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('news_ingest_authorized', 'ingest_sources', 'ingest_story',
                   'touch_news_source', 'admin_publish_story', 'admin_set_story_status')
 order by proname;
```

Expected: no `proacl` contains an entry starting `=X/` (that is the PUBLIC grant). `news_ingest_authorized` lists only `postgres` (and possibly `service_role`); the two admin RPCs list `authenticated` but not `anon`.

```sql
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('news_sources', 'stories', 'story_excerpts', 'story_tools')
   and grantee in ('anon', 'authenticated')
 group by 1, 2 order by 1, 2;
```

Expected exactly:

| table_name | grantee | privs |
|---|---|---|
| news_sources | authenticated | INSERT,SELECT,UPDATE |
| stories | anon | SELECT |
| stories | authenticated | SELECT |
| story_excerpts | authenticated | SELECT |
| story_tools | anon | SELECT |
| story_tools | authenticated | SELECT |

- [ ] **Step 4: Verify anon behaviour** (MCP `execute_sql`, each block on its own)

```sql
begin;
set local role anon;
select public.ingest_sources('wrong-secret-wrong-secret-wrong-secret-00');
rollback;
```
Expected: ERROR `not authorized` (42501).

```sql
begin;
set local role anon;
select public.admin_publish_story(gen_random_uuid(), 'x-abcdef', 'h', 'x', null, 'research', false, '{}');
rollback;
```
Expected: ERROR `permission denied for function admin_publish_story`.

- [ ] **Step 5: Seed starter sources**

Check each candidate feed actually serves XML before inserting it:

```bash
for u in https://openai.com/news/rss.xml https://deepmind.google/blog/rss.xml https://huggingface.co/blog/feed.xml https://techcrunch.com/category/artificial-intelligence/feed/ https://www.theverge.com/rss/ai-artificial-intelligence/index.xml https://venturebeat.com/category/ai/feed/ https://www.technologyreview.com/topic/artificial-intelligence/feed https://arstechnica.com/ai/feed/; do printf '%s ' "$u"; curl -s -L -m 10 -A "EnkiNewsBot/1.0" "$u" | head -c 300 | grep -qiE '<(rss|feed|rdf:RDF)' && echo OK || echo FAIL; done
```

Then insert only the `OK` ones (MCP `execute_sql`; this runs as `postgres`, so RLS doesn't block it). Delete any row below whose feed printed `FAIL`:

```sql
insert into public.news_sources (name, feed_url, site_url) values
  ('OpenAI', 'https://openai.com/news/rss.xml', 'https://openai.com'),
  ('Google DeepMind', 'https://deepmind.google/blog/rss.xml', 'https://deepmind.google'),
  ('Hugging Face', 'https://huggingface.co/blog/feed.xml', 'https://huggingface.co'),
  ('TechCrunch', 'https://techcrunch.com/category/artificial-intelligence/feed/', 'https://techcrunch.com'),
  ('The Verge', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'https://www.theverge.com'),
  ('VentureBeat', 'https://venturebeat.com/category/ai/feed/', 'https://venturebeat.com'),
  ('MIT Technology Review', 'https://www.technologyreview.com/topic/artificial-intelligence/feed', 'https://www.technologyreview.com'),
  ('Ars Technica', 'https://arstechnica.com/ai/feed/', 'https://arstechnica.com')
on conflict (feed_url) do nothing;
```

Anthropic and Meta AI publish no official feed, so they are left out; the owner can add third-party feeds later from `/admin/news/sources`.

- [ ] **Step 6: Run the Supabase advisors**

Run MCP `get_advisors` (type `security`). Expected: no new warnings naming `news_sources`, `stories`, `story_excerpts`, `story_tools` or the six functions. A "function search_path mutable" warning means a function above lost its `set search_path = ''`.

Nothing to commit in this task.

---

### Task 9: Database types and the Supabase ingest store

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Create: `src/lib/news/ingest-store.ts`
- Test: `src/lib/news/ingest-store.test.ts`

- [ ] **Step 1: Add the tables** to `database.types.ts`, inside `public.Tables`, directly after the `outbound_clicks` entry:

```ts
      news_sources: {
        Row: {
          id: string
          name: string
          feed_url: string
          site_url: string
          active: boolean
          last_fetched_at: string | null
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          feed_url: string
          site_url: string
          active?: boolean
          last_fetched_at?: string | null
          last_error?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          feed_url?: string
          site_url?: string
          active?: boolean
        }
        Relationships: []
      }
      /** Read-only over the API. Written only by the ingest and admin RPCs. */
      stories: {
        Row: {
          id: string
          slug: string | null
          source_id: string
          source_url: string
          headline: string
          summary: string | null
          take: string | null
          beat: string | null
          image_url: string | null
          status: string
          featured: boolean
          source_published_at: string | null
          published_at: string | null
          created_at: string
        }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: []
      }
      /** Publisher text. Admin-only by RLS; never rendered publicly. */
      story_excerpts: {
        Row: { story_id: string; excerpt: string }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: []
      }
      story_tools: {
        Row: { story_id: string; tool_slug: string; position: number }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: []
      }
```

- [ ] **Step 2: Add the RPCs** inside `public.Functions`, after `admin_set_review_status`:

```ts
      /** Secret-gated. Raises 42501 on a wrong secret. */
      ingest_sources: {
        Args: { secret: string }
        Returns: { id: string; name: string; feed_url: string }[]
      }
      /** Secret-gated. False when the URL is already known. */
      ingest_story: {
        Args: {
          secret: string
          p_source_id: string
          p_source_url: string
          p_headline: string
          p_excerpt: string | null
          p_image_url: string | null
          p_source_published_at: string | null
          p_tool_slugs: string[]
        }
        Returns: boolean
      }
      touch_news_source: {
        Args: { secret: string; p_source_id: string; p_error: string | null }
        Returns: undefined
      }
      /** Admin-only. Returns the story's slug, or null if not admin / not found. */
      admin_publish_story: {
        Args: {
          p_story_id: string
          p_slug: string
          p_headline: string
          p_summary: string
          p_take: string | null
          p_beat: string
          p_featured: boolean
          p_tool_slugs: string[]
        }
        Returns: string | null
      }
      /** Admin-only. 'rejected' from pending, or 'pending' to unpublish. */
      admin_set_story_status: {
        Args: { p_story_id: string; p_status: string }
        Returns: boolean
      }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Write the failing store test**

```ts
// src/lib/news/ingest-store.test.ts
import { describe, it, expect, vi } from "vitest";
import { createSupabaseIngestStore } from "@/lib/news/ingest-store";

function client(result: { data?: unknown; error?: unknown }) {
  return { rpc: vi.fn(async () => ({ data: null, error: null, ...result })) };
}

const story = {
  sourceId: "s-1",
  sourceUrl: "https://a.test/1",
  headline: "H",
  excerpt: null,
  imageUrl: null,
  sourcePublishedAt: null,
  toolSlugs: ["cursor"],
};

describe("createSupabaseIngestStore", () => {
  it("maps source rows and passes the secret", async () => {
    const c = client({ data: [{ id: "s-1", name: "A", feed_url: "https://a.test/feed" }] });
    const store = createSupabaseIngestStore(c as never, "secret-value");
    await expect(store.listSources()).resolves.toEqual([
      { id: "s-1", name: "A", feedUrl: "https://a.test/feed" },
    ]);
    expect(c.rpc).toHaveBeenCalledWith("ingest_sources", { secret: "secret-value" });
  });

  it("maps a story onto ingest_story's arguments", async () => {
    const c = client({ data: true });
    await expect(createSupabaseIngestStore(c as never, "k").insertStory(story)).resolves.toBe(true);
    expect(c.rpc).toHaveBeenCalledWith("ingest_story", {
      secret: "k",
      p_source_id: "s-1",
      p_source_url: "https://a.test/1",
      p_headline: "H",
      p_excerpt: null,
      p_image_url: null,
      p_source_published_at: null,
      p_tool_slugs: ["cursor"],
    });
  });

  it("reports a duplicate as false", async () => {
    const c = client({ data: false });
    await expect(createSupabaseIngestStore(c as never, "k").insertStory(story)).resolves.toBe(false);
  });

  it("throws on an RPC error so the caller can report it", async () => {
    const c = client({ error: { message: "not authorized" } });
    await expect(createSupabaseIngestStore(c as never, "k").listSources()).rejects.toThrow(
      "not authorized",
    );
  });
});
```

- [ ] **Step 5: Run and watch it fail**

Run: `pnpm vitest run src/lib/news/ingest-store.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 6: Implement**

```ts
// src/lib/news/ingest-store.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { IngestStore } from "@/lib/news/ingest";

/**
 * IngestStore over the secret-gated ingest RPCs. Used with the anon client:
 * the secret, not a privileged key, is what authorises the writes, and the
 * RPCs can only ever create *pending* stories.
 */
export function createSupabaseIngestStore(
  client: SupabaseClient<Database>,
  secret: string,
): IngestStore {
  return {
    async listSources() {
      const { data, error } = await client.rpc("ingest_sources", { secret });
      if (error) throw new Error(`ingest_sources failed: ${error.message}`);
      return (data ?? []).map((s) => ({ id: s.id, name: s.name, feedUrl: s.feed_url }));
    },
    async insertStory(story) {
      const { data, error } = await client.rpc("ingest_story", {
        secret,
        p_source_id: story.sourceId,
        p_source_url: story.sourceUrl,
        p_headline: story.headline,
        p_excerpt: story.excerpt,
        p_image_url: story.imageUrl,
        p_source_published_at: story.sourcePublishedAt,
        p_tool_slugs: story.toolSlugs,
      });
      if (error) throw new Error(`ingest_story failed: ${error.message}`);
      return data === true;
    },
    async touchSource(id, lastError) {
      const { error } = await client.rpc("touch_news_source", {
        secret,
        p_source_id: id,
        p_error: lastError,
      });
      if (error) throw new Error(`touch_news_source failed: ${error.message}`);
    },
  };
}
```

- [ ] **Step 7: Run the test and typecheck**

Run: `pnpm vitest run src/lib/news/ingest-store.test.ts && pnpm typecheck`
Expected: 4 passed, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase/database.types.ts src/lib/news/ingest-store.ts src/lib/news/ingest-store.test.ts
git commit -m "feat(news): types for the news tables and a Supabase ingest store"
```

---

### Task 10: `runNewsIngest` and the cron route

**Files:**
- Create: `src/lib/news/run-ingest.ts`, `src/app/api/ingest-news/route.ts`
- Test: `src/app/api/ingest-news/route.test.ts`
- Modify: `vercel.json`, `.env.example`

- [ ] **Step 1: Implement `runNewsIngest`** (thin wiring; its parts are tested in Tasks 7 and 9)

```ts
// src/lib/news/run-ingest.ts
import * as Sentry from "@sentry/nextjs";
import { getAllTools } from "@/lib/content";
import { createAnonClient } from "@/lib/supabase/anon";
import { ingestAll, type IngestSummary } from "@/lib/news/ingest";
import { createSupabaseIngestStore } from "@/lib/news/ingest-store";

/** One ingestion run, shared by the daily cron and the admin "Fetch now" button. */
export async function runNewsIngest(): Promise<IngestSummary> {
  const secret = process.env.NEWS_INGEST_SECRET;
  if (!secret) throw new Error("NEWS_INGEST_SECRET is not set");

  const tools = await getAllTools();
  return ingestAll({
    store: createSupabaseIngestStore(createAnonClient(), secret),
    tools: tools.map(({ slug, name, aliases }) => ({ slug, name, aliases })),
    report: (error, source) =>
      Sentry.captureException(error, { tags: { news_source: source.name } }),
  });
}
```

- [ ] **Step 2: Write the failing route test**

```ts
// @vitest-environment node
// src/app/api/ingest-news/route.test.ts
// The directive must be the first line: the route uses NextRequest/Response,
// which the project's default jsdom environment doesn't provide faithfully.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const runNewsIngest = vi.fn();
vi.mock("@/lib/news/run-ingest", () => ({ runNewsIngest: () => runNewsIngest() }));

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  withMonitor: (_slug: string, callback: () => unknown) => callback(),
  captureException: (...args: unknown[]) => captureException(...args),
  flush: async () => true,
}));

const { GET } = await import("@/app/api/ingest-news/route");

function request(auth?: string) {
  return new NextRequest("http://localhost/api/ingest-news", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/ingest-news", () => {
  it("refuses a request without the cron secret", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(runNewsIngest).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request("Bearer "));
    expect(res.status).toBe(401);
    expect(runNewsIngest).not.toHaveBeenCalled();
  });

  it("runs ingestion and returns the summary", async () => {
    runNewsIngest.mockResolvedValue({ sources: 2, fetched: 5, inserted: 3, failed: ["Beta"] });
    const res = await GET(request("Bearer cron-secret"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      sources: 2,
      fetched: 5,
      inserted: 3,
      failed: ["Beta"],
    });
  });

  it("returns 503 when every source failed", async () => {
    runNewsIngest.mockResolvedValue({ sources: 2, fetched: 0, inserted: 0, failed: ["A", "B"] });
    const res = await GET(request("Bearer cron-secret"));
    expect(res.status).toBe(503);
    expect(captureException).toHaveBeenCalled();
  });

  it("returns 503 when ingestion throws", async () => {
    runNewsIngest.mockRejectedValue(new Error("not authorized"));
    const res = await GET(request("Bearer cron-secret"));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `pnpm vitest run src/app/api/ingest-news/route.test.ts`
Expected: FAIL, route module not found.

- [ ] **Step 4: Implement the route**

```ts
// src/app/api/ingest-news/route.ts
import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { runNewsIngest } from "@/lib/news/run-ingest";

/**
 * Daily news ingestion, driven by a Vercel Cron (see vercel.json).
 *
 * Unlike keep-warm, this fails closed when CRON_SECRET is unset: each run
 * makes outbound requests to every feed, so it must not be a public trigger.
 *
 * Wrapped in a Sentry check-in for the same reason as keep-warm: a job that
 * stops running is silent from the outside.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Must match vercel.json's cron entry, or Sentry reports phantom misses. */
const MONITOR_SLUG = "ingest-news";
const MONITOR_CONFIG = {
  schedule: { type: "crontab", value: "0 5 * * *" },
  maxRuntime: 2,
  // Hobby-plan crons may fire any time within the scheduled hour.
  checkinMargin: 60,
  timezone: "Etc/UTC",
} as const;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await Sentry.withMonitor(
      MONITOR_SLUG,
      async () => {
        const result = await runNewsIngest();
        // Thrown, not returned: withMonitor marks the check-in failed only
        // when the callback throws.
        if (result.sources > 0 && result.failed.length === result.sources) {
          throw new Error(`every news source failed: ${result.failed.join(", ")}`);
        }
        return result;
      },
      MONITOR_CONFIG,
    );
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[enki] ingest-news failed", error);
    Sentry.captureException(error);
    return NextResponse.json({ ok: false }, { status: 503 });
  } finally {
    // See keep-warm: a frozen function would otherwise drop the check-in.
    await Sentry.flush(2000);
  }
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run src/app/api/ingest-news/route.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Register the cron** in `vercel.json`. The `crons` array becomes:

```json
  "crons": [
    {
      "path": "/api/keep-warm",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/ingest-news",
      "schedule": "0 5 * * *"
    }
  ]
```

- [ ] **Step 7: Add the env contract** to the end of `.env.example`:

```
# News ingestion. A random string of at least 32 characters, shared with the
# Supabase Vault secret `news_ingest_secret`. It lets the ingest RPCs queue
# *pending* stories and nothing else; publishing always needs an admin.
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEWS_INGEST_SECRET=replace-with-64-hex-characters

# Vercel Cron signs its requests with this. Only needed locally to call
# /api/ingest-news by hand; set it in Vercel for the real cron.
# CRON_SECRET=replace-with-a-random-string
```

`NEWS_INGEST_SECRET` is uncommented on purpose: `pnpm doctor` treats uncommented keys as required, so a machine without it is told so.

- [ ] **Step 8: Commit**

```bash
git add src/lib/news/run-ingest.ts src/app/api/ingest-news vercel.json .env.example
git commit -m "feat(news): daily ingest cron with a Sentry monitor"
```

---

### Task 11: Extend the RLS audit

**Files:**
- Modify: `scripts/audit-rls/expectations.mjs`, `scripts/audit-rls/expectations.test.mjs`, `scripts/audit-rls.mjs`

Two new probe kinds. **Query probes** run a filtered read that must return zero rows; unlike the table probes, a 4xx counts as a *failure*, because it means the probe itself broke and would otherwise pass forever. **RPC probes** call a function with a wrong secret or as anon and must be refused.

- [ ] **Step 1: Write the failing tests.** In `expectations.test.mjs`, update the import line and the first test, then append the new tests:

```js
import {
  ANON_INVISIBLE_QUERIES,
  ANON_INVISIBLE_TABLES,
  ANON_REFUSED_RPCS,
  judge,
  judgeQuery,
  judgeRpc,
} from "./expectations.mjs";

describe("ANON_INVISIBLE_TABLES", () => {
  it("covers every table holding private or operational data", () => {
    expect(ANON_INVISIBLE_TABLES).toEqual([
      "admins",
      "collections",
      "news_sources",
      "outbound_clicks",
      "profiles",
      "reviews",
      "story_excerpts",
      "subscribers",
      "tool_submissions",
    ]);
  });
});
```

```js
describe("query probes", () => {
  it("probe unpublished stories and their tools", () => {
    expect(ANON_INVISIBLE_QUERIES.map((q) => q.label)).toEqual([
      "stories (unpublished)",
      "story_tools (unpublished)",
    ]);
  });

  it("pass on an empty 200", () => {
    expect(judgeQuery("q", { status: 200, rows: [] }).ok).toBe(true);
  });

  it("fail when rows leak", () => {
    expect(judgeQuery("q", { status: 200, rows: [{ id: 1 }] }).ok).toBe(false);
  });

  it("fail when the probe itself errors, so a broken probe cannot pass silently", () => {
    const verdict = judgeQuery("q", { status: 400, rows: null });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("400");
  });
});

describe("rpc probes", () => {
  it("cover the ingest and admin news functions", () => {
    expect(ANON_REFUSED_RPCS.map((r) => r.fn)).toEqual([
      "ingest_sources",
      "ingest_story",
      "touch_news_source",
      "admin_publish_story",
      "admin_set_story_status",
    ]);
  });

  it("pass when the call is refused", () => {
    expect(judgeRpc("f", { status: 401, body: null }).ok).toBe(true);
    expect(judgeRpc("f", { status: 403, body: null }).ok).toBe(true);
  });

  it("fail when the call succeeds", () => {
    expect(judgeRpc("f", { status: 200, body: true }).ok).toBe(false);
    expect(judgeRpc("f", { status: 200, body: [] }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run scripts/audit-rls`
Expected: FAIL on the new imports.

- [ ] **Step 3: Implement.** In `expectations.mjs`, replace the `ANON_INVISIBLE_TABLES` array with the list from the test above, and append:

```js
/**
 * Filtered reads that must come back empty. `stories` and `story_tools` are
 * anon-readable for *published* rows, so the table probe cannot cover them;
 * these ask specifically for what must stay hidden.
 */
export const ANON_INVISIBLE_QUERIES = [
  {
    label: "stories (unpublished)",
    path: "stories?select=id&status=neq.published&limit=5",
  },
  {
    label: "story_tools (unpublished)",
    path: "story_tools?select=story_id,stories!inner(status)&stories.status=neq.published&limit=5",
  },
];

const WRONG_SECRET = "audit-probe-wrong-secret-000000000000000";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Functions an anonymous caller must not be able to use. */
export const ANON_REFUSED_RPCS = [
  { fn: "ingest_sources", body: { secret: WRONG_SECRET } },
  {
    fn: "ingest_story",
    body: {
      secret: WRONG_SECRET,
      p_source_id: NIL_UUID,
      p_source_url: "https://audit.invalid/probe",
      p_headline: "audit probe",
      p_excerpt: null,
      p_image_url: null,
      p_source_published_at: null,
      p_tool_slugs: [],
    },
  },
  { fn: "touch_news_source", body: { secret: WRONG_SECRET, p_source_id: NIL_UUID, p_error: null } },
  {
    fn: "admin_publish_story",
    body: {
      p_story_id: NIL_UUID,
      p_slug: "audit-probe",
      p_headline: "audit probe",
      p_summary: "x".repeat(40),
      p_take: null,
      p_beat: "research",
      p_featured: false,
      p_tool_slugs: [],
    },
  },
  { fn: "admin_set_story_status", body: { p_story_id: NIL_UUID, p_status: "rejected" } },
];

/** @param {string} label @param {{status: number, rows: unknown[] | null}} response */
export function judgeQuery(label, response) {
  if (response.status !== 200 || response.rows === null) {
    return { table: label, ok: false, detail: `probe errored (${response.status}); fix the probe` };
  }
  if (response.rows.length === 0) return { table: label, ok: true, detail: "no rows" };
  return { table: label, ok: false, detail: `LEAKED ${response.rows.length} row(s) to anon` };
}

/** @param {string} fn @param {{status: number, body: unknown}} response */
export function judgeRpc(fn, response) {
  if (response.status >= 400) {
    return { table: `rpc ${fn}`, ok: true, detail: `refused (${response.status})` };
  }
  return { table: `rpc ${fn}`, ok: false, detail: `ACCEPTED an anonymous call (${response.status})` };
}
```

- [ ] **Step 4: Wire the probes into `scripts/audit-rls.mjs`.** Change the import to:

```js
import {
  ANON_INVISIBLE_QUERIES,
  ANON_INVISIBLE_TABLES,
  ANON_REFUSED_RPCS,
  judge,
  judgeQuery,
  judgeRpc,
} from "./audit-rls/expectations.mjs";
```

and insert this block directly after the existing `for (const table of ANON_INVISIBLE_TABLES) { ... }` loop:

```js
for (const query of ANON_INVISIBLE_QUERIES) {
  let response = { status: 0, rows: null };
  try {
    const res = await fetch(`${url}/rest/v1/${query.path}`, { headers: { apikey: key } });
    const rows = res.ok ? await res.json() : null;
    response = { status: res.status, rows: Array.isArray(rows) ? rows : null };
  } catch (error) {
    console.error(`  could not reach ${query.label}: ${error.message}`);
    process.exit(1);
  }
  verdicts.push(judgeQuery(query.label, response));
}

for (const rpc of ANON_REFUSED_RPCS) {
  let response = { status: 0, body: null };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${rpc.fn}`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify(rpc.body),
    });
    response = { status: res.status, body: await res.json().catch(() => null) };
  } catch (error) {
    console.error(`  could not reach rpc ${rpc.fn}: ${error.message}`);
    process.exit(1);
  }
  verdicts.push(judgeRpc(rpc.fn, response));
}
```

Also widen the report column so the longer labels line up: change `v.table.padEnd(18)` to `v.table.padEnd(28)`, and change the failure summary line to `` `\n${failed.length} check(s) failed.\n` ``.

- [ ] **Step 5: Run the unit tests, then the live audit**

Run: `pnpm vitest run scripts/audit-rls && pnpm audit:rls`
Expected: tests pass; every live line reads PASS, ending `RLS holds.` The five RPC lines read `refused (4xx)`; the wrong-secret ones come back as `400` or `403` from PostgREST (a raised 42501 maps to 403), the admin ones as `401`/`404` (no EXECUTE for anon).

- [ ] **Step 6: Commit**

```bash
git add scripts/audit-rls.mjs scripts/audit-rls
git commit -m "test(rls): prove anon cannot read queued stories or call ingest RPCs"
```

---

### Task 12: Admin server actions

**Files:**
- Create: `src/app/admin/news/actions.ts`
- Test: `src/app/admin/news/actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/admin/news/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseStub } from "@/test/supabase-stub";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const runNewsIngest = vi.fn();
vi.mock("@/lib/news/run-ingest", () => ({ runNewsIngest: () => runNewsIngest() }));

const { publishStory, setStoryStatus, fetchNewsNow, addNewsSource, setNewsSourceActive } =
  await import("@/app/admin/news/actions");

const ID = "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b";
const valid = {
  id: ID,
  headline: "OpenAI ships GPT-6",
  summary: "A summary that is comfortably over forty characters long.",
  beat: "models-labs",
  featured: true,
  toolSlugs: ["cursor"],
};

beforeEach(() => vi.clearAllMocks());

describe("publishStory", () => {
  it("refuses a non-admin and revalidates nothing", async () => {
    const stub = supabaseStub({ isAdmin: false });
    createClient.mockReturnValue(stub);
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_publish_story", expect.anything());
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    const stub = supabaseStub({ isAdmin: true });
    createClient.mockReturnValue(stub);
    const res = await publishStory({ ...valid, summary: "too short" });
    expect(res.ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_publish_story", expect.anything());
  });

  it("publishes through the guarded RPC with a generated slug", async () => {
    const stub = supabaseStub({
      isAdmin: true,
      rpc: { admin_publish_story: { data: "openai-ships-gpt-6-3f2a9c", error: null } },
    });
    createClient.mockReturnValue(stub);

    const res = await publishStory({ ...valid, take: "   " });

    expect(res).toEqual({ ok: true, slug: "openai-ships-gpt-6-3f2a9c" });
    expect(stub.rpc).toHaveBeenCalledWith("admin_publish_story", {
      p_story_id: ID,
      p_slug: "openai-ships-gpt-6-3f2a9c",
      p_headline: "OpenAI ships GPT-6",
      p_summary: valid.summary,
      p_take: null,
      p_beat: "models-labs",
      p_featured: true,
      p_tool_slugs: ["cursor"],
    });
    expect(stub.from).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
  });

  it("reports a story that left the queue", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_publish_story: { data: null, error: null } } }),
    );
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not leak raw database errors", async () => {
    createClient.mockReturnValue(
      supabaseStub({
        isAdmin: true,
        rpc: { admin_publish_story: { data: null, error: { message: 'violates check constraint "stories_beat_check"' } } },
      }),
    );
    const res = await publishStory(valid);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("constraint");
  });
});

describe("setStoryStatus", () => {
  it("rejects a status outside the whitelist", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    // @ts-expect-error deliberately invalid
    expect((await setStoryStatus(ID, "published")).ok).toBe(false);
  });

  it("writes through the guarded RPC", async () => {
    const stub = supabaseStub({
      isAdmin: true,
      rpc: { admin_set_story_status: { data: true, error: null } },
    });
    createClient.mockReturnValue(stub);
    expect((await setStoryStatus(ID, "rejected")).ok).toBe(true);
    expect(stub.rpc).toHaveBeenCalledWith("admin_set_story_status", {
      p_story_id: ID,
      p_status: "rejected",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
  });

  it("reports a miss", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_set_story_status: { data: false, error: null } } }),
    );
    expect((await setStoryStatus(ID, "rejected")).ok).toBe(false);
  });
});

describe("fetchNewsNow", () => {
  it("refuses a non-admin without fetching anything", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    expect((await fetchNewsNow()).ok).toBe(false);
    expect(runNewsIngest).not.toHaveBeenCalled();
  });

  it("returns the run summary", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    const summary = { sources: 3, fetched: 20, inserted: 7, failed: [] };
    runNewsIngest.mockResolvedValue(summary);
    expect(await fetchNewsNow()).toEqual({ ok: true, summary });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
  });

  it("turns a failed run into a friendly error", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    runNewsIngest.mockRejectedValue(new Error("ingest_sources failed: not authorized"));
    const res = await fetchNewsNow();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("ingest_sources");
  });
});

describe("addNewsSource", () => {
  const source = { name: "Ars Technica", feedUrl: "https://arstechnica.com/ai/feed/", siteUrl: "https://arstechnica.com" };

  it("rejects a non-http feed URL", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true }));
    expect((await addNewsSource({ ...source, feedUrl: "ftp://x" })).ok).toBe(false);
  });

  it("treats a duplicate feed as a friendly error", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, table: { data: null, error: { code: "23505" } } }),
    );
    const res = await addNewsSource(source);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("already");
  });

  it("inserts and revalidates the sources page", async () => {
    const stub = supabaseStub({ isAdmin: true, table: { data: [{ id: "s-1" }], error: null } });
    createClient.mockReturnValue(stub);
    expect((await addNewsSource(source)).ok).toBe(true);
    expect(stub.builder.insert).toHaveBeenCalledWith({
      name: "Ars Technica",
      feed_url: "https://arstechnica.com/ai/feed/",
      site_url: "https://arstechnica.com",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news/sources");
  });
});

describe("setNewsSourceActive", () => {
  it("refuses a non-admin", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: false }));
    expect((await setNewsSourceActive("s-1", false)).ok).toBe(false);
  });

  it("reports a miss when no row matched", async () => {
    createClient.mockReturnValue(supabaseStub({ isAdmin: true, table: { data: [], error: null } }));
    expect((await setNewsSourceActive("s-1", false)).ok).toBe(false);
  });

  it("updates and revalidates", async () => {
    const stub = supabaseStub({ isAdmin: true, table: { data: [{ id: "s-1" }], error: null } });
    createClient.mockReturnValue(stub);
    expect((await setNewsSourceActive("s-1", false)).ok).toBe(true);
    expect(stub.builder.update).toHaveBeenCalledWith({ active: false });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/app/admin/news/actions.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/app/admin/news/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { runNewsIngest } from "@/lib/news/run-ingest";
import type { IngestSummary } from "@/lib/news/ingest";
import { makeStorySlug } from "@/lib/news/slug";
import {
  newsSourceInputSchema,
  storyPublishSchema,
  type NewsSourceInput,
  type StoryPublishInput,
} from "@/lib/news/schemas";

type Fail = { ok: false; error: string };

/**
 * Every action here calls assertAdmin() itself: server actions are public POST
 * endpoints, and RLS alone cannot stop a caller triggering their side effects.
 */

export async function publishStory(
  input: StoryPublishInput,
): Promise<{ ok: true; slug: string } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const parsed = storyPublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
  const story = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_publish_story", {
    p_story_id: story.id,
    p_slug: makeStorySlug(story.headline, story.id),
    p_headline: story.headline,
    p_summary: story.summary,
    p_take: story.take ?? null,
    p_beat: story.beat,
    p_featured: story.featured,
    p_tool_slugs: story.toolSlugs,
  });

  if (error) {
    console.error("[enki] publishStory failed", error);
    return { ok: false, error: "Could not publish the story. Try again." };
  }
  if (!data) return { ok: false, error: "That story is no longer in the queue." };

  revalidatePath("/admin/news");
  return { ok: true, slug: data };
}

export type StoryStatusChange = "rejected" | "pending";

export async function setStoryStatus(
  id: string,
  status: StoryStatusChange,
): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  if (status !== "rejected" && status !== "pending") {
    return { ok: false, error: "Unknown status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_story_status", {
    p_story_id: id,
    p_status: status,
  });
  if (error) {
    console.error("[enki] setStoryStatus failed", error);
    return { ok: false, error: "Could not update the story. Try again." };
  }
  if (!data) return { ok: false, error: "That story has already moved on." };

  revalidatePath("/admin/news");
  return { ok: true };
}

export async function fetchNewsNow(): Promise<{ ok: true; summary: IngestSummary } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const summary = await runNewsIngest();
    revalidatePath("/admin/news");
    return { ok: true, summary };
  } catch (error) {
    console.error("[enki] fetchNewsNow failed", error);
    return {
      ok: false,
      error: "Fetching failed. Check NEWS_INGEST_SECRET matches the Vault secret.",
    };
  }
}

export async function addNewsSource(input: NewsSourceInput): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const parsed = newsSourceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("news_sources").insert({
    name: parsed.data.name,
    feed_url: parsed.data.feedUrl,
    site_url: parsed.data.siteUrl,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "That feed is already a source." };
    }
    console.error("[enki] addNewsSource failed", error);
    return { ok: false, error: "Could not add the source. Try again." };
  }

  revalidatePath("/admin/news/sources");
  return { ok: true };
}

export async function setNewsSourceActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_sources")
    .update({ active })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[enki] setNewsSourceActive failed", error);
    return { ok: false, error: "Could not update the source. Try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "The update did not apply. Check your admin access." };
  }

  revalidatePath("/admin/news/sources");
  return { ok: true };
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `pnpm vitest run src/app/admin/news/actions.test.ts && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/news/actions.ts src/app/admin/news/actions.test.ts
git commit -m "feat(news): admin actions to publish stories and manage sources"
```

---

### Task 13: Sources page

**Files:**
- Create: `src/app/admin/news/sources/page.tsx`, `src/app/admin/news/sources/source-form.tsx`, `src/app/admin/news/sources/source-toggle.tsx`

UI in Tasks 13–15 follows the existing admin pages (`src/app/admin/page.tsx`, `src/app/admin/tools/page.tsx`): `Container` with `pt-28 pb-20`, Plex Mono "Operator" eyebrow, Cardot heading, hairline cards, teal pill buttons. It's covered by the visual check in Task 16, not by unit tests.

- [ ] **Step 1: The add-source form**

```tsx
// src/app/admin/news/sources/source-form.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addNewsSource } from "@/app/admin/news/actions";

const field =
  "h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none";

export function SourceForm() {
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-card/60 p-5 ring-hairline md:grid-cols-[1fr_2fr_1.5fr_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const res = await addNewsSource({ name, feedUrl, siteUrl });
          if (res.ok) {
            toast.success(`Added ${name}`);
            setName("");
            setFeedUrl("");
            setSiteUrl("");
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ars Technica" required />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Feed URL
        <input className={field} value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://arstechnica.com/ai/feed/" inputMode="url" required />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Site URL
        <input className={field} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://arstechnica.com" inputMode="url" required />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright disabled:opacity-60"
      >
        Add source
      </button>
    </form>
  );
}
```

- [ ] **Step 2: The toggle**

```tsx
// src/app/admin/news/sources/source-toggle.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setNewsSourceActive } from "@/app/admin/news/actions";
import { cn } from "@/lib/utils";

export function SourceToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={active}
      onClick={() =>
        startTransition(async () => {
          const res = await setNewsSourceActive(id, !active);
          if (!res.ok) toast.error(res.error);
        })
      }
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-wide uppercase transition-colors disabled:opacity-40",
        active
          ? "border-teal/40 bg-teal/10 text-teal"
          : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
      )}
    >
      {active ? "Active" : "Paused"}
    </button>
  );
}
```

- [ ] **Step 3: The page**

```tsx
// src/app/admin/news/sources/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatAge } from "@/lib/news/format-age";
import { safeExternalHref } from "@/lib/safe-url";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { SourceForm } from "@/app/admin/news/sources/source-form";
import { SourceToggle } from "@/app/admin/news/sources/source-toggle";

export const metadata: Metadata = {
  title: "News sources",
  robots: { index: false, follow: false },
};

export default async function NewsSourcesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("news_sources")
    .select("id, name, feed_url, site_url, active, last_fetched_at, last_error")
    .order("name");
  const now = new Date();

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link href="/admin/news" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="ArrowLeft" className="size-3.5" />
            News queue
          </Link>
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Operator</p>
          <h1 className="font-display text-4xl font-semibold">News sources</h1>
          <p className="text-sm text-muted-foreground">
            Feeds fetched every morning and whenever you press Fetch now.
          </p>
        </header>

        <SourceForm />

        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60 ring-hairline">
          {(sources ?? []).map((source) => (
            <li key={source.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <a href={safeExternalHref(source.site_url)} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-teal">
                  {source.name}
                </a>
                <span className="truncate font-mono text-xs text-muted-foreground">{source.feed_url}</span>
                <span className="text-xs text-muted-foreground">
                  Last fetched {formatAge(source.last_fetched_at, now)}
                  {source.last_error ? (
                    <span className="text-destructive"> · {source.last_error}</span>
                  ) : null}
                </span>
              </div>
              <SourceToggle id={source.id} active={source.active} />
            </li>
          ))}
          {(sources ?? []).length === 0 ? (
            <li className="p-5 text-sm text-muted-foreground">Add a feed to start collecting stories.</li>
          ) : null}
        </ul>
      </div>
    </Container>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/news/sources
git commit -m "feat(news): admin page to manage news sources"
```

---

### Task 14: News queue page

**Files:**
- Create: `src/app/admin/news/types.ts`, `src/app/admin/news/tool-picker.tsx`, `src/app/admin/news/story-editor.tsx`, `src/app/admin/news/news-queue.tsx`, `src/app/admin/news/fetch-now-button.tsx`, `src/app/admin/news/page.tsx`

- [ ] **Step 1: Shared types**

```ts
// src/app/admin/news/types.ts
import type { BeatSlug } from "@/data/beats";

/** One story as the queue renders it. `age` is computed on the server. */
export type QueueStory = {
  id: string;
  headline: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  excerpt: string | null;
  summary: string;
  take: string;
  beat: BeatSlug | "";
  featured: boolean;
  slug: string | null;
  age: string;
  toolSlugs: string[];
};

export type ToolOption = { slug: string; name: string };
```

- [ ] **Step 2: Tool picker**

```tsx
// src/app/admin/news/tool-picker.tsx
"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import { MAX_STORY_TOOLS } from "@/lib/news/schemas";
import type { ToolOption } from "@/app/admin/news/types";

export function ToolPicker({
  value,
  onChange,
  tools,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  tools: ToolOption[];
}) {
  const [query, setQuery] = useState("");
  const nameOf = new Map(tools.map((t) => [t.slug, t.name]));
  const full = value.length >= MAX_STORY_TOOLS;
  const q = query.trim().toLowerCase();
  const matches = q
    ? tools.filter((t) => !value.includes(t.slug) && t.name.toLowerCase().includes(q)).slice(0, 6)
    : [];

  const add = (slug: string) => {
    onChange([...value, slug]);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((slug) => (
          <span key={slug} className="inline-flex items-center gap-1 rounded-full border border-teal/40 bg-teal/10 py-1 pr-1.5 pl-3 text-xs text-teal">
            {nameOf.get(slug) ?? slug}
            <button
              type="button"
              aria-label={`Remove ${nameOf.get(slug) ?? slug}`}
              onClick={() => onChange(value.filter((s) => s !== slug))}
              className="grid size-5 place-items-center rounded-full hover:bg-teal/20"
            >
              <Icon name="X" className="size-3" />
            </button>
          </span>
        ))}
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tools. This story will earn nothing.</span>
        ) : null}
      </div>
      <input
        value={query}
        disabled={full}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (matches[0]) add(matches[0].slug);
          }
        }}
        placeholder={full ? `${MAX_STORY_TOOLS} tools is the limit` : "Add a tool"}
        className="h-9 rounded-xl border border-input bg-background/60 px-3 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none disabled:opacity-50"
      />
      {matches.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {matches.map((tool) => (
            <li key={tool.slug}>
              <button
                type="button"
                onClick={() => add(tool.slug)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-teal/40 hover:text-foreground"
              >
                + {tool.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Story editor**

```tsx
// src/app/admin/news/story-editor.tsx
"use client";

import { useState, useTransition, type Ref } from "react";
import { toast } from "sonner";
import { beats, type BeatSlug } from "@/data/beats";
import { isIndexableTake, SUMMARY_MAX, SUMMARY_MIN } from "@/lib/news/schemas";
import { safeExternalHref } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { publishStory, setStoryStatus } from "@/app/admin/news/actions";
import { ToolPicker } from "@/app/admin/news/tool-picker";
import type { QueueStory, ToolOption } from "@/app/admin/news/types";

const field =
  "w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none";

export function StoryEditor({
  story,
  tools,
  view,
  formRef,
}: {
  story: QueueStory;
  tools: ToolOption[];
  view: "pending" | "published";
  formRef: Ref<HTMLFormElement>;
}) {
  const [headline, setHeadline] = useState(story.headline);
  const [summary, setSummary] = useState(story.summary);
  const [take, setTake] = useState(story.take);
  const [beat, setBeat] = useState<BeatSlug | "">(story.beat);
  const [featured, setFeatured] = useState(story.featured);
  const [toolSlugs, setToolSlugs] = useState(story.toolSlugs);
  const [pending, startTransition] = useTransition();

  const summaryLength = summary.trim().length;
  const summaryOk = summaryLength >= SUMMARY_MIN && summaryLength <= SUMMARY_MAX;

  const secondary = () =>
    startTransition(async () => {
      const res = await setStoryStatus(story.id, view === "pending" ? "rejected" : "pending");
      if (res.ok) toast.success(view === "pending" ? "Rejected" : "Unpublished");
      else toast.error(res.error);
    });

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4 border-t border-border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!beat) {
          toast.error("Pick a beat.");
          return;
        }
        startTransition(async () => {
          const res = await publishStory({ id: story.id, headline, summary, take, beat, featured, toolSlugs });
          if (res.ok) toast.success(view === "pending" ? "Published" : "Saved");
          else toast.error(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Headline
        <input className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </label>

      {story.excerpt ? (
        <div className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">
          <p className="mb-1 font-mono text-[0.65rem] tracking-wide uppercase">
            Publisher excerpt, for reference only. Never published.
          </p>
          {story.excerpt}
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex justify-between">
          Your summary
          <span className={cn("tabular-nums", summaryOk ? "text-muted-foreground" : "text-destructive")}>
            {summaryLength}/{SUMMARY_MAX}
          </span>
        </span>
        <textarea className={cn(field, "min-h-24")} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex justify-between">
          Your take (optional)
          {isIndexableTake(take) ? (
            <span className="text-teal">Indexable</span>
          ) : (
            <span>300+ characters makes the page indexable</span>
          )}
        </span>
        <textarea className={cn(field, "min-h-20")} value={take} onChange={(e) => setTake(e.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          Beat
          <select className={cn(field, "h-10")} value={beat} onChange={(e) => setBeat(e.target.value as BeatSlug | "")}>
            <option value="">Pick a beat</option>
            {beats.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" className="size-4 accent-teal" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Feature as the lead story
        </label>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Tools in this story
        <ToolPicker value={toolSlugs} onChange={setToolSlugs} tools={tools} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright disabled:opacity-60"
        >
          {view === "pending" ? "Publish" : "Save"} <kbd className="ml-2 font-mono text-[0.65rem] opacity-70">P</kbd>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={secondary}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
        >
          {view === "pending" ? (
            <>
              Reject <kbd className="ml-2 font-mono text-[0.65rem] opacity-70">R</kbd>
            </>
          ) : (
            "Unpublish"
          )}
        </button>
        <a
          href={safeExternalHref(story.sourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Open original
        </a>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Queue list with the keyboard flow**

```tsx
// src/app/admin/news/news-queue.tsx
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setStoryStatus } from "@/app/admin/news/actions";
import { StoryEditor } from "@/app/admin/news/story-editor";
import type { QueueStory, ToolOption } from "@/app/admin/news/types";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function NewsQueue({
  stories,
  tools,
  view,
}: {
  stories: QueueStory[];
  tools: ToolOption[];
  view: "pending" | "published";
}) {
  const [activeId, setActiveId] = useState<string | null>(stories[0]?.id ?? null);
  const [, startTransition] = useTransition();
  const forms = useRef(new Map<string, HTMLFormElement>());

  // Derived, not synced in an effect: when the active story is published or
  // rejected it drops out of `stories`, and the first remaining one takes over.
  const currentId = stories.some((s) => s.id === activeId) ? activeId : (stories[0]?.id ?? null);

  const reject = useCallback((id: string) => {
    startTransition(async () => {
      const res = await setStoryStatus(id, "rejected");
      if (res.ok) toast.success("Rejected");
      else toast.error(res.error);
    });
  }, []);

  const move = useCallback(
    (delta: number) => {
      const index = stories.findIndex((s) => s.id === currentId);
      const next = stories[Math.min(Math.max(index + delta, 0), stories.length - 1)];
      if (!next) return;
      setActiveId(next.id);
      requestAnimationFrame(() =>
        document.getElementById(`story-${next.id}`)?.scrollIntoView({ block: "nearest" }),
      );
    },
    [stories, currentId],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "j") {
        event.preventDefault();
        move(1);
      } else if (key === "k") {
        event.preventDefault();
        move(-1);
      } else if (key === "p" && currentId) {
        event.preventDefault();
        forms.current.get(currentId)?.requestSubmit();
      } else if (key === "r" && currentId && view === "pending") {
        event.preventDefault();
        reject(currentId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, reject, currentId, view]);

  if (stories.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
        {view === "pending"
          ? "The queue is empty. Fetch now, or wait for tomorrow's run."
          : "Nothing published yet."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {stories.map((story) => {
        const open = story.id === currentId;
        return (
          <li
            key={story.id}
            id={`story-${story.id}`}
            className={cn(
              "overflow-hidden rounded-2xl border bg-card/60 ring-hairline transition-colors",
              open ? "border-teal/40" : "border-border",
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setActiveId(story.id)}
              className="flex w-full flex-col gap-1 p-5 text-left"
            >
              <span className="font-medium text-pretty">{story.headline}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {story.sourceName} · {story.age}
                {story.toolSlugs.length > 0 ? ` · ${story.toolSlugs.length} tool(s)` : ""}
              </span>
            </button>
            {open ? (
              <StoryEditor
                key={story.id}
                story={story}
                tools={tools}
                view={view}
                formRef={(el) => {
                  if (el) forms.current.set(story.id, el);
                  else forms.current.delete(story.id);
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Fetch-now button**

```tsx
// src/app/admin/news/fetch-now-button.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/shared/icon";
import { fetchNewsNow } from "@/app/admin/news/actions";

export function FetchNowButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetchNewsNow();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const { sources, fetched, inserted, failed } = res.summary;
          const message = `${inserted} new of ${fetched} items from ${sources} sources`;
          if (failed.length > 0) toast.warning(`${message}. Failed: ${failed.join(", ")}`);
          else toast.success(message);
        })
      }
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright disabled:opacity-60"
    >
      <Icon name="RotateCcw" className={pending ? "size-4 animate-spin" : "size-4"} />
      {pending ? "Fetching…" : "Fetch now"}
    </button>
  );
}
```

- [ ] **Step 6: The page**

```tsx
// src/app/admin/news/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllTools } from "@/lib/content";
import { getBeat } from "@/data/beats";
import { formatAge } from "@/lib/news/format-age";
import { cn } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { NewsQueue } from "@/app/admin/news/news-queue";
import { FetchNowButton } from "@/app/admin/news/fetch-now-button";
import type { QueueStory } from "@/app/admin/news/types";

export const metadata: Metadata = {
  title: "News queue",
  robots: { index: false, follow: false },
};

type View = "pending" | "published";

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireAdmin();
  const view: View = (await searchParams).view === "published" ? "published" : "pending";

  const supabase = await createClient();
  const columns =
    "id, headline, source_id, source_url, image_url, summary, take, beat, featured, slug, source_published_at, published_at, created_at";
  const storiesQuery =
    view === "pending"
      ? supabase.from("stories").select(columns).eq("status", "pending").order("created_at", { ascending: false }).limit(100)
      : supabase.from("stories").select(columns).eq("status", "published").order("published_at", { ascending: false }).limit(50);

  const [{ data: storyRows }, { data: sourceRows }, allTools] = await Promise.all([
    storiesQuery,
    supabase.from("news_sources").select("id, name"),
    getAllTools(),
  ]);

  const rows = storyRows ?? [];
  const ids = rows.map((r) => r.id);
  const [excerptRes, toolRes] =
    ids.length > 0
      ? await Promise.all([
          supabase.from("story_excerpts").select("story_id, excerpt").in("story_id", ids),
          supabase.from("story_tools").select("story_id, tool_slug, position").in("story_id", ids).order("position"),
        ])
      : [{ data: [] }, { data: [] }];

  const sourceName = new Map((sourceRows ?? []).map((s) => [s.id, s.name]));
  const excerptOf = new Map((excerptRes.data ?? []).map((e) => [e.story_id, e.excerpt]));
  const toolsOf = new Map<string, string[]>();
  for (const t of toolRes.data ?? []) {
    toolsOf.set(t.story_id, [...(toolsOf.get(t.story_id) ?? []), t.tool_slug]);
  }

  const now = new Date();
  const stories: QueueStory[] = rows.map((r) => ({
    id: r.id,
    headline: r.headline,
    sourceName: sourceName.get(r.source_id) ?? "Unknown source",
    sourceUrl: r.source_url,
    imageUrl: r.image_url,
    excerpt: excerptOf.get(r.id) ?? null,
    summary: r.summary ?? "",
    take: r.take ?? "",
    beat: r.beat && getBeat(r.beat) ? (r.beat as QueueStory["beat"]) : "",
    featured: r.featured,
    slug: r.slug,
    // Formatted here, not in the client, so server and client HTML agree.
    age: formatAge(view === "pending" ? (r.source_published_at ?? r.created_at) : r.published_at, now),
    toolSlugs: toolsOf.get(r.id) ?? [],
  }));

  const tools = allTools
    .map((t) => ({ slug: t.slug, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tab = (target: View, label: string) => (
    <Link
      href={target === "pending" ? "/admin/news" : "/admin/news?view=published"}
      aria-current={view === target ? "page" : undefined}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition-colors",
        view === target
          ? "border-teal/40 bg-teal/10 text-teal"
          : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Icon name="ArrowLeft" className="size-3.5" />
              Admin
            </Link>
            <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Operator</p>
            <h1 className="font-display text-4xl font-semibold">News queue</h1>
            <p className="text-sm text-muted-foreground">
              J and K move between stories, P publishes, R rejects.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/news/sources"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              <Icon name="Globe" className="size-4" />
              Sources
            </Link>
            {view === "pending" ? <FetchNowButton /> : null}
          </div>
        </header>

        <nav className="flex gap-2" aria-label="Queue view">
          {tab("pending", "Pending")}
          {tab("published", "Published")}
        </nav>

        <NewsQueue stories={stories} tools={tools} view={view} />
      </div>
    </Container>
  );
}
```

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. If `react-hooks` flags anything in `news-queue.tsx`, fix the code rather than disabling the rule; the lessons digest shows `react-hooks/rules-of-hooks` has cost this project time before. If TypeScript rejects the `[{ data: [] }, { data: [] }]` fallback's element types, annotate it `as const` or type both arrays explicitly.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/news/types.ts src/app/admin/news/tool-picker.tsx src/app/admin/news/story-editor.tsx src/app/admin/news/news-queue.tsx src/app/admin/news/fetch-now-button.tsx src/app/admin/news/page.tsx
git commit -m "feat(news): admin queue to summarise, tag and publish stories"
```

---

### Task 15: Admin dashboard hook-up

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Count pending stories.** Add one entry to the end of the `Promise.all` array and its destructuring:

```ts
    { count: pendingStoryCount },
  ] = await Promise.all([
    // …existing six queries unchanged…
    supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
```

- [ ] **Step 2: Add the KPI.** Give `Kpi` an optional `className`:

```tsx
function Kpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1 bg-card px-4 py-6 text-center", className)}>
```

(import `cn` from `@/lib/utils` if the file doesn't already). Change the KPI grid's `md:grid-cols-6` to `md:grid-cols-7`, and add as the last cell:

```tsx
          <Kpi
            label="Pending stories"
            value={String(pendingStoryCount ?? 0)}
            className="col-span-2 md:col-span-1"
          />
```

`col-span-2` on mobile stops a seventh cell leaving an empty grey half-row in the two-column grid.

- [ ] **Step 3: Add the link.** Wrap the header's existing "Manage tools" `Link` in `<div className="flex flex-wrap items-center gap-3">` and add before it:

```tsx
            <Link
              href="/admin/news"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-5 text-sm text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              <Icon name="FileText" className="size-4" />
              News queue
            </Link>
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): show pending stories and link the news queue"
```

---

### Task 16: Secret setup, live verification and docs

- [ ] **Step 1: Owner sets the secret (owner only; Claude must not see or handle the value)**

Ask the owner to do these four things, then wait for confirmation:

1. Generate a secret in their own terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Put it in `.env.local` as `NEWS_INGEST_SECRET=<value>`, and add a random `CRON_SECRET=<value>` too.
3. In Supabase → SQL Editor, run:
   ```sql
   select vault.create_secret('<value>', 'news_ingest_secret', 'Shared secret for the news ingest RPCs');
   ```
4. In Vercel → Settings → Environment Variables, add `NEWS_INGEST_SECRET` (same value) and `CRON_SECRET`, for Production and Preview.

- [ ] **Step 2: Confirm the machine is converged**

Run: `pnpm doctor`
Expected: env check passes (it now requires `NEWS_INGEST_SECRET`), Supabase awake.

- [ ] **Step 3: Full gate**

Run: `pnpm verify`
Expected: typecheck, lint and every test pass. Report the test count.

- [ ] **Step 4: Live RLS audit**

Run: `pnpm audit:rls`
Expected: all PASS, `RLS holds.`

- [ ] **Step 5: Exercise the cron route locally**

Start the dev server with `preview_start` `{ name: "enki-dev" }` (or a production build if it won't stay up). Then, in the owner's terminal or via Bash with the value read from `.env.local` and never printed:

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" http://localhost:3000/api/ingest-news
```

Expected: `{"ok":true,"sources":N,"fetched":…,"inserted":…,"failed":[…]}` with `inserted > 0` on the first run and `0` on an immediate second run (dedup). Then confirm via MCP `execute_sql`:

```sql
select status, count(*) from public.stories group by status;
select count(*) from public.story_tools;
select name, last_fetched_at, last_error from public.news_sources order by name;
```

Expected: only `pending` rows; every active source has `last_fetched_at` set. Any source with `last_error` gets investigated or paused; say which.

- [ ] **Step 6: Exercise the admin UI (needs the owner signed in)**

Claude must not type the admin password. Ask the owner to sign in to `/login` in the Browser pane, then:

1. Load `/admin`: the "Pending stories" KPI shows the count from Step 5, and "News queue" links to `/admin/news`.
2. Load `/admin/news`: stories listed newest first, the first one expanded with its excerpt and suggested tool chips.
3. Press `J`, then `K`: the expanded story moves down and back.
4. Write a 40+ character summary, pick a beat, press `P`: toast "Published", the story leaves the list.
5. Press `R` on the next story: toast "Rejected".
6. Open `?view=published`: the published story is there with its summary; unpublish it and re-publish it.
7. Load `/admin/news/sources`: every source listed with a last-fetched time; pause and resume one.
8. `read_console_messages` with `onlyErrors: true`: no errors, and specifically no hydration warnings.

Confirm the database state after step 4 via MCP:

```sql
select slug, status, beat, published_at is not null as has_published_at
  from public.stories where status = 'published';
```

- [ ] **Step 7: Visual check**

`pnpm sweep` loads pages without a session, so it cannot reach the admin routes. Run it on the always-check pages to prove nothing public regressed:

```bash
pnpm sweep -- / /tools
```

Every pair must read PASS. For the admin pages, with the owner signed in, use `resize_window` at 390px and at 1440px on `/admin`, `/admin/news` (with a story expanded) and `/admin/news/sources`, and take a screenshot of each. Check specifically: no horizontal scroll, the KPI grid's last row has no empty cell at 390px, the editor's buttons wrap instead of overflowing, long feed URLs truncate. Reset with `resize_window` preset `desktop` when done. Report what was and wasn't checked.

- [ ] **Step 8: Update `handoff.md`**

In §4:
- Add rows to the schema table for `news_sources` (admins only), `stories` (public read of `published`; no API writes), `story_excerpts` (admins read; never public) and `story_tools` (readable with the parent story).
- Add to the RPC list: `ingest_sources`, `ingest_story`, `touch_news_source` (secret-gated via Vault `news_ingest_secret`, pending-only, anon-executable) and `admin_publish_story`, `admin_set_story_status` (`is_admin()`-guarded, authenticated only).
- Append `create_news_tables` to the migrations list.

In §2a, add `NEWS_INGEST_SECRET` (required) and `CRON_SECRET` (Vercel, and local only for manual cron calls), and note that the Vault secret must match.

- [ ] **Step 9: Commit**

```bash
git add handoff.md
git commit -m "docs(handoff): news tables, ingest RPCs and secrets"
```

- [ ] **Step 10: Stop the dev server** with `preview_stop`.

Do not push. The owner decides when merge 1 goes to `main`'s remote.

---

## Next plans

Merges 2–4 of the spec (public story pages, homepage, repositioning) each get their own plan, written once this one has landed, so they build on the real schema rather than this plan's assumptions. Merge 2 must also decide how story pages show the source name publicly, since `news_sources` is admin-only; the likely answer is a narrow public view or a column grant on `id, name, site_url`.
