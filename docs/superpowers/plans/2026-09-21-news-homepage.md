# News Homepage Implementation Plan (merge 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Enki's homepage with a Yahoo Finance-style AI news front page, in Enki's own design language:
- a "Tools in the news" strip
- a lead story
- a Popular (or Latest) rail
- a directory sidebar
- five beat sections
- a Latest column
- a directory band

Also:
- **Navigation:** change the header nav to News · Tools · Finder · Deals, and add a beat row across the news pages.
- **`/tools`:** move the oracle hero and the directory's showcase sections there, so nothing the old homepage offered disappears.

**Architecture:**
- **Assembly.** The homepage is a server component rendered on demand and cached (`revalidate = 300`, plus `revalidatePath("/")` on every publish or status change).
- **Data.**
  - One read fetches the newest 200 published stories.
  - A second read fetches their tool links.
  - A new `SECURITY DEFINER` function `popular_stories` returns aggregate view counts only, since anon cannot read `story_views`.
  - A pure function, `buildHomeFeed`, turns those into every section. All thresholds and omission rules live there and are unit-tested.
- **Client code.** The only client components are the beat row (`usePathname`, for its active state) and the "Find a tool" button (opens the existing command menu).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md`. Read **§0 Amendments** first. This plan implements:
- **§7** (homepage) in full
- **§7.1**: the header nav and beat row
- **§8.1**: `/tools`, pulled forward from merge 4 (deviation 1)

It builds on merge 2's read layer (`src/lib/news/stories.ts`) and components (`src/components/news/*`).

## Global Constraints

- **No em dash (U+2014) or en dash (U+2013)** in any user-facing string this plan adds.
- **Byline and disclosure:** no copy claims who writes summaries, and there is no AI disclosure (§0 amendments 1–2).
- **The publisher excerpt is never rendered publicly.** No public code path queries `story_excerpts`.
- **Every displayed metric is real and gated** (spec §2):
  - the ticker is hidden until at least 3 directory tools have mentions
  - Popular appears only when the most-viewed story has at least 10 views in 48 hours; otherwise the slot is titled Latest
  - never pad either with invented or duplicate entries
- **Server components by default.** The only `"use client"` files this plan adds are `BeatRow` and `FindToolButton`. Relative times (`formatAge`) are computed on the server only.
- **No `useSearchParams` on public pages** (roadmap 0.2). `usePathname` is fine.
- **Links:** tool CTAs go through `outboundHref(slug)`; source links are plain external links with `rel="noopener noreferrer"`.
- **Horizontal scrollers clip on purpose.** The ticker and the beat row are the only such rows, and they carry `data-sweep-ignore` so the visual sweep exempts them. Never add it anywhere else.
- **Supabase:** revoke from `public, anon, authenticated` before granting; function parameters are `p_*`; qualify every column inside a function.
- **Git:** work on `main`, no branches or worktrees, never push. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The pre-commit hook runs `pnpm verify`; never use `--no-verify`. If `tsc` fails on a stale `.next/types/*` file, delete `.next` and retry.

## Review Focus

1. **One published story, or none.** This is the real state today. The homepage must look intentional, not broken:
   - lead only
   - no ticker, no empty beat headers
   - the rail and the Latest column hidden when they have nothing to show
   - with zero stories: the "coming soon" line and the directory band

   Covered by `buildHomeFeed` tests (Task 2) and the sweep plus screenshots (Task 6).
2. **The rail falls back to Latest and the Latest column would repeat it.** The Latest column must exclude stories already in the rail and the lead. Covered in Task 2.
3. **A tool linked to stories is later removed from the directory.** It must not count toward the ticker's minimum of 3, and must not render as a chip. Covered in Task 2.
4. **A hotlinked feed image fails to load** (404, hotlink block). The card keeps its layout, with a gradient in place of the photo, and no broken-image icon. Covered by `StoryImage` design (`alt=""` over a gradient); checked in Task 6.
5. **The header's News link on a news page.** It must show as active on `/`, `/news` and every `/news/...` page, and Tools must not light up on `/news`. Covered by `isNavActive` tests (Task 3).

---

## Deviations from the spec (deliberate)

1. **`/tools` repositioning (spec §8.1) moves from merge 4 into this merge (Task 4).** Replacing the homepage alone would take the oracle hero, "How I vet" and the trust stats off the site until merge 4. It would also break the footer's `/#how-we-vet` link and the end-to-end test that expects the hero on `/`. Merge 4 keeps §8.2–8.3: metadata, copy and the roadmap.
2. **Popular reads aggregate counts through a new `popular_stories` function.** Anon can never read `story_views` rows (merge 2). The function returns only `(story_id, views)` for published stories.
3. **Failed images show a gradient panel, not a text-only card.** The spec's `onError` swap would need a client component, and it misses errors that fire before hydration. A decorative `alt=""` image over a gradient needs no JavaScript and never shows a broken-image icon.
4. **There is no separate newsletter band on the homepage.** The site footer already renders the newsletter form on every page, including this one.
5. **The final "Explore the directory" call-to-action is dropped** when the old homepage's sections move to `/tools`, because on `/tools` it would link to itself.

## File map

| File | Responsibility |
|---|---|
| (Supabase migration `popular_stories`) | Aggregate view counts for published stories, callable by anon |
| `src/lib/supabase/database.types.ts` | Types for the `popular_stories` function |
| `src/lib/news/stories.ts` (+ test) | `listRecentStories`, `getToolSlugsForStories`, `getPopularStoryViews` |
| `src/lib/news/home-feed.ts` (+ test) | Pure `buildHomeFeed` and its thresholds |
| `src/lib/news/home.ts` | `getHomeFeed()`: loads, then builds |
| `src/lib/nav.ts` (+ test) | Pure `isNavActive`, `activeBeatFor` |
| `src/lib/site.ts` | The new header nav items |
| `src/components/layout/site-header.tsx` | Use `isNavActive` |
| `src/components/news/beat-row.tsx` | Client: beat links with active state |
| `src/components/news/news-archive.tsx`, `src/app/news/[slug]/page.tsx` | Use `BeatRow` |
| `src/app/tools/page.tsx` | Hero, then the directory, then featured tools, Finder, categories, How I vet |
| `src/components/layout/site-footer.tsx` | "How I vet" now links to `/tools#how-we-vet` |
| `src/components/front-page/*` | Homepage sections |
| `src/app/page.tsx` | The new homepage |
| `src/app/admin/news/actions.ts` (+ test) | Also revalidate `/` |
| `tests/e2e/directory.spec.ts` | The hero test moves to `/tools`; add a news homepage test |

---

### Task 1: Database: `popular_stories`

**Owner: the controller**, via the Supabase MCP connector (project `qknsqurdawglctwqfwxe`). A subagent may do Step 4.

**Files:**
- Migration via MCP `apply_migration`, name `popular_stories`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Produces: `popular_stories(p_hours integer default 48, p_limit integer default 5) returns table (story_id uuid, views bigint)`.
  - It counts only views of **published** stories within the window, most viewed first.
  - Its arguments are clamped: hours to 1–720, limit to 1–20.
  - It is executable by anon and authenticated.

- [ ] **Step 1: Apply the migration** (MCP `apply_migration`, name `popular_stories`)

```sql
-- Aggregate view counts for the homepage's Popular rail. Anon can never read
-- story_views rows; this exposes only per-story totals, and only for stories
-- that are published right now. Every column is qualified (lesson from
-- news_ingest_authorized: an unqualified name can resolve to the wrong thing).
create or replace function public.popular_stories(p_hours integer default 48, p_limit integer default 5)
returns table (story_id uuid, views bigint)
language sql stable security definer set search_path = ''
as $$
  select v.story_id, count(*)::bigint
    from public.story_views v
    join public.stories s on s.id = v.story_id
   where s.status = 'published'
     and v.created_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 48), 1), 720))
   group by v.story_id
   order by count(*) desc, v.story_id
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;
revoke all on function public.popular_stories(integer, integer) from public, anon, authenticated;
grant execute on function public.popular_stories(integer, integer) to anon, authenticated;
```

- [ ] **Step 2: Prove it counts and filters correctly** (MCP `execute_sql`, one transaction, rolled back)

```sql
begin;
insert into public.story_views (story_id)
select s.id from public.stories s cross join generate_series(1, 3)
 where s.slug = 'gemini-hacked-three-real-companies-during-a-cybersecurity-31fc2b';
insert into public.story_views (story_id)
select id from public.stories where status = 'pending' limit 1;
set local role anon;
select * from public.popular_stories(48, 5);
rollback;
```
Expected:
- the Gemini story appears with at least 3 more views than any real count already present
- **the pending story does not appear**
- no permission error as anon

- [ ] **Step 3: Check the grants** (MCP `execute_sql`)

```sql
select proacl::text from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'popular_stories';
```
Expected: `anon` and `authenticated` hold EXECUTE; no entry starts with `=X/` (the PUBLIC grant).

- [ ] **Step 4: Types.** In `src/lib/supabase/database.types.ts`, inside `public.Functions` after `admin_set_story_status`:

```ts
      /** Aggregate view counts for published stories only. Anon-callable. */
      popular_stories: {
        Args: { p_hours?: number; p_limit?: number }
        Returns: { story_id: string; views: number }[]
      }
```

Run `pnpm typecheck` and expect it to be clean. Commit:

```bash
git add src/lib/supabase/database.types.ts
git commit -m "feat(news): popular_stories exposes aggregate view counts for published stories"
```

---

### Task 2: The homepage data layer and `buildHomeFeed`

**Files:**
- Modify: `src/lib/news/stories.ts`, `src/lib/news/stories.test.ts`
- Create: `src/lib/news/home-feed.ts`, `src/lib/news/home-feed.test.ts`
- Create: `src/lib/news/home.ts`

**Interfaces:**
- Consumes:
  - from `stories.ts`: `PublicStory`, `withTimeout` (module-private) and `PUBLIC_STORY_COLUMNS` (module-private)
  - `popular_stories` (Task 1)
  - `beats` and `BeatSlug`
  - `getAllTools()`
- Produces:
  - `stories.ts`:
    - `HOME_STORY_LIMIT = 200`
    - `listRecentStories(limit?): Promise<PublicStory[]>`
    - `getToolSlugsForStories(ids: string[]): Promise<Map<string, string[]>>`
    - `getPopularStoryViews(hours?, limit?): Promise<{ storyId: string; views: number }[]>`
  - `home-feed.ts`:
    - the constants below
    - `type HomeFeed`
    - `buildHomeFeed(input): HomeFeed`
  - `home.ts`: `getHomeFeed(now?: Date): Promise<HomeFeed>`
- `HomeFeed` shape (Task 5 renders exactly this):

```ts
type HomeFeed = {
  lead: PublicStory | null;
  leadToolSlugs: string[];
  rail: { title: "Popular" | "Latest"; stories: PublicStory[] };
  beats: { slug: BeatSlug; name: string; stories: PublicStory[] }[];
  latest: PublicStory[];
  ticker: { slug: string; count: number }[];
};
```

- [ ] **Step 1: Write the failing tests for `buildHomeFeed`**

```ts
// src/lib/news/home-feed.test.ts
import { describe, it, expect } from "vitest";
import {
  buildHomeFeed,
  LATEST_COUNT,
  POPULAR_MIN_TOP_VIEWS,
  STORIES_PER_BEAT,
  TICKER_MAX_TOOLS,
} from "@/lib/news/home-feed";
import type { PublicStory } from "@/lib/news/stories";
import type { BeatSlug } from "@/data/beats";

const NOW = new Date("2026-09-21T12:00:00Z");

function story(
  id: string,
  opts: { hoursAgo?: number; beat?: BeatSlug; featured?: boolean } = {},
): PublicStory {
  const published = new Date(NOW.getTime() - (opts.hoursAgo ?? 1) * 3_600_000).toISOString();
  return {
    id,
    slug: `story-${id}`,
    headline: `Headline ${id}`,
    summary: "A summary that is comfortably longer than forty characters.",
    take: null,
    beat: opts.beat ?? "models-labs",
    beatName: "Models & Labs",
    imageUrl: null,
    sourceName: "Source",
    sourceSiteUrl: "https://source.example",
    sourceUrl: `https://source.example/${id}`,
    sourcePublishedAt: published,
    publishedAt: published,
    featured: opts.featured ?? false,
  };
}

const known = new Set(["gemini", "claude", "chatgpt", "cursor"]);
const build = (overrides: Partial<Parameters<typeof buildHomeFeed>[0]> = {}) =>
  buildHomeFeed({
    stories: [],
    toolSlugsByStory: new Map(),
    popular: [],
    knownToolSlugs: known,
    now: NOW,
    ...overrides,
  });

describe("buildHomeFeed: sparse states", () => {
  it("is empty everywhere with no stories", () => {
    const feed = build();
    expect(feed.lead).toBeNull();
    expect(feed.rail).toEqual({ title: "Latest", stories: [] });
    expect(feed.beats).toEqual([]);
    expect(feed.latest).toEqual([]);
    expect(feed.ticker).toEqual([]);
  });

  it("shows one story as the lead and nothing else", () => {
    const feed = build({ stories: [story("a")] });
    expect(feed.lead?.id).toBe("a");
    expect(feed.rail.stories).toEqual([]);
    expect(feed.beats).toEqual([]);
    expect(feed.latest).toEqual([]);
  });
});

describe("buildHomeFeed: lead", () => {
  it("prefers a story featured within 48 hours over newer ones", () => {
    const feed = build({ stories: [story("new", { hoursAgo: 1 }), story("feat", { hoursAgo: 30, featured: true })] });
    expect(feed.lead?.id).toBe("feat");
  });

  it("ignores a featured story older than 48 hours", () => {
    const feed = build({ stories: [story("new", { hoursAgo: 1 }), story("old", { hoursAgo: 60, featured: true })] });
    expect(feed.lead?.id).toBe("new");
  });

  it("keeps only directory tools on the lead", () => {
    const feed = build({
      stories: [story("a")],
      toolSlugsByStory: new Map([["a", ["gemini", "removed-tool"]]]),
    });
    expect(feed.leadToolSlugs).toEqual(["gemini"]);
  });
});

describe("buildHomeFeed: rail", () => {
  const many = Array.from({ length: 12 }, (_, i) => story(`s${i}`, { hoursAgo: i + 1 }));

  it("falls back to Latest below the view threshold", () => {
    const feed = build({ stories: many, popular: [{ storyId: "s5", views: POPULAR_MIN_TOP_VIEWS - 1 }] });
    expect(feed.rail.title).toBe("Latest");
    expect(feed.rail.stories.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("shows Popular by views once the top story reaches the threshold, excluding the lead", () => {
    const feed = build({
      stories: many,
      popular: [
        { storyId: "s0", views: 40 },
        { storyId: "s7", views: 25 },
        { storyId: "s3", views: 12 },
      ],
    });
    expect(feed.rail.title).toBe("Popular");
    expect(feed.rail.stories.map((s) => s.id)).toEqual(["s7", "s3"]);
  });

  it("never repeats the rail in the Latest column", () => {
    const feed = build({ stories: many });
    const railIds = new Set(feed.rail.stories.map((s) => s.id));
    expect(feed.latest.some((s) => railIds.has(s.id))).toBe(false);
    expect(feed.latest.some((s) => s.id === feed.lead?.id)).toBe(false);
    expect(feed.latest).toHaveLength(LATEST_COUNT);
  });
});

describe("buildHomeFeed: beats", () => {
  it("omits empty beats, caps each, excludes the lead and anything older than 7 days", () => {
    const stories = [
      story("lead", { hoursAgo: 1, beat: "research" }),
      ...Array.from({ length: 6 }, (_, i) => story(`r${i}`, { hoursAgo: i + 2, beat: "research" })),
      story("old", { hoursAgo: 24 * 8, beat: "policy-safety" }),
    ];
    const feed = build({ stories });
    expect(feed.beats.map((b) => b.slug)).toEqual(["research"]);
    expect(feed.beats[0].stories).toHaveLength(STORIES_PER_BEAT);
    expect(feed.beats[0].stories.some((s) => s.id === "lead")).toBe(false);
  });
});

describe("buildHomeFeed: ticker", () => {
  it("stays hidden until three directory tools have mentions", () => {
    const feed = build({
      stories: [story("a"), story("b")],
      toolSlugsByStory: new Map([
        ["a", ["gemini", "removed-tool"]],
        ["b", ["claude"]],
      ]),
    });
    expect(feed.ticker).toEqual([]);
  });

  it("ranks tools by stories mentioning them in the last 7 days", () => {
    const feed = build({
      stories: [story("a"), story("b"), story("c"), story("old", { hoursAgo: 24 * 8 })],
      toolSlugsByStory: new Map([
        ["a", ["gemini", "claude", "gemini"]],
        ["b", ["gemini", "chatgpt"]],
        ["c", ["cursor"]],
        ["old", ["cursor", "cursor"]],
      ]),
    });
    expect(feed.ticker).toEqual([
      { slug: "gemini", count: 2 },
      { slug: "chatgpt", count: 1 },
      { slug: "claude", count: 1 },
      { slug: "cursor", count: 1 },
    ]);
  });

  it("caps the ticker", () => {
    const slugs = Array.from({ length: TICKER_MAX_TOOLS + 3 }, (_, i) => `tool-${i}`);
    const feed = build({
      stories: [story("a")],
      toolSlugsByStory: new Map([["a", slugs]]),
      knownToolSlugs: new Set(slugs),
    });
    expect(feed.ticker).toHaveLength(TICKER_MAX_TOOLS);
  });
});
```

- [ ] **Step 2: Write the failing tests for the new reads.** In `src/lib/news/stories.test.ts`, change the anon mock so it also provides `rpc`:

```ts
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ from, rpc }) }));
```

Add `listRecentStories`, `getToolSlugsForStories` and `getPopularStoryViews` to the dynamic import, add `rpc.mockReset();` to `beforeEach`, and append:

```ts
describe("listRecentStories", () => {
  it("asks for the newest published stories", async () => {
    respond({ data: [row], error: null });
    const stories = await listRecentStories();
    expect(stories).toHaveLength(1);
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
    expect(builder().limit).toHaveBeenCalledWith(200);
  });
});

describe("getToolSlugsForStories", () => {
  it("does not query for an empty list", async () => {
    expect(await getToolSlugsForStories([])).toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
  });

  it("groups tool slugs by story, in position order", async () => {
    respond({
      data: [
        { story_id: "a", tool_slug: "gemini", position: 0 },
        { story_id: "b", tool_slug: "claude", position: 0 },
        { story_id: "a", tool_slug: "cursor", position: 1 },
      ],
      error: null,
    });
    const map = await getToolSlugsForStories(["a", "b"]);
    expect(map.get("a")).toEqual(["gemini", "cursor"]);
    expect(map.get("b")).toEqual(["claude"]);
    expect(builder().in).toHaveBeenCalledWith("story_id", ["a", "b"]);
  });
});

describe("getPopularStoryViews", () => {
  it("maps the RPC's rows", async () => {
    rpc.mockResolvedValue({ data: [{ story_id: "a", views: 12 }], error: null });
    expect(await getPopularStoryViews()).toEqual([{ storyId: "a", views: 12 }]);
    expect(rpc).toHaveBeenCalledWith("popular_stories", { p_hours: 48, p_limit: 5 });
  });

  it("degrades to no popular stories on error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "paused" } });
    expect(await getPopularStoryViews()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `pnpm vitest run src/lib/news/home-feed.test.ts src/lib/news/stories.test.ts`
Expected: FAIL. `home-feed.ts` and the three reads don't exist yet.

- [ ] **Step 4: Add the reads to `src/lib/news/stories.ts`.** Append them; they reuse the module's existing `withTimeout`, `PUBLIC_STORY_COLUMNS` and `toPublicStories`:

```ts
/** Enough stories for the homepage's windows at current volume (5-15 a day). */
export const HOME_STORY_LIMIT = 200;

export async function listRecentStories(limit: number = HOME_STORY_LIMIT): Promise<PublicStory[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(PUBLIC_STORY_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit),
    "listRecentStories",
  );
  return toPublicStories(result?.data);
}

/** Tool slugs per story, in position order, for many stories in one query. */
export async function getToolSlugsForStories(storyIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (storyIds.length === 0) return map;
  const result = await withTimeout(
    createAnonClient()
      .from("story_tools")
      .select("story_id, tool_slug, position")
      .in("story_id", storyIds)
      .order("position"),
    "getToolSlugsForStories",
  );
  for (const row of (result?.data ?? []) as { story_id: string; tool_slug: string }[]) {
    map.set(row.story_id, [...(map.get(row.story_id) ?? []), row.tool_slug]);
  }
  return map;
}

/** Most-viewed published stories in the window (aggregate counts only). */
export async function getPopularStoryViews(
  hours = 48,
  limit = 5,
): Promise<{ storyId: string; views: number }[]> {
  const result = await withTimeout(
    createAnonClient().rpc("popular_stories", { p_hours: hours, p_limit: limit }),
    "getPopularStoryViews",
  );
  return ((result?.data ?? []) as { story_id: string; views: number }[]).map((r) => ({
    storyId: r.story_id,
    views: Number(r.views),
  }));
}
```

- [ ] **Step 5: Implement `home-feed.ts`**

```ts
// src/lib/news/home-feed.ts
import { beats, type BeatSlug } from "@/data/beats";
import type { PublicStory } from "@/lib/news/stories";

/*
 * Every homepage rule lives here, pure, so it can be tested without a
 * database. Spec §7. The page only renders what this returns.
 */

export const LEAD_WINDOW_HOURS = 48;
export const BEAT_WINDOW_DAYS = 7;
export const TICKER_WINDOW_DAYS = 7;
export const STORIES_PER_BEAT = 4;
export const LATEST_COUNT = 5;
export const POPULAR_COUNT = 5;
/** Popular is shown only once its top story has real traffic (spec §7.3). */
export const POPULAR_MIN_TOP_VIEWS = 10;
/** The ticker stays hidden rather than showing a thin strip (spec §7.2). */
export const TICKER_MIN_TOOLS = 3;
export const TICKER_MAX_TOOLS = 10;

export type HomeFeed = {
  lead: PublicStory | null;
  leadToolSlugs: string[];
  rail: { title: "Popular" | "Latest"; stories: PublicStory[] };
  beats: { slug: BeatSlug; name: string; stories: PublicStory[] }[];
  latest: PublicStory[];
  ticker: { slug: string; count: number }[];
};

const HOUR_MS = 3_600_000;

function isWithin(iso: string, now: Date, ms: number): boolean {
  return now.getTime() - new Date(iso).getTime() <= ms;
}

export function buildHomeFeed({
  stories,
  toolSlugsByStory,
  popular,
  knownToolSlugs,
  now,
}: {
  stories: PublicStory[];
  toolSlugsByStory: Map<string, string[]>;
  popular: { storyId: string; views: number }[];
  knownToolSlugs: ReadonlySet<string>;
  now: Date;
}): HomeFeed {
  const sorted = [...stories].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const known = (slugs: string[] | undefined) => (slugs ?? []).filter((slug) => knownToolSlugs.has(slug));

  const lead =
    sorted.find((s) => s.featured && isWithin(s.publishedAt, now, LEAD_WINDOW_HOURS * HOUR_MS)) ??
    sorted[0] ??
    null;
  const rest = sorted.filter((s) => s.id !== lead?.id);

  const byId = new Map(sorted.map((s) => [s.id, s]));
  const popularStories = popular
    .map((p) => byId.get(p.storyId))
    .filter((s): s is PublicStory => s !== undefined && s.id !== lead?.id)
    .slice(0, POPULAR_COUNT);
  const rail: HomeFeed["rail"] =
    (popular[0]?.views ?? 0) >= POPULAR_MIN_TOP_VIEWS && popularStories.length > 0
      ? { title: "Popular", stories: popularStories }
      : { title: "Latest", stories: rest.slice(0, POPULAR_COUNT) };

  const inRail = new Set(rail.stories.map((s) => s.id));
  const latest = rest.filter((s) => !inRail.has(s.id)).slice(0, LATEST_COUNT);

  const beatWindowMs = BEAT_WINDOW_DAYS * 24 * HOUR_MS;
  const beatSections = beats
    .map((beat) => ({
      slug: beat.slug,
      name: beat.name,
      stories: rest
        .filter((s) => s.beat === beat.slug && isWithin(s.publishedAt, now, beatWindowMs))
        .slice(0, STORIES_PER_BEAT),
    }))
    .filter((section) => section.stories.length > 0);

  const tickerWindowMs = TICKER_WINDOW_DAYS * 24 * HOUR_MS;
  const counts = new Map<string, number>();
  for (const s of sorted) {
    if (!isWithin(s.publishedAt, now, tickerWindowMs)) continue;
    for (const slug of new Set(known(toolSlugsByStory.get(s.id)))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  const ranked = [...counts]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

  return {
    lead,
    leadToolSlugs: lead ? known(toolSlugsByStory.get(lead.id)) : [],
    rail,
    beats: beatSections,
    latest,
    ticker: ranked.length >= TICKER_MIN_TOOLS ? ranked.slice(0, TICKER_MAX_TOOLS) : [],
  };
}
```

- [ ] **Step 6: The loader**

```ts
// src/lib/news/home.ts
import { getAllTools } from "@/lib/content";
import { buildHomeFeed, type HomeFeed } from "@/lib/news/home-feed";
import {
  getPopularStoryViews,
  getToolSlugsForStories,
  listRecentStories,
} from "@/lib/news/stories";

/** Loads the homepage's data in three parallel reads, then builds every section. */
export async function getHomeFeed(now: Date = new Date()): Promise<HomeFeed> {
  const stories = await listRecentStories();
  const [toolSlugsByStory, popular, tools] = await Promise.all([
    getToolSlugsForStories(stories.map((s) => s.id)),
    stories.length > 0 ? getPopularStoryViews() : Promise.resolve([]),
    getAllTools(),
  ]);
  return buildHomeFeed({
    stories,
    toolSlugsByStory,
    popular,
    knownToolSlugs: new Set(tools.map((t) => t.slug)),
    now,
  });
}
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `pnpm vitest run src/lib/news && pnpm typecheck`
Expected: all pass. If the stub lacks `in`, it doesn't: `in` is already in `queryStub`'s method list.

- [ ] **Step 8: Commit**

```bash
git add src/lib/news/stories.ts src/lib/news/stories.test.ts src/lib/news/home-feed.ts src/lib/news/home-feed.test.ts src/lib/news/home.ts
git commit -m "feat(news): homepage feed rules, tested, over three parallel reads"
```

---

### Task 3: Navigation: the header and the beat row

**Files:**
- Create: `src/lib/nav.ts`, `src/lib/nav.test.ts`
- Create: `src/components/news/beat-row.tsx`, `src/components/news/beat-row.test.tsx`
- Modify: `src/lib/site.ts` (the `nav` array), `src/components/layout/site-header.tsx` (the `isActive` callback)
- Modify: `src/components/news/news-archive.tsx`, `src/app/news/[slug]/page.tsx`

**Interfaces:**
- Consumes: `beats` and `getBeat` (`@/data/beats`)
- Produces:
  - `isNavActive(href: string, pathname: string): boolean`
  - `activeBeatFor(pathname: string): BeatSlug | "latest" | null`
  - `BeatRow({ className?: string })`, a client component that Task 5 places on the homepage

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/nav.test.ts
import { describe, it, expect } from "vitest";
import { activeBeatFor, isNavActive } from "@/lib/nav";

describe("isNavActive", () => {
  it.each([
    ["/", "/", true],
    ["/", "/news", true],
    ["/", "/news/beat/research", true],
    ["/", "/news/some-story-31fc2b", true],
    ["/", "/newsletter", false],
    ["/", "/tools", false],
    ["/tools", "/tools", true],
    ["/tools", "/tools/cursor", true],
    ["/tools", "/news", false],
    ["/deals", "/deals", true],
    ["/finder", "/finder/results", true],
  ])("%s on %s is %s", (href, pathname, expected) => {
    expect(isNavActive(href, pathname)).toBe(expected);
  });
});

describe("activeBeatFor", () => {
  it.each([
    ["/", "latest"],
    ["/news", "latest"],
    ["/news/page/2", "latest"],
    ["/news/beat/research", "research"],
    ["/news/beat/sports", null],
    ["/news/some-story-31fc2b", null],
    ["/tools", null],
  ])("%s → %s", (pathname, expected) => {
    expect(activeBeatFor(pathname)).toBe(expected);
  });
});
```

```tsx
// src/components/news/beat-row.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const pathname = vi.fn(() => "/news/beat/research");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

const { BeatRow } = await import("@/components/news/beat-row");

afterEach(cleanup);

describe("BeatRow", () => {
  it("links Latest, the five beats and the directory", () => {
    render(<BeatRow />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/news",
      "/news/beat/models-labs",
      "/news/beat/products-launches",
      "/news/beat/funding-business",
      "/news/beat/policy-safety",
      "/news/beat/research",
      "/tools",
    ]);
  });

  it("marks the current beat, and only it", () => {
    render(<BeatRow />);
    const current = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual(["Research"]);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/nav.test.ts src/components/news/beat-row.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/nav.ts
import { getBeat, type BeatSlug } from "@/data/beats";

/**
 * Whether a header nav item is the current section. "News" is the homepage
 * (href "/"), and it stays active across every /news page too.
 */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname === "/news" || pathname.startsWith("/news/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Which beat row item is current: "latest" for the homepage and /news pages. */
export function activeBeatFor(pathname: string): BeatSlug | "latest" | null {
  if (pathname === "/" || pathname === "/news" || pathname.startsWith("/news/page/")) {
    return "latest";
  }
  const match = /^\/news\/beat\/([a-z-]+)$/.exec(pathname);
  return match ? (getBeat(match[1])?.slug ?? null) : null;
}
```

```tsx
// src/components/news/beat-row.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { beats } from "@/data/beats";
import { Icon } from "@/components/shared/icon";
import { activeBeatFor } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "latest", name: "Latest", href: "/news" },
  ...beats.map((beat) => ({ key: beat.slug, name: beat.name, href: `/news/beat/${beat.slug}` })),
];

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors";

/**
 * The news beat row (spec §7.1). A client component only for usePathname,
 * which renders identically on the server and client. It scrolls sideways on
 * narrow screens, so it is exempt from the visual sweep's clipping check.
 */
export function BeatRow({ className }: { className?: string }) {
  const active = activeBeatFor(usePathname());
  return (
    <nav aria-label="News beats" data-sweep-ignore className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {ITEMS.map((item) => {
          const current = active === item.key;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  pill,
                  current
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
                )}
              >
                {item.name}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/tools"
            className={cn(pill, "border-transparent text-muted-foreground hover:text-foreground")}
          >
            Directory
            <Icon name="ArrowRight" className="size-3" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Change the header nav.** In `src/lib/site.ts`, replace the `nav` array with:

```ts
  nav: [
    { title: "News", href: "/" },
    { title: "Tools", href: "/tools" },
    { title: "Finder", href: "/finder" },
    { title: "Deals", href: "/deals" },
  ],
```

Categories, Compare and Leaderboards stay reachable from the footer's Explore links, and from `/tools` after Task 4.

In `src/components/layout/site-header.tsx`:
- add `import { isNavActive } from "@/lib/nav";`
- replace the body of the `isActive` `useCallback` with `(href: string) => isNavActive(href, pathname)`, keeping `[pathname]` as its dependency array

Change nothing else in the header.

- [ ] **Step 5: Use `BeatRow` on the news pages**
- **`src/components/news/news-archive.tsx`:**
  - replace the whole `<nav aria-label="Beats" ...>...</nav>` block with `<BeatRow className="pt-2" />`
  - add `import { BeatRow } from "@/components/news/beat-row";`
  - remove the imports that are now unused (`Link`, `beats`, `cn`, and `BeatSlug` if unused)
  - keep the `activeBeat` prop; it still controls `showBeat`
- **`src/app/news/[slug]/page.tsx`:** add `import { BeatRow } from "@/components/news/beat-row";`, and render `<BeatRow className="mb-2" />` as the first child of the `<header>` element, above the breadcrumb `<nav>`.

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `pnpm vitest run src/lib/nav.test.ts src/components/news src/lib/site.test.ts && pnpm typecheck && pnpm lint`
Expected: all pass. If `src/lib/site.test.ts` asserts the old nav items, update only those assertions to the new four items, and report it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts src/components/news/beat-row.tsx src/components/news/beat-row.test.tsx src/lib/site.ts src/components/layout/site-header.tsx src/components/news/news-archive.tsx "src/app/news/[slug]/page.tsx"
git commit -m "feat(nav): News, Tools, Finder, Deals, and a beat row across the news pages"
```

If `site.test.ts` changed, add it to the `git add` as well.

---

### Task 4: `/tools` becomes the directory's front door

**Files:**
- Modify: `src/app/tools/page.tsx`
- Modify: `src/components/home/oracle-hero.tsx` (one `href`)
- Modify: `src/components/layout/site-footer.tsx` (one `href`)
- Modify: `tests/e2e/directory.spec.ts` (move the hero test to `/tools`)

**Interfaces:**
- Consumes these existing, unchanged components:
  - `OracleHero({ toolCount })`, `FeaturedToolCard({ tool, categoryName })`, `CategoryTile({ category })` and `FinderCta()` from `src/components/home/*`
  - `SectionHeading`, `Reveal`, `Icon`, `Container`, `DirectoryExplorer`
  - `getAllTools`, `getCategories`, `getFeaturedTools`, `getStats`, `getAllTags`
- Produces:
  - `/tools` with the anchors `#directory` and `#how-we-vet`
  - the old homepage sections now live here, and Task 5 deletes them from `/`

- [ ] **Step 1: Rewrite `src/app/tools/page.tsx`**

The `vetSteps` array, the preload `<link>` and its comment, and the Featured, Categories and How I vet sections move verbatim from the current `src/app/page.tsx`. **Copy them from that file**, don't retype them. Changes from the originals:
- the directory header's `h1` becomes an `h2`, because the hero now owns the page's `h1`
- the Featured section's "View all tools" link is removed, since it would point at this same page
- the final "Explore the directory" CTA section is not carried over (plan deviation 5)

```tsx
// src/app/tools/page.tsx
import type { Metadata } from "next";
import { OracleHero } from "@/components/home/oracle-hero";
import { FeaturedToolCard } from "@/components/home/featured-tool-card";
import { CategoryTile } from "@/components/home/category-tile";
import { FinderCta } from "@/components/home/finder-cta";
import { DirectoryExplorer } from "@/components/directory/directory-explorer";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { Icon } from "@/components/shared/icon";
import { getAllTools, getCategories, getFeaturedTools, getStats } from "@/lib/content";
import { getAllTags } from "@/lib/filters";

export const metadata: Metadata = {
  title: "AI Tool Directory",
  description:
    "Browse and filter Enki's curated directory of human-vetted AI tools: search by name, use case, category, pricing, and rating.",
  alternates: { canonical: "/tools" },
};

// const vetSteps = [ ...copied verbatim from src/app/page.tsx... ] as const;

export default async function ToolsPage() {
  const [tools, categories, featuredAll, stats] = await Promise.all([
    getAllTools(),
    getCategories(),
    getFeaturedTools(),
    getStats(),
  ]);
  const tags = getAllTags(tools);
  const featured = featuredAll.slice(0, 6);
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      {/* <link rel="preload" ... /> copied verbatim, WITH its explanatory comment, from src/app/page.tsx */}

      <OracleHero toolCount={stats.toolCount} />

      <section id="directory" className="scroll-mt-24 py-16 sm:py-20">
        <Container>
          <header className="mb-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
              <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
              The directory
            </span>
            <h2 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
              Every tool, vetted
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              {tools.length} AI tools across {categories.length} categories. Search, filter, and
              sort to find the one worth your trust.
            </p>
          </header>

          <DirectoryExplorer tools={tools} categories={categories} tags={tags} />
        </Container>
      </section>

      {/* Featured tools: the section from src/app/page.tsx, minus its "View all tools" Link. */}

      <FinderCta />

      {/* Categories: the section from src/app/page.tsx, verbatim. */}

      {/* How I vet: the section with id="how-we-vet" from src/app/page.tsx, verbatim,
          including the trust-stats grid and its comment. */}
    </>
  );
}

// function StatCell(...) copied verbatim from src/app/page.tsx
```

Replace every `// ...copied...` and `{/* ... */}` placeholder above with the real code copied from `src/app/page.tsx` as it is at the start of this task. The finished file must contain no placeholder comments. It still needs `Link` imported if the copied Categories or How I vet sections use it; check for this.

- [ ] **Step 2: Point the hero and footer at `/tools`.**
  - In `src/components/home/oracle-hero.tsx`, the "Browse the directory" `<Link href="/tools">` becomes `<Link href="#directory">`. The hero lives on `/tools` now, so it scrolls to the grid instead of reloading the page.
  - In `src/components/layout/site-footer.tsx`, the Explore link `{ title: "How I vet", href: "/#how-we-vet" }` becomes `href: "/tools#how-we-vet"`.

- [ ] **Step 3: Move the hero test.** In `tests/e2e/directory.spec.ts`, the test `"landing page loads with hero and featured tools"` becomes:

```ts
  test("the directory page opens with the hero and featured tools", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI tools");
    await expect(page.getByRole("heading", { name: "Featured tools" })).toBeVisible();
  });
```

- [ ] **Step 4: Check.**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean, with `/tools` still in the route list.

Then prove the directory is still in the server-rendered HTML, which is the roadmap 0.2 guarantee:
- run `npx next start -p 3300`
- run `curl -s localhost:3300/tools | grep -o 'href="/tools/[a-z0-9-]*"' | sort -u | wc -l`; expect more than 25
- stop the server

- [ ] **Step 5: Commit**

```bash
git add src/app/tools/page.tsx src/components/home/oracle-hero.tsx src/components/layout/site-footer.tsx tests/e2e/directory.spec.ts
git commit -m "feat(tools): the oracle hero and directory showcase move to /tools"
```

---

### Task 5: The homepage

**Files:**
- Create in `src/components/front-page/`:
  - `story-image.tsx`
  - `ticker-strip.tsx`
  - `compact-story-list.tsx`
  - `lead-story.tsx`
  - `story-rail.tsx`
  - `beat-section.tsx`
  - `find-tool-button.tsx`
  - `home-sidebar.tsx`
  - `directory-band.tsx`
- Replace: `src/app/page.tsx`
- Modify: `src/app/admin/news/actions.ts`, `src/app/admin/news/actions.test.ts`
- Modify: `tests/e2e/directory.spec.ts` (add a homepage test)

**Interfaces:**
- Consumes:
  - `getHomeFeed(now)` and `HomeFeed` (Task 2)
  - `BeatRow` (Task 3)
  - `PublicStory`, `formatAge`, `ToolCard({ tool })`, `EditorScore({ value })`
  - `useCommandMenu().setOpen(open: boolean)` from `@/components/layout/command-menu`
  - `ShortcutHint({ keyName: string; className? })`
  - `getAllTools`, `getFeaturedTools`, `getStats()` (returns `{ toolCount, categoryCount, ... }`)
- Produces: the new `/`.

UI only: the logic is Task 2's. The gate is typecheck, lint, build, the end-to-end test and Task 6's sweep.

- [ ] **Step 1: Leaf components**

```tsx
// src/components/front-page/story-image.tsx
import { cn } from "@/lib/utils";

/**
 * A hotlinked feed image over a gradient. Decorative (alt=""): a failed load
 * leaves the gradient showing, never a broken-image icon, and needs no client
 * JavaScript (plan deviation 3). next/image is not used because feed images
 * come from arbitrary publisher hosts.
 */
export function StoryImage({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br from-teal/20 to-card", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
```

```tsx
// src/components/front-page/compact-story-list.tsx
import Link from "next/link";
import { formatAge } from "@/lib/news/format-age";
import type { PublicStory } from "@/lib/news/stories";

export function CompactStoryList({
  stories,
  now,
  numbered = false,
}: {
  stories: PublicStory[];
  now: Date;
  numbered?: boolean;
}) {
  return (
    <ol className="flex flex-col divide-y divide-border">
      {stories.map((story, i) => (
        <li key={story.id} className="flex gap-3 py-3">
          {numbered ? (
            <span className="font-display text-lg leading-none text-teal tabular-nums">{i + 1}</span>
          ) : null}
          <Link href={`/news/${story.slug}`} className="group flex min-w-0 flex-col gap-1">
            <span className="leading-snug font-medium break-words text-pretty group-hover:text-teal">
              {story.headline}
            </span>
            <span className="font-mono text-xs break-words text-muted-foreground">
              {story.sourceName} · {formatAge(story.sourcePublishedAt ?? story.publishedAt, now)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

```tsx
// src/components/front-page/ticker-strip.tsx
import Link from "next/link";
import type { Tool } from "@/lib/schemas";

/** "Tools in the news" (spec §7.2). The caller passes nothing when fewer than 3 qualify. */
export function TickerStrip({ items }: { items: { tool: Tool; count: number }[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Tools in the news"
      className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 ring-hairline"
    >
      <span className="shrink-0 font-mono text-[0.65rem] tracking-[0.2em] text-teal uppercase">
        Tools in the news
      </span>
      <div data-sweep-ignore className="min-w-0 flex-1 overflow-x-auto">
        <ul className="flex w-max gap-2">
          {items.map(({ tool, count }) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm whitespace-nowrap transition-colors hover:border-teal/40"
              >
                <span className="font-medium">{tool.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {count} {count === 1 ? "story" : "stories"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

```tsx
// src/components/front-page/find-tool-button.tsx
"use client";

import { useCommandMenu } from "@/components/layout/command-menu";
import { Icon } from "@/components/shared/icon";
import { ShortcutHint } from "@/components/shared/shortcut-hint";

/** Looks like a search field; opens the site-wide command menu. */
export function FindToolButton() {
  const { setOpen } = useCommandMenu();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-background/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
    >
      <Icon name="Search" className="size-4 text-teal" />
      <span className="flex-1">Find a tool</span>
      <ShortcutHint keyName="K" />
    </button>
  );
}
```

- [ ] **Step 2: Section components**

```tsx
// src/components/front-page/lead-story.tsx
import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import type { PublicStory } from "@/lib/news/stories";
import { formatAge } from "@/lib/news/format-age";
import { StoryImage } from "@/components/front-page/story-image";

export function LeadStory({ story, tools, now }: { story: PublicStory; tools: Tool[]; now: Date }) {
  const reportedAt = story.sourcePublishedAt ?? story.publishedAt;
  return (
    <article className="grid gap-5 rounded-2xl border border-border bg-card/60 p-5 ring-hairline sm:p-6 md:grid-cols-2">
      {story.imageUrl ? <StoryImage src={story.imageUrl} className="aspect-video w-full md:aspect-auto md:min-h-56" /> : null}
      <div className={story.imageUrl ? "flex flex-col gap-3" : "flex flex-col gap-3 md:col-span-2"}>
        <p className="font-mono text-xs tracking-wide text-teal uppercase">{story.beatName}</p>
        <h2 className="font-display text-2xl leading-tight font-semibold break-words text-balance sm:text-3xl">
          <Link href={`/news/${story.slug}`} className="hover:text-teal">
            {story.headline}
          </Link>
        </h2>
        <p className="text-pretty text-muted-foreground">{story.summary}</p>
        <p className="font-mono text-xs break-words text-muted-foreground">
          {story.sourceName} · {formatAge(reportedAt, now)}
        </p>
        {tools.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="inline-flex rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs text-teal transition-colors hover:bg-teal/20"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
```

```tsx
// src/components/front-page/story-rail.tsx
import type { PublicStory } from "@/lib/news/stories";
import { CompactStoryList } from "@/components/front-page/compact-story-list";

/** Popular, or Latest until Popular has real traffic (spec §7.3). */
export function StoryRail({ title, stories, now }: { title: "Popular" | "Latest"; stories: PublicStory[]; now: Date }) {
  if (stories.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
      <h2 className="font-mono text-xs tracking-[0.2em] text-teal uppercase">{title}</h2>
      <CompactStoryList stories={stories} now={now} numbered={title === "Popular"} />
    </section>
  );
}
```

```tsx
// src/components/front-page/beat-section.tsx
import Link from "next/link";
import type { PublicStory } from "@/lib/news/stories";
import { Icon } from "@/components/shared/icon";
import { StoryImage } from "@/components/front-page/story-image";
import { CompactStoryList } from "@/components/front-page/compact-story-list";

export function BeatSection({
  slug,
  name,
  stories,
  now,
}: {
  slug: string;
  name: string;
  stories: PublicStory[];
  now: Date;
}) {
  const [first, ...others] = stories;
  if (!first) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold">
        <Link href={`/news/beat/${slug}`} className="inline-flex items-center gap-1 hover:text-teal">
          {name}
          <Icon name="ChevronRight" className="size-4" />
        </Link>
      </h2>
      {first.imageUrl ? <StoryImage src={first.imageUrl} className="aspect-video w-full" /> : null}
      <Link
        href={`/news/${first.slug}`}
        className="font-display text-lg leading-snug font-semibold break-words text-pretty hover:text-teal"
      >
        {first.headline}
      </Link>
      {others.length > 0 ? <CompactStoryList stories={others} now={now} /> : null}
    </section>
  );
}
```

```tsx
// src/components/front-page/home-sidebar.tsx
import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { EditorScore } from "@/components/shared/editor-score";
import { Icon } from "@/components/shared/icon";
import { FindToolButton } from "@/components/front-page/find-tool-button";
import { cn } from "@/lib/utils";

export function HomeSidebar({ topTools, className }: { topTools: Tool[]; className?: string }) {
  return (
    <aside className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 ring-hairline", className)}>
      <FindToolButton />
      <h2 className="font-mono text-xs tracking-[0.2em] text-teal uppercase">From the directory</h2>
      <ul className="flex flex-col divide-y divide-border">
        {topTools.map((tool) => (
          <li key={tool.slug} className="flex items-center justify-between gap-3 py-2.5">
            <Link href={`/tools/${tool.slug}`} className="min-w-0 truncate font-medium hover:text-teal">
              {tool.name}
            </Link>
            <EditorScore value={tool.editorScore} />
          </li>
        ))}
      </ul>
      <Link href="/finder" className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal-bright">
        Ask the oracle
        <Icon name="ArrowRight" className="size-3.5" />
      </Link>
    </aside>
  );
}
```

```tsx
// src/components/front-page/directory-band.tsx
import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { ToolCard } from "@/components/shared/tool-card";

const secondary =
  "inline-flex items-center rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground";

export function DirectoryBand({
  toolCount,
  categoryCount,
  featured,
}: {
  toolCount: number;
  categoryCount: number;
  featured: Tool[];
}) {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border bg-card px-6 py-10 ring-hairline sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">The directory</p>
          <h2 className="font-display text-3xl font-semibold text-balance">
            {toolCount} AI tools, vetted and scored
          </h2>
          <p className="text-pretty text-muted-foreground">
            Across {categoryCount} categories, each with an editor score.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tools"
            className="inline-flex items-center rounded-full bg-teal px-5 py-2 text-sm font-semibold text-[#04171a] transition-colors hover:bg-teal-bright"
          >
            Explore the directory
          </Link>
          <Link href="/categories" className={secondary}>
            Categories
          </Link>
          <Link href="/finder" className={secondary}>
            Ask the oracle
          </Link>
        </div>
      </div>
      {featured.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: The page.** Replace `src/app/page.tsx` entirely. The old sections now live on `/tools` (Task 4):

```tsx
// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { BeatRow } from "@/components/news/beat-row";
import { TickerStrip } from "@/components/front-page/ticker-strip";
import { LeadStory } from "@/components/front-page/lead-story";
import { StoryRail } from "@/components/front-page/story-rail";
import { HomeSidebar } from "@/components/front-page/home-sidebar";
import { BeatSection } from "@/components/front-page/beat-section";
import { CompactStoryList } from "@/components/front-page/compact-story-list";
import { DirectoryBand } from "@/components/front-page/directory-band";
import { getHomeFeed } from "@/lib/news/home";
import { getAllTools, getFeaturedTools, getStats } from "@/lib/content";
import type { Tool } from "@/lib/schemas";

// Rendered on demand and cached; publishing a story revalidates "/".
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const now = new Date();
  const [feed, allTools, featuredAll, stats] = await Promise.all([
    getHomeFeed(now),
    getAllTools(),
    getFeaturedTools(),
    getStats(),
  ]);

  const bySlug = new Map(allTools.map((tool) => [tool.slug, tool]));
  const resolve = (slugs: string[]) =>
    slugs.map((slug) => bySlug.get(slug)).filter((tool): tool is Tool => tool !== undefined);
  const ticker = feed.ticker.flatMap(({ slug, count }) => {
    const tool = bySlug.get(slug);
    return tool ? [{ tool, count }] : [];
  });
  const topTools = [...allTools].sort((a, b) => b.editorScore - a.editorScore).slice(0, 5);
  const hasRail = feed.rail.stories.length > 0;

  return (
    <Container className="flex flex-col gap-8 pt-28 pb-20">
      <h1 className="sr-only">AI news, curated by Enki</h1>
      <BeatRow />

      {feed.lead ? (
        <>
          <TickerStrip items={ticker} />

          <div
            className={
              hasRail
                ? "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            }
          >
            <LeadStory story={feed.lead} tools={resolve(feed.leadToolSlugs)} now={now} />
            <StoryRail title={feed.rail.title} stories={feed.rail.stories} now={now} />
            {/* Desktop position; on phones the sidebar comes after the beats (spec §7.7). */}
            <HomeSidebar topTools={topTools} className="hidden lg:flex" />
          </div>

          {feed.beats.length > 0 || feed.latest.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {feed.beats.map((beat) => (
                <BeatSection key={beat.slug} slug={beat.slug} name={beat.name} stories={beat.stories} now={now} />
              ))}
              {feed.latest.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h2 className="font-display text-xl font-semibold">Latest</h2>
                  <CompactStoryList stories={feed.latest} now={now} />
                  <Link href="/news" className="text-sm text-teal hover:text-teal-bright">
                    All news
                  </Link>
                </section>
              ) : null}
            </div>
          ) : null}

          <HomeSidebar topTools={topTools} className="lg:hidden" />
        </>
      ) : (
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
          The first stories are coming soon. Meanwhile, the directory is below.
        </p>
      )}

      <DirectoryBand
        toolCount={stats.toolCount}
        categoryCount={stats.categoryCount}
        featured={featuredAll.slice(0, 3)}
      />
    </Container>
  );
}
```

- [ ] **Step 4: Revalidate the homepage on publish.** In `src/app/admin/news/actions.ts`, in both `publishStory` and `setStoryStatus`, add `revalidatePath("/");` directly after the existing `revalidatePath("/news", "layout");`.

In `src/app/admin/news/actions.test.ts`, add `expect(revalidatePath).toHaveBeenCalledWith("/");` to:
- the test `"publishes through the guarded RPC with a generated slug"`
- the test `"refreshes public news pages when a story is unpublished"`

- [ ] **Step 5: A homepage end-to-end test.** Add to the `"Enki critical flow"` describe block in `tests/e2e/directory.spec.ts`:

```ts
  test("the homepage is the news front page", async ({ page }) => {
    await page.goto("/");
    // CI has no database, so this holds for the empty state and a full feed alike.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/AI news/);
    await expect(page.getByRole("navigation", { name: "News beats" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /AI tools, vetted and scored/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "News", exact: true }).first()).toHaveAttribute("href", "/");
  });
```

- [ ] **Step 6: Check.**

Run: `pnpm vitest run src/app/admin/news && pnpm typecheck && pnpm lint && pnpm build`
Expected: clean.

Then run the end-to-end suite: `pnpm test:e2e`. It builds and serves on port 3100 by itself. Expected: every spec passes, including the two changed tests. If Playwright's browsers are missing, run `pnpm exec playwright install chromium` once.

Then check the new copy has no dashes. This counts em and en dashes in the new files; expect `0`:

```bash
cat src/components/front-page/*.tsx src/app/page.tsx src/components/news/beat-row.tsx | grep -c $'\xe2\x80\x94\|\xe2\x80\x93'
```

- [ ] **Step 7: Commit**

```bash
git add src/components/front-page src/app/page.tsx src/app/admin/news/actions.ts src/app/admin/news/actions.test.ts tests/e2e/directory.spec.ts
git commit -m "feat(home): the AI news front page"
```

---

### Task 6: Verification, the visual sweep and docs

**Owner: the controller.**

- [ ] **Step 1: The gates.** Run `pnpm verify && pnpm audit:rls && pnpm build`. All must be green.

- [ ] **Step 2: Sweep.** Start `preview_start` `{ name: "enki-dev" }`, then run:

```bash
MSYS_NO_PATHCONV=1 pnpm sweep -- / /tools /tools/cursor /news /news/beat/policy-safety /news/gemini-hacked-three-real-companies-during-a-cybersecurity-31fc2b /categories
```

Every pair must PASS.

- [ ] **Step 3: Look at it.** Take screenshots of `/` and `/tools` at 390px and 1440px, and check:
  - the header shows News · Tools · Finder · Deals, with News active on `/` and `/news/...`
  - the beat row marks Latest on `/`
  - with today's single story: the lead card, no ticker, no empty beat headers, the sidebar, then the directory band
  - "Find a tool" opens the command menu
  - `/tools` shows the hero, and "Browse the directory" scrolls to the grid
  - the footer's "How I vet" link lands on `/tools#how-we-vet`
  - the console shows no errors, and in particular no hydration warnings from `BeatRow` or `ShortcutHint`

- [ ] **Step 4: Docs.** Update `handoff.md` §0:
  - merge 3 done
  - the `popular_stories` function in §4
  - `/tools` now hosts the hero

  Then commit:

```bash
git add handoff.md
git commit -m "docs(handoff): merge 3 news homepage"
```

- [ ] **Step 5: Stop the dev server.** Do not push unless the owner asks.

**Before pushing, the owner should know:** with one published story, the live homepage is a single lead card and the directory band. Publishing a batch of stories first makes the launch look like a news site rather than a placeholder.
