# News Public Pages Implementation Plan (merge 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put published news stories on the public site:
- a story page at `/news/[slug]`, with the stories' affiliate tool cards
- the `/news` archive and five beat pages
- the "How Enki covers news" page
- anonymous view counting for the future Popular rail
- sitemap entries for indexable stories
- cache refresh whenever a story is published

**Architecture:**
- **Reads.** Public pages read published stories through a small server-side
  layer (`src/lib/news/stories.ts`) on the cookieless anon client. RLS already
  limits anon to `status = 'published'`.
- **Rendering.** Pages are server components, rendered on demand and cached
  (ISR, `revalidate = 300`). Admin publish and unpublish also call
  `revalidatePath("/news", "layout")`.
- **Source names.** These are copied onto each story at ingest, so no grant on
  the admin-only `news_sources` changes.
- **Views.** A tiny client component POSTs once per story per browser session
  to a rate-limited route that inserts into an anon-insert-only table.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4,
Supabase (Postgres + RLS), Zod v4, Vitest + Testing Library, `next/og`, Vercel
Firewall rate limiting (`@vercel/firewall`).

**Spec:** `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md`. Read **§0
Amendments first**; they override §6.1 and §6.3. This plan implements §6.1–6.3
and the merge-2 parts of §8.2 (sitemap), §9 and §10, following §0 amendments 1–4.

## Global Constraints

- **No em dash (U+2014) or en dash (U+2013)** in any user-facing string this
  plan adds. Use commas, colons or full stops.
- **Byline:** story pages say exactly `Summary by Enki`. No copy anywhere may
  claim who writes summaries or takes, and there is no AI disclosure (§0
  amendments 1–2).
- **The publisher excerpt is never rendered publicly.** No public code path may
  query `story_excerpts`.
- **Indexing:** a story page is `noindex, follow` unless its take is 300+
  characters. Use `isIndexableTake` from `src/lib/news/schemas.ts`, never a
  hand-written length check.
- **Links:**
  - tool CTAs go through `outboundHref(slug)` (`/go/[slug]`), with `rel`
    `sponsored noopener noreferrer` when `resolveOutboundTarget(tool).isAffiliate`,
    otherwise `noopener noreferrer`
  - the source link is a plain external link, `target="_blank"
    rel="noopener noreferrer"`
- **No `useSearchParams` on any public news page.** Filters and pages are path
  segments (roadmap 0.2: it makes crawlers see empty HTML).
- **Relative times** (`formatAge`) are computed in server components only
  (hydration mismatches have cost this project 9 times).
- **Anonymous writes** use `.insert()`, never `.upsert()`, and every new
  anonymous write path is added to `src/lib/supabase/anon-writes.test.ts`.
- **Supabase:**
  - every new table or function does `revoke all ... from public, anon,
    authenticated` before its own grants
  - a function parameter never shares a name with a column it touches (`p_*`)
- **Git:** work on `main`, no branches or worktrees, never push. Commit messages
  end with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
  The pre-commit hook runs `pnpm verify`; never use `--no-verify`. If `tsc` fails
  on a stale `.next/types/*` file for a page that no longer exists, delete
  `.next` and retry.

## Review Focus

1. **A story is unpublished after being shared.** `/news/<slug>` must 404 on the
   next request after revalidation, not keep serving the cached page. Covered by
   the `status = 'published'` filter (Task 2 test) plus
   `revalidatePath("/news", "layout")` on unpublish (Task 6 test).
2. **Hostile or odd page numbers** (`/news/page/0`, `/1`, `/abc`, `/007`,
   `/99999`) must 404, never render an empty or duplicate page. Page 1 lives only
   at `/news`. Covered by `parsePageParam` tests (Task 2) and the range check in
   Task 4.
3. **The database is paused or slow** (free tier auto-pauses). Archive pages must
   render their empty state, not throw; a story page must 404. Covered by the
   error and timeout tests in Task 2.
4. **A story links a tool that is no longer in the directory** (slug removed or
   renamed). The tool card is skipped, the rest of the page renders. Covered in
   Task 2.
5. **Long unbroken headlines, source names or URLs at 390px** must wrap rather
   than overflow or clip. Covered by `break-words` classes in Tasks 3–4 and by
   the visual sweep in Task 7.

---

## Deviations from the spec (deliberate)

1. **Source names are copied onto stories** (`source_name`, `source_site_url`),
   per the corrected §0 amendment 4.
2. **Beat pages are not paginated.** They show the latest 30 stories. At about
   5–15 stories a day across five beats, 30 covers more than a week per beat.
   Add `/news/beat/[beat]/page/[n]` when one fills up.
3. **Archive pages 2 and up are `noindex, follow`.** They keep crawl paths to
   every story without competing with `/news` for rankings. `/news` and the beat
   pages are indexable.
4. **No end-to-end test for story pages.** CI runs Playwright without Supabase
   credentials, so the content layer falls back to seed data, and stories have
   no seed. Story pages are covered by unit tests plus the visual sweep against
   the real database (Task 7).
5. **The story page shows no hero image.** Spec §6.1 lists none, and feed images
   are hotlinked. Images arrive with the homepage (merge 3, spec §7.5).

## File map

| File | Responsibility |
|---|---|
| (Supabase migration `news_public_pages`) | `stories.source_name`/`source_site_url` + backfill; `ingest_story` fills them; `story_views` table |
| `src/lib/supabase/database.types.ts` | Types for the new columns and `story_views` |
| `scripts/audit-rls/expectations.mjs` (+ test) | `story_views` is anon-invisible |
| `src/lib/news/story-meta.ts` (+ test) | Pure helpers: robots, page parsing and ranges, constants |
| `src/lib/structured-data.ts` (+ test) | `newsArticleJsonLd` |
| `src/lib/news/stories.ts` (+ test) | Public read layer over published stories |
| `src/components/news/story-tool-card.tsx` | Compact tool card with a `/go` CTA |
| `src/components/news/story-list.tsx` | Headline list used by archive, beat and "More in" |
| `src/components/news/news-pagination.tsx` | Older/Newer links |
| `src/components/news/story-view-ping.tsx` (+ test) | Client: one view POST per story per session |
| `src/app/news/[slug]/page.tsx` | Story page |
| `src/app/news/[slug]/opengraph-image.tsx`, `twitter-image.tsx` | Social card |
| `src/app/news/page.tsx` | Archive page 1 |
| `src/app/news/page/[page]/page.tsx` | Archive pages 2+ |
| `src/app/news/beat/[beat]/page.tsx` | Beat pages |
| `src/app/news/about/page.tsx` | "How Enki covers news" |
| `src/app/api/story-view/route.ts` (+ test) | Rate-limited view insert |
| `src/lib/rate-limit.ts` (+ test) | New write path `story-view` |
| `src/lib/supabase/anon-writes.test.ts` | Adds the new write path |
| `src/app/privacy/page.tsx` | One sentence about story views |
| `src/app/sitemap.ts` | News routes and indexable stories; hourly revalidation |
| `src/app/admin/news/actions.ts` (+ test) | Revalidate `/news` on publish and status change |

---

### Task 1: Database: source names on stories, and the `story_views` table

**Owner: the controller**, via the Supabase MCP connector (project
`qknsqurdawglctwqfwxe`). A subagent may do the type and audit edits in Steps 5–7.

**Files:**
- Migration via MCP `apply_migration`, name `news_public_pages`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `scripts/audit-rls/expectations.mjs`, `scripts/audit-rls/expectations.test.mjs`

**Interfaces:**
- Produces:
  - `stories.source_name text not null` and `stories.source_site_url text not null`
    (http(s)), readable by anon for published rows
  - table `story_views(id bigint identity, story_id uuid → stories, created_at)`.
    Anon and authenticated may `insert (story_id)` only for published stories;
    only admins can select.
  - `ingest_story(...)`: same signature and grants as before; now also fills the
    two source columns.

- [ ] **Step 1: Confirm the project is awake.** Run `pnpm run doctor`; the `supabase` line must read PASS.

- [ ] **Step 2: Apply the migration** (MCP `apply_migration`, name `news_public_pages`)

```sql
-- 1. Source name and site URL on stories (spec §0 amendment 4).
alter table public.stories
  add column source_name text,
  add column source_site_url text;

update public.stories s
   set source_name = ns.name,
       source_site_url = ns.site_url
  from public.news_sources ns
 where ns.id = s.source_id;

alter table public.stories
  alter column source_name set not null,
  alter column source_site_url set not null,
  add constraint stories_source_site_url_check check (source_site_url ~ '^https?://');

-- 2. ingest_story copies them at insert. Same signature, so existing grants are
--    kept. Parameters stay p_* (a parameter must never share a column's name).
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

  insert into public.stories (
    source_id, source_name, source_site_url, source_url, headline, image_url, source_published_at
  )
  select ns.id, ns.name, ns.site_url, p_source_url, left(btrim(p_headline), 300),
         case when p_image_url ~ '^https://' then left(p_image_url, 2000) end,
         p_source_published_at
    from public.news_sources ns
   where ns.id = p_source_id
  on conflict (source_url) do nothing
  returning id into v_id;

  if v_id is null then
    return false; -- unknown source, or already queued, published or rejected
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

-- 3. story_views: anonymous view log for the Popular rail. Stores no visitor data.
create table public.story_views (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index story_views_story_created_idx on public.story_views (story_id, created_at desc);
alter table public.story_views enable row level security;
revoke all on public.story_views from public, anon, authenticated;
grant insert (story_id) on public.story_views to anon, authenticated;
grant select on public.story_views to authenticated;
-- The subquery runs under the caller's own RLS on stories, so anon can only ever
-- see (and therefore count views for) published stories.
create policy "views only of published stories" on public.story_views
  for insert to anon, authenticated
  with check (exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));
create policy "admins read story views" on public.story_views
  for select to authenticated using (public.is_admin());
```

- [ ] **Step 3: Verify the backfill and the grants** (MCP `execute_sql`)

```sql
select count(*) filter (where source_name is null or source_site_url is null) as missing,
       count(*) as total
  from public.stories;
```
Expected: `missing = 0`.

```sql
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'story_views'
   and grantee in ('anon', 'authenticated')
 group by 1, 2 order by 2;

select grantee, privilege_type, column_name
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'story_views'
   and grantee in ('anon', 'authenticated')
 order by grantee, column_name;

select proname, proacl::text from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'ingest_story';
```
Expected:
- **Table grants:** only `authenticated | SELECT`, since INSERT is column-level.
- **Column grants:** `INSERT` on `story_id` for both anon and authenticated.
- **`ingest_story` ACL:** unchanged, with anon and authenticated executable and
  no `=X/` PUBLIC entry.

- [ ] **Step 4: Prove the gate lets through what it should and blocks what it
  shouldn't** (MCP `execute_sql`, each block separately). Get a pending id first:
  `select id from public.stories where status = 'pending' limit 1;`

```sql
begin;
set local role anon;
insert into public.story_views (story_id)
select id from public.stories where slug = 'gemini-hacked-three-real-companies-during-a-cybersecurity-31fc2b';
rollback;
```
Expected: `INSERT 0 1` (a published story).

```sql
begin;
set local role anon;
insert into public.story_views (story_id) values ('<the pending id>');
rollback;
```
Expected: ERROR `new row violates row-level security policy for table "story_views"`.

```sql
begin;
set local role anon;
select count(*) from public.story_views;
rollback;
```
Expected: ERROR permission denied, or a count of 0.

Then run MCP `get_advisors` (security). Expected: no new warning naming
`story_views`, and no "function search_path mutable" for `ingest_story`.

- [ ] **Step 5: Types.** In `src/lib/supabase/database.types.ts`:
  - add `source_name: string` and `source_site_url: string` to the `stories` `Row`
  - add after `story_tools`:

```ts
      /** Anonymous view log. Anon may insert (story_id) for published stories only; admins read. */
      story_views: {
        Row: { id: number; story_id: string; created_at: string }
        Insert: { story_id: string }
        Update: { [_ in never]: never }
        Relationships: []
      }
```

- [ ] **Step 6: RLS audit expectation, test first.** In `scripts/audit-rls/expectations.test.mjs`, change the expected `ANON_INVISIBLE_TABLES` list to:

```js
    expect(ANON_INVISIBLE_TABLES).toEqual([
      "admins",
      "collections",
      "news_sources",
      "outbound_clicks",
      "profiles",
      "reviews",
      "story_excerpts",
      "story_views",
      "subscribers",
      "tool_submissions",
    ]);
```

Run `pnpm vitest run scripts/audit-rls` and watch it fail. Then add `"story_views",` after `"story_excerpts",` in `ANON_INVISIBLE_TABLES` in `expectations.mjs`, and watch it pass.

- [ ] **Step 7: Live audit and commit**

Run: `pnpm typecheck && pnpm audit:rls`
Expected: typecheck clean; audit all PASS, including `story_views  refused (401)`
or `no rows`.

```bash
git add src/lib/supabase/database.types.ts scripts/audit-rls/expectations.mjs scripts/audit-rls/expectations.test.mjs
git commit -m "feat(news): public source names on stories and an anonymous story_views log"
```

---

### Task 2: The public read layer and pure helpers

**Files:**
- Create: `src/lib/news/story-meta.ts`, `src/lib/news/story-meta.test.ts`
- Create: `src/lib/news/stories.ts`, `src/lib/news/stories.test.ts`
- Modify: `src/lib/structured-data.ts` (add `newsArticleJsonLd`),
  `src/lib/structured-data.test.ts`
- Modify: `src/test/supabase-stub.ts` (add chain methods `range` and `neq`)

**Interfaces:**
- Consumes:
  - `getBeat(slug)` / `BeatSlug` from `@/data/beats`
  - `isIndexableTake(take)` from `@/lib/news/schemas`
  - `getToolBySlug(slug): Promise<Tool | undefined>` from `@/lib/content`
  - `createAnonClient()` from `@/lib/supabase/anon`
  - the Task 1 columns
- Produces (Tasks 3–6 rely on these exact names):
  - `story-meta.ts`:
    - `NEWS_PAGE_SIZE = 30`, `MORE_IN_BEAT = 5`
    - `storyRobots(take: string | null): { index: boolean; follow: true }`
    - `parsePageParam(raw: string): number | null` (an integer ≥ 2, else null)
    - `pageCount(total: number, pageSize?: number): number` (≥ 1)
    - `pageRange(page: number, pageSize?: number): { from: number; to: number }`
  - `structured-data.ts`: `newsArticleJsonLd(story: PublicStory): object`
  - `stories.ts`:
    - `type PublicStory = { id; slug; headline; summary; take: string | null;
      beat: BeatSlug; beatName: string; imageUrl: string | null; sourceName;
      sourceSiteUrl; sourceUrl; sourcePublishedAt: string | null; publishedAt:
      string; featured: boolean }`
    - `toPublicStory(row): PublicStory | null`
    - `getPublishedStory(slug): Promise<PublicStory | null>`
    - `getStoryTools(storyId): Promise<Tool[]>`
    - `listPublishedStories({ page?, beat? }): Promise<{ stories: PublicStory[]; total: number }>`
    - `listMoreInBeat(beat, excludeId): Promise<PublicStory[]>`
    - `listIndexableStories(): Promise<{ slug: string; publishedAt: string }[]>`

- [ ] **Step 1: Extend the query stub.** In `src/test/supabase-stub.ts`, add `"range"` and `"neq"` to the `methods` array in `queryStub`, after `"limit"`. This is needed by the tests below; nothing else changes.

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/news/story-meta.test.ts
import { describe, it, expect } from "vitest";
import { pageCount, pageRange, parsePageParam, storyRobots } from "@/lib/news/story-meta";

describe("storyRobots", () => {
  it("keeps a story without a take out of the index", () => {
    expect(storyRobots(null)).toEqual({ index: false, follow: true });
  });
  it("indexes a story whose take is 300+ characters", () => {
    expect(storyRobots("t".repeat(300))).toEqual({ index: true, follow: true });
    expect(storyRobots("t".repeat(299))).toEqual({ index: false, follow: true });
  });
});

describe("parsePageParam", () => {
  it.each([
    ["2", 2],
    ["10", 10],
    ["99999", 99999],
  ])("accepts %s", (raw, expected) => {
    expect(parsePageParam(raw)).toBe(expected);
  });

  it.each(["1", "0", "-2", "abc", "007", "2.5", " 2", "100000", ""])(
    "rejects %j (page 1 lives at /news)",
    (raw) => {
      expect(parsePageParam(raw)).toBeNull();
    },
  );
});

describe("pagination math", () => {
  it("never reports fewer than one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(30)).toBe(1);
    expect(pageCount(31)).toBe(2);
  });
  it("maps a page to an inclusive row range", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 29 });
    expect(pageRange(2)).toEqual({ from: 30, to: 59 });
  });
});
```

```ts
// src/lib/news/stories.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { queryStub, type StubResult } from "@/test/supabase-stub";

const from = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ from }) }));

const knownTools: Record<string, { slug: string; name: string }> = {
  gemini: { slug: "gemini", name: "Gemini" },
  cursor: { slug: "cursor", name: "Cursor" },
};
vi.mock("@/lib/content", () => ({
  getToolBySlug: async (slug: string) => knownTools[slug],
}));

const {
  toPublicStory,
  getPublishedStory,
  getStoryTools,
  listPublishedStories,
  listIndexableStories,
} = await import("@/lib/news/stories");

const row = {
  id: "31fc2bfe-a1c9-467d-9306-de8ae4cf1091",
  slug: "gemini-hacked-three-real-companies-31fc2b",
  headline: "Gemini hacked three real companies",
  summary: "A summary comfortably longer than forty characters in total.",
  take: null,
  beat: "policy-safety",
  image_url: null,
  source_name: "The Verge",
  source_site_url: "https://www.theverge.com",
  source_url: "https://www.theverge.com/story",
  source_published_at: "2026-09-19T15:25:00Z",
  published_at: "2026-09-21T10:01:35Z",
  featured: true,
};

/** Every from() call gets a fresh stub; results are consumed in call order. */
function respond(...results: StubResult[]) {
  const queue = [...results];
  from.mockImplementation(() => queryStub(queue.shift() ?? { data: [], error: null }));
}
const builder = (i = 0) => from.mock.results[i]?.value as ReturnType<typeof queryStub>;

beforeEach(() => {
  from.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("toPublicStory", () => {
  it("maps a complete published row", () => {
    expect(toPublicStory(row)).toMatchObject({
      slug: row.slug,
      beat: "policy-safety",
      beatName: "Policy & Safety",
      sourceName: "The Verge",
      sourceSiteUrl: "https://www.theverge.com",
      publishedAt: row.published_at,
    });
  });
  it("drops rows missing what a public page needs", () => {
    expect(toPublicStory({ ...row, slug: null })).toBeNull();
    expect(toPublicStory({ ...row, summary: null })).toBeNull();
    expect(toPublicStory({ ...row, published_at: null })).toBeNull();
    expect(toPublicStory({ ...row, beat: "sports" })).toBeNull();
  });
});

describe("getPublishedStory", () => {
  it("only ever asks for published stories", async () => {
    respond({ data: row, error: null });
    expect(await getPublishedStory(row.slug)).toMatchObject({ slug: row.slug });
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
    expect(builder().eq).toHaveBeenCalledWith("slug", row.slug);
  });
  it("returns null without querying for a malformed slug", async () => {
    expect(await getPublishedStory("../etc/passwd")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("returns null when the database errors", async () => {
    respond({ data: null, error: { message: "paused" } });
    expect(await getPublishedStory(row.slug)).toBeNull();
  });
  it("returns null when the database never answers", async () => {
    vi.useFakeTimers();
    const hung = queryStub({ data: row, error: null }) as Record<string, unknown>;
    hung.then = () => new Promise(() => {});
    from.mockImplementation(() => hung);
    const pending = getPublishedStory(row.slug);
    await vi.advanceTimersByTimeAsync(2600);
    expect(await pending).toBeNull();
  });
});

describe("getStoryTools", () => {
  it("keeps position order and skips tools no longer in the directory", async () => {
    respond({
      data: [
        { tool_slug: "gemini", position: 0 },
        { tool_slug: "removed-tool", position: 1 },
        { tool_slug: "cursor", position: 2 },
      ],
      error: null,
    });
    const tools = await getStoryTools(row.id);
    expect(tools.map((t) => t.slug)).toEqual(["gemini", "cursor"]);
  });
});

describe("listPublishedStories", () => {
  it("returns mapped stories and the exact total", async () => {
    respond({ data: [row], error: null, count: 41 });
    const result = await listPublishedStories({ page: 2 });
    expect(result.total).toBe(41);
    expect(result.stories).toHaveLength(1);
    expect(builder().range).toHaveBeenCalledWith(30, 59);
    expect(builder().eq).toHaveBeenCalledWith("status", "published");
  });
  it("filters by beat when asked", async () => {
    respond({ data: [], error: null, count: 0 });
    await listPublishedStories({ beat: "research" });
    expect(builder().eq).toHaveBeenCalledWith("beat", "research");
  });
  it("degrades to an empty archive when the database errors", async () => {
    respond({ data: null, error: { message: "paused" } });
    expect(await listPublishedStories()).toEqual({ stories: [], total: 0 });
  });
});

describe("listIndexableStories", () => {
  it("keeps only stories with a take long enough to index", async () => {
    respond({
      data: [
        { slug: "a-story", take: "x".repeat(300), published_at: "2026-09-21T10:00:00Z" },
        { slug: "b-story", take: "short", published_at: "2026-09-21T09:00:00Z" },
        { slug: "c-story", take: null, published_at: "2026-09-21T08:00:00Z" },
      ],
      error: null,
    });
    expect(await listIndexableStories()).toEqual([
      { slug: "a-story", publishedAt: "2026-09-21T10:00:00Z" },
    ]);
  });
});
```

Append to `src/lib/structured-data.test.ts`, adding `newsArticleJsonLd` to its existing import from `@/lib/structured-data`:

```ts
describe("newsArticleJsonLd", () => {
  const story = {
    id: "id-1",
    slug: "gemini-hacked-31fc2b",
    headline: "H".repeat(140),
    summary: "A summary.",
    take: "t".repeat(300),
    beat: "policy-safety" as const,
    beatName: "Policy & Safety",
    imageUrl: null,
    sourceName: "The Verge",
    sourceSiteUrl: "https://www.theverge.com",
    sourceUrl: "https://www.theverge.com/story",
    sourcePublishedAt: "2026-09-19T15:25:00Z",
    publishedAt: "2026-09-21T10:01:35Z",
    featured: false,
  };

  it("describes the story as a NewsArticle at its absolute URL", () => {
    const ld = newsArticleJsonLd(story) as Record<string, unknown>;
    expect(ld["@type"]).toBe("NewsArticle");
    expect(String(ld.url)).toMatch(/^https?:\/\/.+\/news\/gemini-hacked-31fc2b$/);
    expect(ld.isBasedOn).toBe(story.sourceUrl);
    expect(ld.datePublished).toBe(story.publishedAt);
  });

  it("truncates the headline to the 110 characters search engines accept", () => {
    const ld = newsArticleJsonLd(story) as { headline: string };
    expect(ld.headline.length).toBeLessThanOrEqual(110);
  });

  it("omits the image when the story has none", () => {
    expect(newsArticleJsonLd(story)).not.toHaveProperty("image");
  });
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `pnpm vitest run src/lib/news/story-meta.test.ts src/lib/news/stories.test.ts src/lib/structured-data.test.ts`
Expected: FAIL; the modules and `newsArticleJsonLd` don't exist yet.

- [ ] **Step 4: Implement `story-meta.ts`**

```ts
// src/lib/news/story-meta.ts
import { isIndexableTake } from "@/lib/news/schemas";

/** Stories per archive page. */
export const NEWS_PAGE_SIZE = 30;
/** Stories in a story page's "More in {Beat}" list. */
export const MORE_IN_BEAT = 5;

/**
 * A story page is `noindex, follow` unless it carries a take long enough to be
 * original commentary (spec §1, §6.1). Aggregated summaries alone are the thin
 * pages roadmap item 0.1b removed.
 */
export function storyRobots(take: string | null): { index: boolean; follow: true } {
  return { index: isIndexableTake(take), follow: true };
}

/**
 * The `[page]` segment of /news/page/[page]. Only a plain integer from 2 up is
 * a page: page 1 lives at /news, and anything else (0, 1, "007", "abc") must
 * 404 rather than render a duplicate or empty page.
 */
export function parsePageParam(raw: string): number | null {
  if (!/^[1-9][0-9]{0,4}$/.test(raw)) return null;
  const page = Number(raw);
  return page >= 2 ? page : null;
}

export function pageCount(total: number, pageSize: number = NEWS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Inclusive row range for Supabase `.range(from, to)`. */
export function pageRange(page: number, pageSize: number = NEWS_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
```

- [ ] **Step 5: Implement `stories.ts`**

```ts
// src/lib/news/stories.ts
import { getBeat, type BeatSlug } from "@/data/beats";
import { getToolBySlug } from "@/lib/content";
import type { Tool } from "@/lib/schemas";
import { isIndexableTake } from "@/lib/news/schemas";
import { MORE_IN_BEAT, pageRange } from "@/lib/news/story-meta";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Public reads of published stories.
 *
 * Uses the cookieless anon client, so RLS limits every query to
 * status = 'published' even if a filter here were dropped; the explicit
 * status filters are defence in depth. `story_excerpts` is never read here:
 * the publisher's text is admin-only by design.
 *
 * Every read degrades instead of throwing. A paused free-tier database gives
 * an empty archive and a 404 story, never a crashed render.
 */

const DB_TIMEOUT_MS = 2500;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PUBLIC_STORY_COLUMNS =
  "id, slug, headline, summary, take, beat, image_url, source_name, source_site_url, source_url, source_published_at, published_at, featured";

export type PublicStoryRow = {
  id: string;
  slug: string | null;
  headline: string;
  summary: string | null;
  take: string | null;
  beat: string | null;
  image_url: string | null;
  source_name: string;
  source_site_url: string;
  source_url: string;
  source_published_at: string | null;
  published_at: string | null;
  featured: boolean;
};

export type PublicStory = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  take: string | null;
  beat: BeatSlug;
  beatName: string;
  imageUrl: string | null;
  sourceName: string;
  sourceSiteUrl: string;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  publishedAt: string;
  featured: boolean;
};

export function toPublicStory(row: PublicStoryRow): PublicStory | null {
  const beat = row.beat ? getBeat(row.beat) : undefined;
  if (!row.slug || !row.summary || !row.published_at || !beat) return null;
  return {
    id: row.id,
    slug: row.slug,
    headline: row.headline,
    summary: row.summary,
    take: row.take,
    beat: beat.slug,
    beatName: beat.name,
    imageUrl: row.image_url,
    sourceName: row.source_name,
    sourceSiteUrl: row.source_site_url,
    sourceUrl: row.source_url,
    sourcePublishedAt: row.source_published_at,
    publishedAt: row.published_at,
    featured: row.featured,
  };
}

function toPublicStories(rows: unknown): PublicStory[] {
  return ((rows ?? []) as PublicStoryRow[])
    .map(toPublicStory)
    .filter((s): s is PublicStory => s !== null);
}

/** The query's result, or null on error, throw or timeout (each logged). */
async function withTimeout<R extends { error: unknown }>(
  query: PromiseLike<R>,
  label: string,
): Promise<R | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DB_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([query, timeout]);
    if (result === null) {
      console.error(`[enki] ${label} timed out`);
      return null;
    }
    if (result.error) {
      console.error(`[enki] ${label} failed`, result.error);
      return null;
    }
    return result;
  } catch (error) {
    console.error(`[enki] ${label} threw`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPublishedStory(slug: string): Promise<PublicStory | null> {
  if (!SLUG_RE.test(slug)) return null;
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(PUBLIC_STORY_COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    "getPublishedStory",
  );
  return result?.data ? toPublicStory(result.data as PublicStoryRow) : null;
}

/** The story's tools in position order, skipping any no longer in the directory. */
export async function getStoryTools(storyId: string): Promise<Tool[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("story_tools")
      .select("tool_slug, position")
      .eq("story_id", storyId)
      .order("position"),
    "getStoryTools",
  );
  const slugs = ((result?.data ?? []) as { tool_slug: string }[]).map((r) => r.tool_slug);
  const tools = await Promise.all(slugs.map((slug) => getToolBySlug(slug)));
  return tools.filter((t): t is Tool => t !== undefined);
}

export async function listPublishedStories(
  opts: { page?: number; beat?: BeatSlug } = {},
): Promise<{ stories: PublicStory[]; total: number }> {
  const { from, to } = pageRange(opts.page ?? 1);
  let query = createAnonClient()
    .from("stories")
    .select(PUBLIC_STORY_COLUMNS, { count: "exact" })
    .eq("status", "published");
  if (opts.beat) query = query.eq("beat", opts.beat);
  const result = await withTimeout(
    query.order("published_at", { ascending: false }).range(from, to),
    "listPublishedStories",
  );
  if (!result) return { stories: [], total: 0 };
  const stories = toPublicStories(result.data);
  return { stories, total: result.count ?? stories.length };
}

export async function listMoreInBeat(beat: BeatSlug, excludeId: string): Promise<PublicStory[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(PUBLIC_STORY_COLUMNS)
      .eq("status", "published")
      .eq("beat", beat)
      .neq("id", excludeId)
      .order("published_at", { ascending: false })
      .limit(MORE_IN_BEAT),
    "listMoreInBeat",
  );
  return toPublicStories(result?.data);
}

/** Stories whose take makes them indexable, for the sitemap. */
export async function listIndexableStories(): Promise<{ slug: string; publishedAt: string }[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select("slug, take, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000),
    "listIndexableStories",
  );
  const rows = (result?.data ?? []) as { slug: string | null; take: string | null; published_at: string | null }[];
  return rows.flatMap((r) =>
    r.slug && r.published_at && isIndexableTake(r.take)
      ? [{ slug: r.slug, publishedAt: r.published_at }]
      : [],
  );
}
```

- [ ] **Step 6: Add `newsArticleJsonLd`** to `src/lib/structured-data.ts`, after `breadcrumbJsonLd`, with `import type { PublicStory } from "@/lib/news/stories";` added to the imports:

```ts
/** NewsArticle, emitted only on story pages that are indexable (spec §6.1). */
export function newsArticleJsonLd(story: PublicStory) {
  const url = abs(`/news/${story.slug}`);
  const org = { "@type": "Organization", name: siteConfig.name, url: BASE };
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.headline.slice(0, 110),
    description: story.summary,
    datePublished: story.publishedAt,
    dateModified: story.publishedAt,
    url,
    mainEntityOfPage: url,
    ...(story.imageUrl ? { image: [story.imageUrl] } : {}),
    author: org,
    publisher: org,
    isBasedOn: story.sourceUrl,
  };
}
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `pnpm vitest run src/lib/news src/lib/structured-data.test.ts && pnpm typecheck`
Expected: all pass. Two likely typecheck points:
- supabase-js may type `select(PUBLIC_STORY_COLUMNS, …)` rows narrowly. The casts
  to `PublicStoryRow` are deliberate; if TypeScript reports the conversion "may
  be a mistake", cast through `unknown`.
- `query = query.eq(...)` must keep the builder type; if it doesn't, build the
  query in one expression with a conditional `.eq`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/news/story-meta.ts src/lib/news/story-meta.test.ts src/lib/news/stories.ts src/lib/news/stories.test.ts src/lib/structured-data.ts src/lib/structured-data.test.ts src/test/supabase-stub.ts
git commit -m "feat(news): public read layer for published stories"
```

---

### Task 3: The story page

**Files:**
- Create: `src/components/news/story-tool-card.tsx`, `src/components/news/story-list.tsx`
- Create: `src/app/news/[slug]/page.tsx`, `src/app/news/[slug]/opengraph-image.tsx`,
  `src/app/news/[slug]/twitter-image.tsx`

**Interfaces:**
- Consumes (Task 2):
  - `getPublishedStory`, `getStoryTools`, `listMoreInBeat`, `PublicStory`
  - `storyRobots`
  - `newsArticleJsonLd`
- Also consumes, from existing code:
  - `breadcrumbJsonLd(crumbs)` from `@/lib/structured-data`
  - `JsonLd` from `@/components/seo/json-ld`
  - `AffiliateDisclosure({ className })`
  - `ToolLogo({ name, accent, logo, size: "sm" | "md" | "lg" })`
  - `EditorScore({ value })`
  - `outboundHref(slug)` and `resolveOutboundTarget(tool).isAffiliate` from `@/lib/outbound`
  - `safeExternalHref(url)` from `@/lib/safe-url`
  - `formatAge(iso, now)`
  - `Container`, `Icon` (the registry includes `ArrowUpRight`)
  - `OG`, `OG_SIZE`, `ogFonts()` from `@/lib/og`
- Produces:
  - `StoryToolCard({ tool: Tool })`
  - `StoryList({ stories: PublicStory[]; now: Date; showBeat?: boolean })`,
    reused by Task 4
  - route `/news/[slug]`, which Task 5 adds `<StoryViewPing>` to

This task is UI with no unit tests of its own. Its logic lives in Task 2. The
gate is typecheck, lint and build, and the controller sweeps it in Task 7.

- [ ] **Step 1: `StoryToolCard`**

```tsx
// src/components/news/story-tool-card.tsx
import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { ToolLogo } from "@/components/shared/tool-logo";
import { EditorScore } from "@/components/shared/editor-score";
import { Icon } from "@/components/shared/icon";
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";

/**
 * A tool mentioned in a story. The name links to Enki's own review; the CTA
 * goes out through /go/[slug], so the click is tracked and, where the tool has
 * an affiliate URL, commissioned.
 */
export function StoryToolCard({ tool }: { tool: Tool }) {
  const { isAffiliate } = resolveOutboundTarget(tool);
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 ring-hairline">
      <div className="flex items-center gap-3">
        <ToolLogo name={tool.name} accent={tool.accent} logo={tool.logo} size="sm" />
        <div className="min-w-0">
          <Link
            href={`/tools/${tool.slug}`}
            className="font-display text-lg leading-tight font-semibold break-words hover:text-teal"
          >
            {tool.name}
          </Link>
          <p className="text-sm text-pretty text-muted-foreground">{tool.tagline}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <EditorScore value={tool.editorScore} />
        <a
          href={outboundHref(tool.slug)}
          target="_blank"
          rel={isAffiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal px-4 text-sm font-semibold text-[#04171a] transition-colors hover:bg-teal-bright"
        >
          Visit {tool.name}
          <Icon name="ArrowUpRight" className="size-4" />
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `StoryList`**

```tsx
// src/components/news/story-list.tsx
import Link from "next/link";
import { formatAge } from "@/lib/news/format-age";
import type { PublicStory } from "@/lib/news/stories";

/**
 * Headline list for the archive, beat pages and "More in {Beat}". A server
 * component: the relative time is computed here, never on the client.
 */
export function StoryList({
  stories,
  now,
  showBeat = true,
}: {
  stories: PublicStory[];
  now: Date;
  showBeat?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {stories.map((story) => (
        <li key={story.id} className="py-5">
          <Link href={`/news/${story.slug}`} className="group flex flex-col gap-1.5">
            <span className="font-display text-lg leading-snug font-semibold break-words text-pretty group-hover:text-teal">
              {story.headline}
            </span>
            <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">
              {story.summary}
            </span>
            <span className="font-mono text-xs break-words text-muted-foreground">
              {story.sourceName} · {formatAge(story.sourcePublishedAt ?? story.publishedAt, now)}
              {showBeat ? ` · ${story.beatName}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: The story page**

```tsx
// src/app/news/[slug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { AffiliateDisclosure } from "@/components/shared/affiliate-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import { StoryToolCard } from "@/components/news/story-tool-card";
import { StoryList } from "@/components/news/story-list";
import { breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/structured-data";
import { formatAge } from "@/lib/news/format-age";
import { storyRobots } from "@/lib/news/story-meta";
import { getPublishedStory, getStoryTools, listMoreInBeat } from "@/lib/news/stories";
import { safeExternalHref } from "@/lib/safe-url";

// Rendered on demand and cached; admin publish/unpublish revalidates /news.
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) return { title: "Story not found", robots: { index: false, follow: false } };
  return {
    title: story.headline,
    description: story.summary,
    alternates: { canonical: `/news/${story.slug}` },
    robots: storyRobots(story.take),
    openGraph: {
      type: "article",
      title: story.headline,
      description: story.summary,
      publishedTime: story.publishedAt,
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) notFound();

  const [tools, more] = await Promise.all([
    getStoryTools(story.id),
    listMoreInBeat(story.beat, story.id),
  ]);
  const now = new Date();
  const reportedAt = story.sourcePublishedAt ?? story.publishedAt;
  const indexable = storyRobots(story.take).index;

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "News", path: "/news" },
          { name: story.beatName, path: `/news/beat/${story.beat}` },
          { name: story.headline, path: `/news/${story.slug}` },
        ])}
      />
      {indexable ? <JsonLd data={newsArticleJsonLd(story)} /> : null}

      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <nav
            aria-label="Breadcrumb"
            className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
          >
            <Link href="/news" className="hover:text-foreground">
              News
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <Link href={`/news/beat/${story.beat}`} className="text-teal hover:text-teal-bright">
              {story.beatName}
            </Link>
          </nav>
          <h1 className="font-display text-3xl leading-tight font-semibold break-words text-balance sm:text-4xl">
            {story.headline}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <a
              href={safeExternalHref(story.sourceSiteUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-foreground hover:text-teal"
            >
              {story.sourceName}
            </a>
            <span aria-hidden>·</span>
            <time dateTime={reportedAt}>{formatAge(reportedAt, now)}</time>
            <span aria-hidden>·</span>
            <span>Summary by Enki</span>
          </p>
        </header>

        <p className="text-lg leading-relaxed text-pretty">{story.summary}</p>

        {story.take ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-6 ring-hairline">
            <h2 className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki&apos;s take</h2>
            <p className="leading-relaxed whitespace-pre-line text-pretty">{story.take}</p>
          </section>
        ) : null}

        <a
          href={safeExternalHref(story.sourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-[#04171a] transition-colors hover:bg-teal-bright"
        >
          <span className="break-words">Read the full story at {story.sourceName}</span>
          <Icon name="ArrowUpRight" className="size-4 shrink-0" />
        </a>

        {tools.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">Tools in this story</h2>
            <AffiliateDisclosure className="text-xs text-muted-foreground" />
            <div className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <StoryToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        ) : null}

        {more.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">More in {story.beatName}</h2>
            <StoryList stories={more} now={now} showBeat={false} />
          </section>
        ) : null}

        <p className="text-sm text-muted-foreground">
          <Link href="/news/about" className="hover:text-foreground hover:underline">
            How Enki covers news
          </Link>
        </p>
      </article>
    </Container>
  );
}
```

- [ ] **Step 4: Social card**

```tsx
// src/app/news/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { OG, OG_SIZE, ogFonts } from "@/lib/og";
import { getPublishedStory } from "@/lib/news/stories";

export const alt = "AI news on Enki";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [story, fonts] = await Promise.all([getPublishedStory(slug), ogFonts()]);
  const headline = story?.headline ?? "AI news on Enki";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: OG.bg,
          color: OG.fg,
          fontFamily: "Cardot",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: OG.teal, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {story ? story.beatName : "Enki news"}
        </div>
        <div style={{ display: "flex", fontSize: headline.length > 90 ? 52 : 64, fontWeight: 600, lineHeight: 1.1 }}>
          {headline}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: OG.muted }}>
          <span>{story ? `Via ${story.sourceName}` : "enkitools.com"}</span>
          <span style={{ color: OG.soft }}>Enki</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
```

```tsx
// src/app/news/[slug]/twitter-image.tsx
// Route segment config must be a literal in each file, so revalidate is
// restated here rather than re-exported.
export const revalidate = 300;
export { default, alt, size, contentType } from "./opengraph-image";
```

- [ ] **Step 5: Check it compiles**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected:
- all clean
- the build route list shows `ƒ /news/[slug]` (dynamic) and its image routes
- if `pnpm build` rejects the re-exported image module, copy the four exports
  into `twitter-image.tsx` explicitly (default, alt, size, contentType) and
  report it

- [ ] **Step 6: Commit**

```bash
git add src/components/news/story-tool-card.tsx src/components/news/story-list.tsx "src/app/news/[slug]"
git commit -m "feat(news): public story page with tool cards and a social card"
```

---

### Task 4: The archive, beat pages and the "How Enki covers news" page

**Files:**
- Create: `src/components/news/news-pagination.tsx`, `src/components/news/news-archive.tsx`
- Create: `src/app/news/page.tsx`, `src/app/news/page/[page]/page.tsx`,
  `src/app/news/beat/[beat]/page.tsx`, `src/app/news/about/page.tsx`

**Interfaces:**
- Consumes:
  - `listPublishedStories`, `PublicStory` (Task 2)
  - `parsePageParam`, `pageCount` (Task 2)
  - `StoryList` (Task 3)
  - `beats`, `getBeat`, `BeatSlug` (`@/data/beats`)
- Produces:
  - routes `/news`, `/news/page/[page]`, `/news/beat/[beat]` and `/news/about`
  - `NewsArchive(props)`

- [ ] **Step 1: Pagination and the shared archive layout**

```tsx
// src/components/news/news-pagination.tsx
import Link from "next/link";

const linkClass =
  "rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground";

/** Newer/Older links. Page 1 is /news; later pages are /news/page/N. */
export function NewsPagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => (p === 1 ? "/news" : `/news/page/${p}`);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          Newer stories
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          Older stories
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
```

```tsx
// src/components/news/news-archive.tsx
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { StoryList } from "@/components/news/story-list";
import { NewsPagination } from "@/components/news/news-pagination";
import { beats, type BeatSlug } from "@/data/beats";
import type { PublicStory } from "@/lib/news/stories";
import { cn } from "@/lib/utils";

/** Shared layout for /news, its later pages, and the beat pages. */
export function NewsArchive({
  title,
  description,
  stories,
  emptyMessage,
  activeBeat,
  page = 1,
  pageCount = 1,
}: {
  title: string;
  description: string;
  stories: PublicStory[];
  emptyMessage: string;
  activeBeat?: BeatSlug;
  page?: number;
  pageCount?: number;
}) {
  const now = new Date();
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-balance">{title}</h1>
          <p className="text-pretty text-muted-foreground">{description}</p>
          <nav aria-label="Beats" className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/news"
              aria-current={activeBeat ? undefined : "page"}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                activeBeat
                  ? "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground"
                  : "border-teal/40 bg-teal/10 text-teal",
              )}
            >
              Latest
            </Link>
            {beats.map((beat) => (
              <Link
                key={beat.slug}
                href={`/news/beat/${beat.slug}`}
                aria-current={activeBeat === beat.slug ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  activeBeat === beat.slug
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
                )}
              >
                {beat.name}
              </Link>
            ))}
          </nav>
        </header>

        {stories.length > 0 ? (
          <StoryList stories={stories} now={now} showBeat={!activeBeat} />
        ) : (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
            {emptyMessage}
          </p>
        )}

        <NewsPagination page={page} pageCount={pageCount} />
      </div>
    </Container>
  );
}
```

- [ ] **Step 2: `/news` (page 1)**

```tsx
// src/app/news/page.tsx
import type { Metadata } from "next";
import { NewsArchive } from "@/components/news/news-archive";
import { listPublishedStories } from "@/lib/news/stories";
import { pageCount } from "@/lib/news/story-meta";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI news",
  description: "The day's AI news, summarised, with the tools each story mentions.",
  alternates: { canonical: "/news" },
};

export default async function NewsPage() {
  const { stories, total } = await listPublishedStories({ page: 1 });
  return (
    <NewsArchive
      title="AI news"
      description="The day's AI news, summarised, with the tools each story mentions."
      stories={stories}
      emptyMessage="The first stories are coming soon."
      page={1}
      pageCount={pageCount(total)}
    />
  );
}
```

- [ ] **Step 3: `/news/page/[page]`**

```tsx
// src/app/news/page/[page]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArchive } from "@/components/news/news-archive";
import { listPublishedStories } from "@/lib/news/stories";
import { pageCount, parsePageParam } from "@/lib/news/story-meta";

export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parsePageParam((await params).page);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  return {
    title: `AI news, page ${page}`,
    alternates: { canonical: `/news/page/${page}` },
    // Crawlable for discovery, but /news is the page that should rank.
    robots: { index: false, follow: true },
  };
}

export default async function NewsArchivePage({ params }: Props) {
  const page = parsePageParam((await params).page);
  if (!page) notFound();

  const { stories, total } = await listPublishedStories({ page });
  const pages = pageCount(total);
  if (page > pages || stories.length === 0) notFound();

  return (
    <NewsArchive
      title="AI news"
      description={`Page ${page} of the archive.`}
      stories={stories}
      emptyMessage=""
      page={page}
      pageCount={pages}
    />
  );
}
```

- [ ] **Step 4: `/news/beat/[beat]`**

```tsx
// src/app/news/beat/[beat]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArchive } from "@/components/news/news-archive";
import { beats, getBeat } from "@/data/beats";
import { listPublishedStories } from "@/lib/news/stories";

export const revalidate = 300;
// Only the five beats exist; anything else 404s at the router.
export const dynamicParams = false;
export function generateStaticParams() {
  return beats.map((beat) => ({ beat: beat.slug }));
}

type Props = { params: Promise<{ beat: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const beat = getBeat((await params).beat);
  if (!beat) return { title: "Beat not found" };
  return {
    title: `${beat.name} news`,
    description: `The latest AI news on ${beat.name.toLowerCase()}, summarised.`,
    alternates: { canonical: `/news/beat/${beat.slug}` },
  };
}

export default async function BeatPage({ params }: Props) {
  const beat = getBeat((await params).beat);
  if (!beat) notFound();

  // Deliberately unpaginated: the latest 30 (plan deviation 2).
  const { stories } = await listPublishedStories({ beat: beat.slug });
  return (
    <NewsArchive
      title={`${beat.name} news`}
      description={`The latest AI news on ${beat.name.toLowerCase()}, summarised.`}
      stories={stories}
      emptyMessage={`No ${beat.name} stories yet.`}
      activeBeat={beat.slug}
    />
  );
}
```

- [ ] **Step 5: `/news/about`**

```tsx
// src/app/news/about/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "How Enki covers news",
  description: "Where Enki's AI news comes from, and how tool links on stories work.",
  alternates: { canonical: "/news/about" },
};

export default function NewsAboutPage() {
  return (
    <Container className="pt-28 pb-20">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 text-pretty text-muted-foreground">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-foreground">How Enki covers news</h1>
        </header>
        <p>
          Enki follows a set of AI news sources every day and picks the stories worth your time.
          Each story links to the publisher that reported it. The headline and the reporting
          belong to them.
        </p>
        <p>
          Every summary and take on Enki is written from the linked source. For the complete
          reporting, read the full story at the publisher.
        </p>
        <p>
          Some stories list the AI tools they mention. Those links may earn Enki a commission if
          you sign up, and that never influences which stories we run or how we summarise them.
          More in our{" "}
          <Link href="/privacy#affiliate" className="text-teal hover:underline">
            affiliate policy
          </Link>
          .
        </p>
        <p>
          Spotted a mistake? Email{" "}
          <a className="text-teal hover:underline" href="mailto:enkidirectory@gmail.com">
            enkidirectory@gmail.com
          </a>{" "}
          and we will fix it.
        </p>
        <p>
          <Link href="/news" className="text-teal hover:underline">
            Back to the news
          </Link>
        </p>
      </article>
    </Container>
  );
}
```

- [ ] **Step 6: Check it compiles, and check the copy**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean. The route list includes:
- `ƒ /news`, or `○ /news` with ISR (either is fine)
- `ƒ /news/page/[page]`
- `● /news/beat/[beat]`, with 5 paths
- `○ /news/about`

Then prove the new copy has no dashes. This counts em and en dashes in the files this plan created; expect `0`:

```bash
cat src/app/news/about/page.tsx src/app/news/page.tsx "src/app/news/beat/[beat]/page.tsx" "src/app/news/page/[page]/page.tsx" src/components/news/*.tsx "src/app/news/[slug]/page.tsx" | grep -c $'\xe2\x80\x94\|\xe2\x80\x93'
```

- [ ] **Step 7: Commit**

```bash
git add src/components/news/news-pagination.tsx src/components/news/news-archive.tsx src/app/news/page.tsx "src/app/news/page" "src/app/news/beat" src/app/news/about
git commit -m "feat(news): archive, beat pages and the How Enki covers news page"
```

---

### Task 5: Counting story views

**Files:**
- Modify: `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`
- Create: `src/app/api/story-view/route.ts`, `src/app/api/story-view/route.test.ts`
- Create: `src/components/news/story-view-ping.tsx`, `src/components/news/story-view-ping.test.tsx`
- Modify: `src/app/news/[slug]/page.tsx` (render the ping)
- Modify: `src/lib/supabase/anon-writes.test.ts`, `src/app/privacy/page.tsx`

**Interfaces:**
- Consumes:
  - the `story_views` table (Task 1)
  - `allowWrite(path, { request })` from `@/lib/rate-limit`
  - `createAnonClient()`
- Produces:
  - `POST /api/story-view` with body `{ storyId: uuid }`: 204 on any valid
    body, 400 otherwise
  - `StoryViewPing({ storyId })`
  - `VIEWED_KEY_PREFIX`
  - `WritePath` gains `"story-view"` (Firewall rule id `enki-story-view`)

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/story-view/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const allowWrite = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ allowWrite: (...a: unknown[]) => allowWrite(...a) }));

const insert = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: () => ({ from: () => ({ insert }) }),
}));

const { POST } = await import("@/app/api/story-view/route");

const STORY = "31fc2bfe-a1c9-467d-9306-de8ae4cf1091";
const post = (body: string) =>
  POST(new NextRequest("http://localhost/api/story-view", { method: "POST", body }));

beforeEach(() => {
  vi.clearAllMocks();
  allowWrite.mockResolvedValue(true);
  insert.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/story-view", () => {
  it("rejects a body that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    expect((await post(JSON.stringify({ storyId: "1 or 1=1" }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("records a view of a valid story with .insert()", async () => {
    const res = await post(JSON.stringify({ storyId: STORY }));
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledWith({ story_id: STORY });
  });

  it("answers 204 without recording when rate limited", async () => {
    allowWrite.mockResolvedValue(false);
    expect((await post(JSON.stringify({ storyId: STORY }))).status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats an RLS refusal (unpublished story) as expected, not an error", async () => {
    insert.mockResolvedValue({ error: { code: "42501" } });
    expect((await post(JSON.stringify({ storyId: STORY }))).status).toBe(204);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs any other database error but still answers 204", async () => {
    insert.mockResolvedValue({ error: { code: "08006", message: "connection failure" } });
    expect((await post(JSON.stringify({ storyId: STORY }))).status).toBe(204);
    expect(console.error).toHaveBeenCalled();
  });
});
```

```tsx
// src/components/news/story-view-ping.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StoryViewPing } from "@/components/news/story-view-ping";

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StoryViewPing", () => {
  it("records a view once per story per browser session", () => {
    const first = render(<StoryViewPing storyId="story-a" />);
    first.unmount();
    render(<StoryViewPing storyId="story-a" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/story-view",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ storyId: "story-a" }) }),
    );
  });

  it("counts a different story separately", () => {
    render(<StoryViewPing storyId="story-a" />);
    render(<StoryViewPing storyId="story-b" />);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still records the view when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<StoryViewPing storyId="story-a" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    const { container } = render(<StoryViewPing storyId="story-a" />);
    expect(container.innerHTML).toBe("");
  });
});
```

In `src/lib/rate-limit.test.ts`, add `"story-view",` to the end of the `PATHS` array.

In `src/lib/supabase/anon-writes.test.ts`, add `"src/app/api/story-view/route.ts",` to `ANON_WRITE_PATHS`.

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/app/api/story-view src/components/news src/lib/rate-limit.test.ts src/lib/supabase/anon-writes.test.ts`
Expected: FAIL. The route and the component don't exist, and `"story-view"` isn't a `WritePath`.

- [ ] **Step 3: Add the write path.** In `src/lib/rate-limit.ts`:
  - extend the union to

    ```ts
    export type WritePath =
      | "outbound"
      | "newsletter"
      | "submit"
      | "unsubscribe"
      | "story-view";
    ```

  - in the doc comment's list of intended ceilings, add the line
    `enki-story-view    30 / minute`

- [ ] **Step 4: The route**

```ts
// src/app/api/story-view/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { allowWrite } from "@/lib/rate-limit";
import { createAnonClient } from "@/lib/supabase/anon";

const bodySchema = z.object({ storyId: z.uuid() });

/**
 * Records one anonymous view of a published story, for the Popular rail.
 * Stores the story id and a timestamp, nothing about the visitor. RLS refuses
 * views of anything unpublished, so a forged id can only ever count toward a
 * real published story.
 *
 * Any valid body gets 204: a view is best-effort telemetry, and the response
 * must not reveal whether a story exists or whether the view was counted.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (await allowWrite("story-view", { request })) {
    try {
      const { error } = await createAnonClient()
        .from("story_views")
        .insert({ story_id: parsed.data.storyId });
      // 42501 is RLS refusing an unpublished or unknown story: expected.
      if (error && (error as { code?: string }).code !== "42501") {
        console.error("[enki] story view insert failed", error);
      }
    } catch (error) {
      console.error("[enki] story view insert threw", error);
    }
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: The client component**

```tsx
// src/components/news/story-view-ping.tsx
"use client";

import { useEffect } from "react";

export const VIEWED_KEY_PREFIX = "enki:story-viewed:";

/**
 * Sends one view per story per browser session. The session key is written
 * before the request, so React's development double-effect and quick reloads
 * don't double count. When storage is unavailable (private mode, blocked
 * cookies) it still counts once per page load rather than never.
 */
export function StoryViewPing({ storyId }: { storyId: string }) {
  useEffect(() => {
    const key = `${VIEWED_KEY_PREFIX}${storyId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable: fall through and count this page load.
    }
    fetch("/api/story-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storyId }),
      keepalive: true,
    }).catch(() => {
      // Telemetry only; never surface a failure to the reader.
    });
  }, [storyId]);

  return null;
}
```

- [ ] **Step 6: Wire it into the story page.** In `src/app/news/[slug]/page.tsx`:
  - add `import { StoryViewPing } from "@/components/news/story-view-ping";`
  - render `<StoryViewPing storyId={story.id} />` as the first child of the
    `<article>` element

- [ ] **Step 7: Privacy.** In `src/app/privacy/page.tsx`, the "What we collect" paragraph ends with `Anonymous, cookieless usage analytics are collected via Vercel Analytics to help us improve the site.` Add this sentence after it, inside the same `<p>`:

```tsx
            When you read a news story we record an anonymous view, meaning the
            story and the time and nothing about you, to show which stories are
            popular.
```

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run src/app/api/story-view src/components/news src/lib/rate-limit.test.ts src/lib/supabase/anon-writes.test.ts && pnpm typecheck && pnpm lint`
Expected: all pass, clean.

- [ ] **Step 9: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/app/api/story-view src/components/news/story-view-ping.tsx src/components/news/story-view-ping.test.tsx "src/app/news/[slug]/page.tsx" src/lib/supabase/anon-writes.test.ts src/app/privacy/page.tsx
git commit -m "feat(news): count anonymous story views, rate limited and privacy-noted"
```

**Operator step, for the owner:** create a Vercel Firewall rate-limit rule with
id `enki-story-view`, at 30 requests per minute per IP. Until it exists,
`allowWrite` fails open and reports the missing rule to Sentry once, which is
the same as the other four paths.

---

### Task 6: Sitemap, and refreshing public pages on publish

**Files:**
- Modify: `src/app/sitemap.ts`
- Create: `src/app/sitemap.test.ts`
- Modify: `src/app/admin/news/actions.ts`, `src/app/admin/news/actions.test.ts`

**Interfaces:**
- Consumes: `listIndexableStories()` (Task 2), `beats` (`@/data/beats`)
- Produces:
  - `sitemap.xml` includes `/news`, `/news/about`, the five beat pages and every
    indexable story; it regenerates hourly
  - publish and status changes call `revalidatePath("/news", "layout")`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/sitemap.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/news/stories", () => ({
  listIndexableStories: async () => [
    { slug: "a-story-with-a-take", publishedAt: "2026-09-21T10:00:00Z" },
  ],
}));

const { default: sitemap } = await import("@/app/sitemap");

describe("sitemap", () => {
  it("lists the news routes and every indexable story", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/news"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/news/about"))).toBe(true);
    expect(urls.filter((u) => u.includes("/news/beat/"))).toHaveLength(5);
    expect(urls.some((u) => u.endsWith("/news/a-story-with-a-take"))).toBe(true);
  });

  it("does not list archive pages, which are noindex", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.includes("/news/page/"))).toBe(false);
  });
});
```

In `src/app/admin/news/actions.test.ts`:
- in the test `"publishes through the guarded RPC with a generated slug"`, add
  `expect(revalidatePath).toHaveBeenCalledWith("/news", "layout");` after its
  existing `revalidatePath` assertion
- add this test to the `setStoryStatus` describe block:

```ts
  it("refreshes public news pages when a story is unpublished", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_set_story_status: { data: true, error: null } } }),
    );
    await setStoryStatus(ID, "pending");
    expect(revalidatePath).toHaveBeenCalledWith("/news", "layout");
  });
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/app/sitemap.test.ts src/app/admin/news/actions.test.ts`
Expected: FAIL. No news entries in the sitemap yet, and no `/news` revalidation.

- [ ] **Step 3: Sitemap.** In `src/app/sitemap.ts`:
  - add the imports `import { beats } from "@/data/beats";` and
    `import { listIndexableStories } from "@/lib/news/stories";`
  - add `export const revalidate = 3600;` under the imports, with the comment
    `// Hourly: stories are published daily, and only indexable ones are listed.`
  - add these two arrays before the `return`, and spread `...news, ...stories`
    at the end of the returned array:

```ts
  const news: MetadataRoute.Sitemap = [
    { url: `${base}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/news/about`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...beats.map((beat) => ({
      url: `${base}/news/beat/${beat.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  // Only stories with an indexable take (spec §6.1). Archive pages 2+ are
  // noindex, so they are not listed.
  const stories: MetadataRoute.Sitemap = (await listIndexableStories()).map((story) => ({
    url: `${base}/news/${story.slug}`,
    lastModified: new Date(story.publishedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));
```

- [ ] **Step 4: Revalidate on publish.** In `src/app/admin/news/actions.ts`, directly after each existing `revalidatePath("/admin/news");`, in `publishStory` and in `setStoryStatus`, add:

```ts
  // Public story, archive and beat pages are cached; refresh them all.
  revalidatePath("/news", "layout");
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/app/sitemap.test.ts src/app/admin/news/actions.test.ts && pnpm typecheck`
Expected: all pass. The existing non-admin tests still show `revalidatePath` never called.

- [ ] **Step 6: Commit**

```bash
git add src/app/sitemap.ts src/app/sitemap.test.ts src/app/admin/news/actions.ts src/app/admin/news/actions.test.ts
git commit -m "feat(news): sitemap news routes and refresh public pages on publish"
```

---

### Task 7: Verification, the visual sweep and docs

**Owner: the controller.** A browser is needed; nothing here is delegated.

- [ ] **Step 1: The gates**

Run: `pnpm verify && pnpm audit:rls && pnpm build`
Expected:
- all green, with the test count up from 451
- audit all PASS, including `story_views`
- the build lists the `/news` routes

- [ ] **Step 2: Serve and sweep.** Start `preview_start` `{ name: "enki-dev" }`, then:

```bash
MSYS_NO_PATHCONV=1 pnpm sweep -- / /tools /news /news/about /news/beat/policy-safety /news/beat/research /news/gemini-hacked-three-real-companies-during-a-cybersecurity-31fc2b
```

Every route/viewport pair must read PASS. `/news/beat/research` is chosen
because it is probably empty, which exercises the empty state. Take screenshots
of the story page and `/news` at 390px and 1440px.

- [ ] **Step 3: Check the story page's behaviour** in the browser pane:
  - the page's robots meta contains `noindex`, because the Gemini story has no take
  - the text `Summary by Enki` is present
  - the tool card links to `/go/gemini`
  - the source link goes to `https://www.theverge.com/...` with
    `rel="noopener noreferrer"`
  - the page does not contain the publisher excerpt's text: search the HTML for
    `In May, Gemini broke containment` and expect no match
  - reading the console shows no errors
  - then check views via MCP `execute_sql`:
    `select count(*) from public.story_views;`
    - load the page once: the count goes up by 1
    - reload in the same tab: no change
  - `/news/page/1`, `/news/page/0` and `/news/page/abc` return 404

- [ ] **Step 4: Check that publishing refreshes the page.** Unpublish the Gemini
  story in `/admin/news?view=published` (this needs the owner signed in).
  `/news/<slug>` must then 404. Re-publish it, restoring its summary, beat,
  featured flag and Gemini tool, and confirm the page returns.

- [ ] **Step 5: Docs.** Update `handoff.md` §0:
  - merge 2 done
  - the `news_public_pages` migration
  - the `enki-story-view` Firewall rule as an owner step
  - add `story_views` and the two new story columns to the §4 schema table

  Then commit:

```bash
git add handoff.md
git commit -m "docs(handoff): merge 2 public news pages"
```

- [ ] **Step 6: Stop the dev server** (`preview_stop`). Do not push unless the owner asks.
