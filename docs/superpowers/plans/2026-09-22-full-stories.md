# Full Stories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Enki story pages from a short summary plus an outbound link into full articles (400 to 700 words, with a "What it means for founders" section), written from several outlets whose duplicate coverage is merged into one story as its sources.

**Architecture:**
- **Database:** `stories` gains `body`, a generated `body_words`, and `merged_into`, with a new `merged` status. CHECK constraints enforce the body rules.
- **RPCs:**
  - `admin_publish_story` takes a body instead of a take.
  - New `admin_merge_story` merges a duplicate into a story.
  - New anon-callable `story_sources` exposes only the name and URLs of a published story's merged sources.
- **Rendering:** a pure parser (`src/lib/news/article-body.ts`) turns restricted Markdown into a small AST, and a component renders it with no HTML passthrough.
- **Admin:** the editor gains a body field, a sources panel with unmerge, and a merge picker.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Supabase (Postgres 17, PostgREST), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-full-stories-design.md`, built on `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md` (read its §0 amendments).

## Global Constraints

- **No em dash (U+2014) or en dash (U+2013)** in any user-facing string this plan adds or edits. In code, never type either character or a backslash-u escape for it: build it with `String.fromCharCode(0x2013, 0x2014)` in TypeScript and `chr(8211)`, `chr(8212)` in SQL. (The editing tools decode backslash-u escapes into the real character; see the global lessons.)
- **Body rules:** 300 to 1,200 words (whitespace-split); no U+2013 or U+2014; contains a line that is exactly `## What it means for founders`.
- **Summary** stays 40 to 320 characters and is the standfirst and meta description.
- **Indexable** when `body_words >= 300`; otherwise `noindex, follow`.
- **Byline "By Enki".** No copy says who or what writes, and there is no AI disclosure (pivot spec §0 amendments 1 to 2).
- **Publisher text is never rendered publicly.** `story_excerpts` stays admin-only.
- **Source links** are plain external links with `rel="noopener noreferrer"`, never routed through `/go` (`/go` is for tools).
- **No new npm dependency.**
- **Git:** work on `main`, no branches, never push. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The pre-commit hook runs `pnpm verify`; never use `--no-verify`. Stage only the files each task names.
- **Database changes go through the Supabase MCP** (`apply_migration`, project `qknsqurdawglctwqfwxe`). This repo keeps no `.sql` files: the SQL lives in this plan, and HANDOFF §4 points at it (as merge 3 did).

## Review Focus

These are the five failure modes most likely to bite, and the tests that pin each one:

1. **A body of exactly 300 or 1,200 words must publish, and 299 or 1,201 must not, in both the browser check and the database.** The JS and SQL word counts must agree, including leading, trailing and doubled whitespace and line breaks. Pinned in Task 2 (`countWords` boundaries) and Task 1 Step 4 (live constraint at 300 and 299 words, with padded whitespace).
2. **Merging a story that already has merged children must not orphan them.** They are re-pointed at the new parent. Pinned in Task 1 Step 5 (live chain merge).
3. **Rejecting a pending story that has merged children must not leave them pointing at a rejected parent.** They are rejected with it, which keeps dedup. Pinned in Task 1 Step 5.
4. **A body containing `<script>`, raw HTML, or `[x](javascript:alert(1))` must render as inert text.** Pinned in Task 2 (parser tests) and Task 4 (component test).
5. **`story_sources` must reveal nothing for a story that is not published.** Pinned in Task 1 Step 5 (live check against a pending id).

---

### Task 1: Database migration, types and RLS audit

**Files:**
- Apply: migration `full_stories` through the Supabase MCP (SQL below)
- Modify: `src/lib/supabase/database.types.ts` (the `stories` Row and the Functions)
- Modify: `scripts/audit-rls/expectations.mjs:54-98`
- Modify: `scripts/audit-rls/expectations.test.mjs:53-58,76-84`

**Interfaces:**
- Produces:
  - Columns `stories.body text null`, `stories.body_words integer not null` (generated), `stories.merged_into uuid null`; status value `'merged'`.
  - `admin_publish_story(p_story_id uuid, p_slug text, p_headline text, p_summary text, p_body text, p_beat text, p_featured boolean, p_tool_slugs text[]) returns text`. It returns the slug or null, and raises `check_violation` on a bad body.
  - `admin_merge_story(p_story_id uuid, p_into_id uuid) returns boolean`.
  - `admin_set_story_status(p_story_id uuid, p_status text) returns boolean`, with the same signature and new behaviour.
  - `story_sources(p_story_id uuid) returns table(source_name text, source_site_url text, source_url text)`.

**Deploy-order warning:** this migration drops the old `admin_publish_story` signature, so production's current code cannot publish until this merge is deployed. Do not publish from enkitools.com between applying it and deploying.

- [ ] **Step 1: Apply the migration**

Call `apply_migration` with project `qknsqurdawglctwqfwxe`, name `full_stories`, and this query:

```sql
-- Full stories: a body per story, and duplicate coverage merged in as sources.

alter table public.stories
  add column body text,
  add column body_words integer generated always as (
    coalesce(
      array_length(
        regexp_split_to_array(regexp_replace(body, '^\s+|\s+$', '', 'g'), '\s+'),
        1),
      0)
  ) stored,
  add column merged_into uuid references public.stories(id) on delete set null;

alter table public.stories drop constraint stories_status_check;
alter table public.stories add constraint stories_status_check
  check (status = any (array['pending', 'published', 'rejected', 'merged']));

alter table public.stories add constraint stories_merged_has_parent
  check ((status = 'merged') = (merged_into is not null));

alter table public.stories add constraint stories_body_check
  check (
    body is null or (
      body_words between 300 and 1200
      and strpos(body, chr(8211)) = 0
      and strpos(body, chr(8212)) = 0
      and body ~ '(^|\n)## What it means for founders[ \t]*(\r?\n|$)'
    )
  );

create index stories_merged_into_idx on public.stories (merged_into) where merged_into is not null;

-- Publish now takes a body instead of a take. The take column is left alone.
drop function public.admin_publish_story(uuid, text, text, text, text, text, boolean, text[]);

create function public.admin_publish_story(
  p_story_id uuid, p_slug text, p_headline text, p_summary text, p_body text,
  p_beat text, p_featured boolean, p_tool_slugs text[])
returns text
language plpgsql
security definer
set search_path to ''
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
         body = nullif(regexp_replace(coalesce(p_body, ''), '^\s+|\s+$', '', 'g'), ''),
         beat = p_beat,
         featured = coalesce(p_featured, false),
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

revoke execute on function public.admin_publish_story(uuid, text, text, text, text, text, boolean, text[]) from public, anon;
grant execute on function public.admin_publish_story(uuid, text, text, text, text, text, boolean, text[]) to authenticated;

-- Merge a pending or rejected row into a pending or published story.
create function public.admin_merge_story(p_story_id uuid, p_into_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  if p_story_id = p_into_id then
    return false;
  end if;
  perform 1 from public.stories where id = p_into_id and status in ('pending', 'published');
  if not found then
    return false;
  end if;

  update public.stories
     set status = 'merged', merged_into = p_into_id, featured = false
   where id = p_story_id and status in ('pending', 'rejected');
  if not found then
    return false;
  end if;

  -- The merged row's own sources follow it, so none is left pointing at a merged row.
  update public.stories set merged_into = p_into_id where merged_into = p_story_id;
  return true;
end;
$$;

revoke execute on function public.admin_merge_story(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_story(uuid, uuid) to authenticated;

-- Reject from pending (taking merged sources with it), or back to pending from
-- published (unpublish) or merged (unmerge).
create or replace function public.admin_set_story_status(p_story_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  if p_status = 'rejected' then
    update public.stories set status = 'rejected'
     where id = p_story_id and status = 'pending';
    if not found then
      return false;
    end if;
    update public.stories set status = 'rejected', merged_into = null
     where merged_into = p_story_id;
    return true;
  elsif p_status = 'pending' then
    update public.stories set status = 'pending', featured = false, merged_into = null
     where id = p_story_id and status in ('published', 'merged');
  else
    return false;
  end if;
  return found;
end;
$$;

-- Public: the sources of a published story (its own, then merged rows), and
-- nothing at all for any other story. Only three columns ever leave.
create function public.story_sources(p_story_id uuid)
returns table (source_name text, source_site_url text, source_url text)
language sql
stable
security definer
set search_path to ''
as $$
  select s.source_name, s.source_site_url, s.source_url
    from public.stories s
   where (s.id = p_story_id or (s.merged_into = p_story_id and s.status = 'merged'))
     and exists (select 1 from public.stories p where p.id = p_story_id and p.status = 'published')
   order by (s.id = p_story_id) desc, s.source_published_at asc nulls last;
$$;

revoke execute on function public.story_sources(uuid) from public;
grant execute on function public.story_sources(uuid) to anon, authenticated;
```

- [ ] **Step 2: Confirm the schema landed**

Run through `execute_sql`:

```sql
select column_name, is_generated from information_schema.columns
 where table_name = 'stories' and column_name in ('body', 'body_words', 'merged_into');
```

Expected: three rows, with `body_words` showing `ALWAYS`.

- [ ] **Step 3: Find the admin user id for the RPC tests**

```sql
select user_id from public.admins limit 1;
```

Call it `<ADMIN>` below.

- [ ] **Step 4: Prove the body constraint in both directions (rolled back)**

Pick any pending story id, `<P>`, from `select id from stories where status = 'pending' limit 1;`. Then:

```sql
begin;
-- 300 words with padded whitespace: accepted
update public.stories set body =
  E'\n  ' || repeat('word ', 289) || E'\n\n## What it means for founders\n\n' || repeat('point ', 4) || 'end  ' || E'\n'
 where id = '<P>';
select body_words from public.stories where id = '<P>';
rollback;
```

Expected: `body_words` = 300 (289 filler, plus 6 heading tokens because "##" counts, plus 4, plus 1).

```sql
begin;
update public.stories set body =
  repeat('word ', 288) || E'\n## What it means for founders\n' || repeat('point ', 4) || 'end'
 where id = '<P>';
rollback;
```

Expected: ERROR `violates check constraint "stories_body_check"` (299 words).

Repeat with 300 words but no founder heading, and with 300 words plus `chr(8212)`. Each must fail on `stories_body_check`.

- [ ] **Step 5: Prove the RPCs as the admin (rolled back)**

Use a pending story `<A>` and two more pending stories `<B>` and `<C>`:

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN>', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.admin_merge_story('<A>', '<A>');                 -- false: self
select public.admin_merge_story('<B>', '<A>');                 -- true
select public.admin_merge_story('<C>', '<B>');                 -- false: target is merged
select public.admin_merge_story('<A>', '<C>');                 -- true: A (with child B) into C
select id, status, merged_into from public.stories where id in ('<A>', '<B>', '<C>');
--   A merged -> C, B merged -> C (re-pointed), C pending
select * from public.story_sources('<C>');                     -- 0 rows: C is not published
select public.admin_set_story_status('<C>', 'rejected');       -- true
select id, status, merged_into from public.stories where id in ('<A>', '<B>', '<C>');
--   all three rejected, merged_into null
rollback;
```

Then publish-path checks, as the admin, rolled back:

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN>', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.admin_publish_story('<A>', 'probe-slug-aaaaaa', 'Probe headline',
  repeat('s', 60), repeat('word ', 300) || E'\n## What it means for founders\n- one',
  'research', false, '{}');                                    -- returns a slug
select * from public.story_sources('<A>');                     -- 1 row: A's own source
rollback;
```

And with a 50-word body, the same call must raise `stories_body_check`.

Also as anon:

```sql
begin;
set local role anon;
select public.admin_merge_story('<B>', '<A>');                 -- ERROR: permission denied
rollback;
```

- [ ] **Step 6: Update the hand-written database types**

In `src/lib/supabase/database.types.ts`, add to the `stories` Row after `take: string | null`:

```ts
          /** Restricted Markdown article. Null for stories published before full stories. */
          body: string | null
          /** Generated from body: whitespace-split word count, 0 when null. */
          body_words: number
          /** Set only when status is 'merged': the story this row is a source of. */
          merged_into: string | null
```

Change the `status` doc if present, then replace the `admin_publish_story` and `admin_set_story_status` entries and add two functions:

```ts
      /** Admin-only. Returns the story's slug, or null if not admin / not found. */
      admin_publish_story: {
        Args: {
          p_story_id: string
          p_slug: string
          p_headline: string
          p_summary: string
          p_body: string | null
          p_beat: string
          p_featured: boolean
          p_tool_slugs: string[]
        }
        Returns: string | null
      }
      /** Admin-only. Merge a pending or rejected row into a pending or published story. */
      admin_merge_story: {
        Args: { p_story_id: string; p_into_id: string }
        Returns: boolean
      }
      /** Admin-only. 'rejected' from pending (with its merged rows), or 'pending' from published or merged. */
      admin_set_story_status: {
        Args: { p_story_id: string; p_status: string }
        Returns: boolean
      }
      /** Anon-callable. A published story's sources; empty for any other story. */
      story_sources: {
        Args: { p_story_id: string }
        Returns: { source_name: string; source_site_url: string; source_url: string }[]
      }
```

- [ ] **Step 7: Update the RLS audit probes and their test**

In `scripts/audit-rls/expectations.mjs`, add to `ANON_INVISIBLE_QUERIES`:

```js
  {
    label: "stories (merged)",
    path: "stories?select=id&status=eq.merged&limit=5",
  },
```

In the `admin_publish_story` probe body, replace `p_take: null,` with `p_body: null,`. After the `admin_set_story_status` probe, add:

```js
  { fn: "admin_merge_story", body: { p_story_id: NIL_UUID, p_into_id: NIL_UUID } },
```

In `scripts/audit-rls/expectations.test.mjs`, the label list becomes:

```js
    expect(ANON_INVISIBLE_QUERIES.map((q) => q.label)).toEqual([
      "stories (unpublished)",
      "story_tools (unpublished)",
      "stories (merged)",
    ]);
```

The fn list gains `"admin_merge_story"` as the last entry.

- [ ] **Step 8: Run the audit and the tests**

Run: `pnpm audit:rls`
Expected: every line PASS (19 checks), then "RLS holds."

Run: `pnpm test scripts/audit-rls`
Expected: PASS.

Run: `pnpm typecheck`
Expected: FAIL, because `src/app/admin/news/actions.ts` still passes `p_take`. Task 5 fixes this. To keep the commit green, make the one-line bridge now: in `actions.ts`, change `p_take: story.take ?? null,` to `p_body: null,`. In `actions.test.ts`, change the expected `p_take: null,` to `p_body: null,`. Then run `pnpm verify`. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/database.types.ts scripts/audit-rls/expectations.mjs scripts/audit-rls/expectations.test.mjs src/app/admin/news/actions.ts src/app/admin/news/actions.test.ts
git commit -m "feat(news): stories carry a body and merged sources (migration full_stories)"
```

---

### Task 2: Body rules and the body parser

**Files:**
- Modify: `src/lib/news/schemas.ts`
- Modify: `src/lib/news/schemas.test.ts`
- Create: `src/lib/news/article-body.ts`
- Create: `src/lib/news/article-body.test.ts`

**Interfaces:**
- Produces, from `@/lib/news/schemas`:
  - `BODY_MIN_WORDS = 300`, `BODY_MAX_WORDS = 1200`
  - `FOUNDER_HEADING = "What it means for founders"`
  - `countWords(text: string | null | undefined): number`
  - `bodyProblems(body: string): string[]` (empty when valid)
  - `storyPublishSchema` with `body?: string` in place of `take`. `StoryPublishInput` follows it.
- Removes: `TAKE_MAX`, `TAKE_INDEXABLE_MIN`, `isIndexableTake` (Task 3 replaces their callers).
- Produces, from `@/lib/news/article-body`:
  - `type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; text: string; href: string }`
  - `type Block = { type: "paragraph"; inlines: Inline[] } | { type: "heading"; text: string } | { type: "list"; items: Inline[][] }`
  - `parseInline(text: string): Inline[]`
  - `parseArticleBody(body: string): Block[]`
  - `splitFounderSection(blocks: Block[]): { main: Block[]; founders: Block[] | null }`

- [ ] **Step 1: Write the failing schema tests**

In `src/lib/news/schemas.test.ts`, delete the `isIndexableTake` import and its `describe` block. Add these imports:

```ts
import {
  BODY_MAX_WORDS,
  BODY_MIN_WORDS,
  FOUNDER_HEADING,
  bodyProblems,
  countWords,
  storyPublishSchema,
} from "@/lib/news/schemas";
```

(Merge them with the file's existing import of `storyPublishSchema`.) Add:

```ts
const DASHES = String.fromCharCode(0x2013, 0x2014);

function body(words: number, extra = ""): string {
  // "## What it means for founders" is 6 words ("##" counts); the rest are filler.
  return `${"word ".repeat(words - 6)}\n\n## ${FOUNDER_HEADING}\n${extra}`;
}

describe("countWords", () => {
  it("splits on any whitespace and ignores padding", () => {
    expect(countWords("  one\ttwo\n\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
  });
});

describe("bodyProblems", () => {
  it("accepts the word-count boundaries", () => {
    expect(bodyProblems(body(BODY_MIN_WORDS))).toEqual([]);
    expect(bodyProblems(body(BODY_MAX_WORDS))).toEqual([]);
  });

  it("rejects one word either side of the boundaries", () => {
    expect(bodyProblems(body(BODY_MIN_WORDS - 1))).toHaveLength(1);
    expect(bodyProblems(body(BODY_MAX_WORDS + 1))).toHaveLength(1);
  });

  it("rejects either dash", () => {
    for (const dash of DASHES) {
      expect(bodyProblems(body(BODY_MIN_WORDS) + ` a${dash}b`).join(" ")).toMatch(/dash/i);
    }
  });

  it("requires the founder heading on its own line", () => {
    const noHeading = "word ".repeat(BODY_MIN_WORDS);
    expect(bodyProblems(noHeading).join(" ")).toMatch(/founders/);
    const inline = `${"word ".repeat(BODY_MIN_WORDS)} ## ${FOUNDER_HEADING}`;
    expect(bodyProblems(inline).join(" ")).toMatch(/founders/);
  });
});

describe("storyPublishSchema body", () => {
  const base = {
    id: "3f2a9c10-5b7e-4d21-9a0b-2c4d6e8f1a3b",
    headline: "H",
    summary: "A summary that is comfortably over forty characters long.",
    beat: "research",
    featured: false,
    toolSlugs: [],
  };

  it("treats a blank body as absent", () => {
    const parsed = storyPublishSchema.parse({ ...base, body: "   " });
    expect(parsed.body).toBeUndefined();
  });

  it("refuses a body that breaks the rules", () => {
    expect(storyPublishSchema.safeParse({ ...base, body: "too short" }).success).toBe(false);
  });

  it("accepts a valid body, trimmed", () => {
    const parsed = storyPublishSchema.parse({ ...base, body: `  ${body(BODY_MIN_WORDS)}  ` });
    expect(parsed.body?.startsWith("word")).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test src/lib/news/schemas.test.ts`
Expected: FAIL. `countWords` and `bodyProblems` are not exported.

- [ ] **Step 3: Implement the rules in `src/lib/news/schemas.ts`**

Replace the take constants and `isIndexableTake` with the following:

```ts
export const BODY_MIN_WORDS = 300;
export const BODY_MAX_WORDS = 1200;
/** A story page is indexable once its body reaches this many words (full-stories spec §6). */
export const BODY_INDEXABLE_MIN_WORDS = BODY_MIN_WORDS;
export const FOUNDER_HEADING = "What it means for founders";

// Built from char codes: the editing tools decode escape sequences into the real characters.
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);
const FOUNDER_LINE = new RegExp(`^## ${FOUNDER_HEADING}[ \\t]*$`, "m");

/** Whitespace-split word count. Must agree with the generated column stories.body_words. */
export function countWords(text: string | null | undefined): number {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Why a body would be refused, in plain words. Mirrors the stories_body_check constraint. */
export function bodyProblems(body: string): string[] {
  const problems: string[] = [];
  const words = countWords(body);
  if (words < BODY_MIN_WORDS || words > BODY_MAX_WORDS) {
    problems.push(`The story needs ${BODY_MIN_WORDS} to ${BODY_MAX_WORDS} words (it has ${words}).`);
  }
  if (body.includes(EN_DASH) || body.includes(EM_DASH)) {
    problems.push("Replace the en or em dash with a comma, colon or full stop.");
  }
  if (!FOUNDER_LINE.test(body)) {
    problems.push(`Add the heading "## ${FOUNDER_HEADING}" on its own line.`);
  }
  return problems;
}
```

In `storyPublishSchema`, replace the `take` field with:

```ts
  body: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      for (const message of bodyProblems(v)) ctx.addIssue({ code: "custom", message });
    }),
```

- [ ] **Step 4: Run the schema tests**

Run: `pnpm test src/lib/news/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing parser tests**

Create `src/lib/news/article-body.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseArticleBody, parseInline, splitFounderSection } from "@/lib/news/article-body";

describe("parseInline", () => {
  it("reads bold and https links between plain text", () => {
    expect(parseInline("A **big** move, per [Ars](https://arstechnica.com/x).")).toEqual([
      { type: "text", text: "A " },
      { type: "bold", text: "big" },
      { type: "text", text: " move, per " },
      { type: "link", text: "Ars", href: "https://arstechnica.com/x" },
      { type: "text", text: "." },
    ]);
  });

  it("leaves non-https links as literal text", () => {
    expect(parseInline("[x](javascript:alert(1)) and [y](http://a.b)")).toEqual([
      { type: "text", text: "[x](javascript:alert(1)) and [y](http://a.b)" },
    ]);
  });

  it("leaves raw HTML as literal text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { type: "text", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("parseArticleBody", () => {
  it("builds paragraphs, headings and lists", () => {
    const blocks = parseArticleBody(
      "First line\nstill first.\n\n## What it means for founders\n- one\n- **two**\n\nLast.",
    );
    expect(blocks).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "First line still first." }] },
      { type: "heading", text: "What it means for founders" },
      {
        type: "list",
        items: [[{ type: "text", text: "one" }], [{ type: "bold", text: "two" }]],
      },
      { type: "paragraph", inlines: [{ type: "text", text: "Last." }] },
    ]);
  });

  it("treats other Markdown as plain text", () => {
    expect(parseArticleBody("# Big\n> quote")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "# Big > quote" }] },
    ]);
  });

  it("handles Windows line endings and an empty body", () => {
    expect(parseArticleBody("a\r\n\r\nb")).toHaveLength(2);
    expect(parseArticleBody("   ")).toEqual([]);
  });
});

describe("splitFounderSection", () => {
  it("splits at the founder heading", () => {
    const blocks = parseArticleBody("Lede.\n\n## What it means for founders\n- one");
    const { main, founders } = splitFounderSection(blocks);
    expect(main).toHaveLength(1);
    expect(founders?.[0]).toEqual({ type: "heading", text: "What it means for founders" });
    expect(founders).toHaveLength(2);
  });

  it("returns null founders when there is no heading", () => {
    expect(splitFounderSection(parseArticleBody("Just text.")).founders).toBeNull();
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm test src/lib/news/article-body.test.ts`
Expected: FAIL. The module does not exist.

- [ ] **Step 7: Implement `src/lib/news/article-body.ts`**

```ts
import { FOUNDER_HEADING } from "@/lib/news/schemas";

/**
 * The restricted Markdown a story body is written in (full-stories spec §4):
 * paragraphs, "## " headings, "- " list items, **bold** and https links.
 * Everything else stays literal text. The output is data, never HTML, so a
 * body cannot inject markup.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "heading"; text: string }
  | { type: "list"; items: Inline[][] };

const INLINE = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    if (match[1] !== undefined) out.push({ type: "bold", text: match[1] });
    else out.push({ type: "link", text: match[2], href: match[3] });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseArticleBody(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushList();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      flushParagraph();
      list.push(parseInline(line.slice(2).trim()));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** The body before the founder heading, and the heading plus everything after it. */
export function splitFounderSection(blocks: Block[]): { main: Block[]; founders: Block[] | null } {
  const at = blocks.findIndex((b) => b.type === "heading" && b.text === FOUNDER_HEADING);
  if (at === -1) return { main: blocks, founders: null };
  return { main: blocks.slice(0, at), founders: blocks.slice(at) };
}
```

- [ ] **Step 8: Run the parser tests**

Run: `pnpm test src/lib/news/article-body.test.ts`
Expected: PASS.

- [ ] **Step 9: Leave the typecheck red on purpose, then commit**

`pnpm typecheck` now fails where `isIndexableTake` and `take` are still used (`story-meta.ts`, `stories.ts`, `story-editor.tsx`, `actions.ts`). Those callers belong to Tasks 3 and 5. The pre-commit hook runs `pnpm verify`, so **do not commit yet**: continue straight into Task 3 and commit Tasks 2 and 3 together at the end of Task 3.

---

### Task 3: Public reads, indexing and structured data

**Files:**
- Modify: `src/lib/news/stories.ts`
- Modify: `src/lib/news/stories.test.ts`
- Modify: `src/lib/news/story-meta.ts`
- Modify: `src/lib/news/story-meta.test.ts`
- Modify: `src/lib/structured-data.ts:160-178`
- Modify: `src/lib/structured-data.test.ts:104-138`
- Modify: `src/test/supabase-stub.ts` (add `gte`)
- Modify: `src/app/admin/news/actions.ts`, `src/app/admin/news/story-editor.tsx`, `src/app/admin/news/types.ts`, `src/app/admin/news/page.tsx` (only the minimal take-to-body swap needed to typecheck; Task 5 builds the real editor)

**Interfaces:**
- Consumes: `BODY_INDEXABLE_MIN_WORDS` and `countWords` (Task 2); the `story_sources` RPC and `body` / `body_words` columns (Task 1).
- Produces, from `@/lib/news/stories`:
  - `type PublicStoryDetail = PublicStory & { body: string | null; bodyWords: number }`
  - `getPublishedStory(slug: string): Promise<PublicStoryDetail | null>`
  - `type StorySource = { name: string; siteUrl: string; url: string }`
  - `getStorySources(storyId: string): Promise<StorySource[]>`
  - `listIndexableStories()`, which now keys on `body_words`
- Produces, from `@/lib/news/story-meta`: `storyRobots(bodyWords: number): { index: boolean; follow: true }`
- Produces, from `@/lib/structured-data`: `newsArticleJsonLd(story: PublicStoryDetail, sources: StorySource[])`

- [ ] **Step 1: Add `gte` to the query stub**

In `src/test/supabase-stub.ts`, add `"gte",` to the `methods` array after `"neq",`.

- [ ] **Step 2: Write the failing tests**

`src/lib/news/story-meta.test.ts`: replace the `storyRobots` block with:

```ts
describe("storyRobots", () => {
  it("indexes a page whose body reaches 300 words", () => {
    expect(storyRobots(300)).toEqual({ index: true, follow: true });
    expect(storyRobots(299)).toEqual({ index: false, follow: true });
    expect(storyRobots(0)).toEqual({ index: false, follow: true });
  });
});
```

`src/lib/news/stories.test.ts`: add `getStorySources` to the destructured import. Replace the `listIndexableStories` block and add a sources block and a detail test:

```ts
describe("getPublishedStory", () => {
  it("returns the body and its word count with the story", async () => {
    respond({ data: { ...row, body: "Some body.", body_words: 2 }, error: null });
    const story = await getPublishedStory(row.slug);
    expect(story?.body).toBe("Some body.");
    expect(story?.bodyWords).toBe(2);
  });
});

describe("listIndexableStories", () => {
  it("keeps only stories whose body is long enough to index", async () => {
    respond({
      data: [
        { slug: "a-story", body_words: 300, published_at: "2026-09-21T10:00:00Z" },
        { slug: "b-story", body_words: 120, published_at: "2026-09-21T09:00:00Z" },
        { slug: "c-story", body_words: 0, published_at: "2026-09-21T08:00:00Z" },
      ],
      error: null,
    });
    expect(await listIndexableStories()).toEqual([
      { slug: "a-story", publishedAt: "2026-09-21T10:00:00Z" },
    ]);
    expect(builder().gte).toHaveBeenCalledWith("body_words", 300);
  });
});

describe("getStorySources", () => {
  it("maps the RPC rows to sources, primary first", async () => {
    rpc.mockResolvedValue({
      data: [
        { source_name: "TechCrunch", source_site_url: "https://techcrunch.com", source_url: "https://techcrunch.com/a" },
        { source_name: "Ars Technica", source_site_url: "https://arstechnica.com", source_url: "https://arstechnica.com/b" },
      ],
      error: null,
    });
    expect(await getStorySources(row.id)).toEqual([
      { name: "TechCrunch", siteUrl: "https://techcrunch.com", url: "https://techcrunch.com/a" },
      { name: "Ars Technica", siteUrl: "https://arstechnica.com", url: "https://arstechnica.com/b" },
    ]);
    expect(rpc).toHaveBeenCalledWith("story_sources", { p_story_id: row.id });
  });

  it("degrades to an empty list when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await getStorySources(row.id)).toEqual([]);
  });
});
```

If the file already has a `getPublishedStory` describe block, add the new `it` inside it instead of creating a second block.

`src/lib/structured-data.test.ts`: in the `newsArticleJsonLd` fixture, add `body: "word ".repeat(400), bodyWords: 400,`. Add a `sources` constant:

```ts
  const sources = [
    { name: "The Verge", siteUrl: "https://www.theverge.com", url: "https://www.theverge.com/story" },
    { name: "Ars Technica", siteUrl: "https://arstechnica.com", url: "https://arstechnica.com/story" },
  ];
```

Change every `newsArticleJsonLd(story)` to `newsArticleJsonLd(story, sources)`. In the first test, replace the `isBasedOn` expectation with:

```ts
    expect(ld.isBasedOn).toEqual(sources.map((s) => s.url));
    expect(ld.wordCount).toBe(400);
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test src/lib/news src/lib/structured-data.test.ts`
Expected: FAIL. `getStorySources` is missing, `storyRobots` takes a string, and `wordCount` is undefined.

- [ ] **Step 4: Implement `story-meta.ts`**

```ts
import { BODY_INDEXABLE_MIN_WORDS } from "@/lib/news/schemas";
```

replaces the `isIndexableTake` import, and:

```ts
/**
 * A story page is `noindex, follow` until it carries a full article (full-stories
 * spec §6). Summary-only pages are the thin pages roadmap item 0.1b removed.
 */
export function storyRobots(bodyWords: number): { index: boolean; follow: true } {
  return { index: bodyWords >= BODY_INDEXABLE_MIN_WORDS, follow: true };
}
```

- [ ] **Step 5: Implement `stories.ts`**

Replace the `isIndexableTake` import with `import { BODY_INDEXABLE_MIN_WORDS } from "@/lib/news/schemas";`. Add after `toPublicStory`:

```ts
export type PublicStoryDetail = PublicStory & { body: string | null; bodyWords: number };

export type StorySource = { name: string; siteUrl: string; url: string };
```

Replace `getPublishedStory`:

```ts
export async function getPublishedStory(slug: string): Promise<PublicStoryDetail | null> {
  if (!SLUG_RE.test(slug)) return null;
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(`${PUBLIC_STORY_COLUMNS}, body, body_words`)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    "getPublishedStory",
  );
  if (!result?.data) return null;
  const row = result.data as unknown as PublicStoryRow & { body: string | null; body_words: number | null };
  const story = toPublicStory(row);
  return story ? { ...story, body: row.body, bodyWords: row.body_words ?? 0 } : null;
}

/** Every source of a published story, its own first. Empty on failure; the page falls back to the story's own source. */
export async function getStorySources(storyId: string): Promise<StorySource[]> {
  const result = await withTimeout(
    createAnonClient().rpc("story_sources", { p_story_id: storyId }),
    "getStorySources",
  );
  return ((result?.data ?? []) as { source_name: string; source_site_url: string; source_url: string }[]).map(
    (r) => ({ name: r.source_name, siteUrl: r.source_site_url, url: r.source_url }),
  );
}
```

Replace `listIndexableStories`:

```ts
/** Stories with a full article, for the sitemap. */
export async function listIndexableStories(): Promise<{ slug: string; publishedAt: string }[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select("slug, body_words, published_at")
      .eq("status", "published")
      .gte("body_words", BODY_INDEXABLE_MIN_WORDS)
      .order("published_at", { ascending: false })
      .limit(5000),
    "listIndexableStories",
  );
  const rows = (result?.data ?? []) as { slug: string | null; body_words: number | null; published_at: string | null }[];
  return rows.flatMap((r) =>
    r.slug && r.published_at && (r.body_words ?? 0) >= BODY_INDEXABLE_MIN_WORDS
      ? [{ slug: r.slug, publishedAt: r.published_at }]
      : [],
  );
}
```

- [ ] **Step 6: Implement `newsArticleJsonLd`**

In `src/lib/structured-data.ts`, change the import of `PublicStory` to `PublicStoryDetail, StorySource` (from the same module), then:

```ts
/** NewsArticle, emitted only on story pages that are indexable (full-stories spec §6). */
export function newsArticleJsonLd(story: PublicStoryDetail, sources: StorySource[]) {
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
    isBasedOn: sources.length > 0 ? sources.map((s) => s.url) : [story.sourceUrl],
    wordCount: story.bodyWords,
  };
}
```

- [ ] **Step 7: Make the admin compile on the new schema (minimal swap)**

In `src/app/admin/news/types.ts`, replace `take: string;` with `body: string;`. In `src/app/admin/news/page.tsx`, add `body` to the `columns` string after `take`, and replace `take: r.take ?? "",` with `body: r.body ?? "",`. In `src/app/admin/news/story-editor.tsx`:
- Rename the `take` state to `body` (initialised from `story.body`).
- Pass `body` in `publishStory({ ... })`.
- Relabel the take textarea "Story", with the indexable hint replaced by `{countWords(body)} words`.
- Import `countWords` in place of `isIndexableTake`.

In `src/app/admin/news/actions.ts`, change `p_body: null,` (from Task 1's bridge) to `p_body: story.body ?? null,`. In `actions.test.ts`, change `{ ...valid, take: "   " }` to `{ ...valid, body: "   " }` (the expected `p_body: null` stays).

- [ ] **Step 8: Run the whole gate**

Run: `pnpm verify`
Expected: PASS. If `src/app/news/[slug]/page.tsx` fails to typecheck on `storyRobots(story.take)` or `newsArticleJsonLd(story)`, make the minimal change: `storyRobots(story.bodyWords)` and `newsArticleJsonLd(story, [])`. Task 4 rewrites that page.

- [ ] **Step 9: Commit Tasks 2 and 3 together**

```bash
git add src/lib/news/schemas.ts src/lib/news/schemas.test.ts src/lib/news/article-body.ts src/lib/news/article-body.test.ts src/lib/news/stories.ts src/lib/news/stories.test.ts src/lib/news/story-meta.ts src/lib/news/story-meta.test.ts src/lib/structured-data.ts src/lib/structured-data.test.ts src/test/supabase-stub.ts src/app/admin/news/actions.ts src/app/admin/news/actions.test.ts src/app/admin/news/story-editor.tsx src/app/admin/news/types.ts src/app/admin/news/page.tsx "src/app/news/[slug]/page.tsx"
git commit -m "feat(news): body rules, a restricted Markdown parser, and word-count indexing"
```

---

### Task 4: The story page, the body component and the copy

**Files:**
- Create: `src/components/news/article-body.tsx`
- Create: `src/components/news/article-body.test.tsx`
- Modify: `src/app/news/[slug]/page.tsx`
- Modify: `src/app/news/about/page.tsx:19-28`

**Interfaces:**
- Consumes: `parseArticleBody`, `splitFounderSection`, `Block`, `Inline` (Task 2); `getPublishedStory`, `getStorySources`, `StorySource`, `storyRobots`, `newsArticleJsonLd` (Task 3).
- Produces: `ArticleBody({ body }: { body: string })`, a server-compatible component (no hooks, no `"use client"`).

- [ ] **Step 1: Write the failing component test**

It follows `src/components/news/beat-row.test.tsx` (`@testing-library/react`, with `cleanup` after each test):

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArticleBody } from "@/components/news/article-body";

const BODY = [
  "The lede, with a [source](https://techcrunch.com/a).",
  "",
  "<script>alert(1)</script> and [bad](javascript:alert(1))",
  "",
  "## What it means for founders",
  "- **Costs** fall.",
].join("\n");

describe("ArticleBody", () => {
  afterEach(cleanup);

  it("renders headings, lists and https links", () => {
    render(<ArticleBody body={BODY} />);
    expect(screen.getByRole("heading", { name: "What it means for founders" })).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toBe("Costs fall.");
    const link = screen.getByRole("link", { name: "source" });
    expect(link.getAttribute("href")).toBe("https://techcrunch.com/a");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders HTML and unsafe links as inert text", () => {
    const { container } = render(<ArticleBody body={BODY} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("wraps the founder section in its own labelled section", () => {
    const { container } = render(<ArticleBody body={BODY} />);
    const section = container.querySelector("section[aria-labelledby]");
    expect(section?.textContent).toContain("Costs fall.");
    expect(section?.textContent).not.toContain("The lede");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test src/components/news/article-body.test.tsx`
Expected: FAIL. The module does not exist.

- [ ] **Step 3: Implement `src/components/news/article-body.tsx`**

```tsx
import { Fragment } from "react";
import { parseArticleBody, splitFounderSection, type Block, type Inline } from "@/lib/news/article-body";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((part, i) => {
        if (part.type === "bold") return <strong key={i} className="font-semibold text-foreground">{part.text}</strong>;
        if (part.type === "link") {
          return (
            <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="text-teal underline-offset-2 hover:underline">
              {part.text}
            </a>
          );
        }
        return <Fragment key={i}>{part.text}</Fragment>;
      })}
    </>
  );
}

function Blocks({ blocks, headingId }: { blocks: Block[]; headingId?: string }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h2 key={i} id={i === 0 ? headingId : undefined} className="font-display text-2xl font-semibold text-foreground">
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="flex list-disc flex-col gap-2 pl-5 marker:text-teal">
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed text-pretty">
                  <Inlines inlines={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-relaxed text-pretty">
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </>
  );
}

/** A story body in Enki's restricted Markdown. Renders data, never HTML. */
export function ArticleBody({ body }: { body: string }) {
  const { main, founders } = splitFounderSection(parseArticleBody(body));
  return (
    <div className="flex flex-col gap-5 text-base text-foreground/90">
      <Blocks blocks={main} />
      {founders ? (
        <section aria-labelledby="founders-heading" className="flex flex-col gap-4 border-l-2 border-teal/60 pl-5">
          <Blocks blocks={founders} headingId="founders-heading" />
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the component test**

Run: `pnpm test src/components/news/article-body.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rewrite the story page**

In `src/app/news/[slug]/page.tsx`:

1. Add imports: `getStorySources, type StorySource` from `@/lib/news/stories`, and `ArticleBody` from `@/components/news/article-body`.
2. In `generateMetadata`, change `robots: storyRobots(story.take)` to `robots: storyRobots(story.bodyWords)`.
3. In `StoryPage`, fetch sources with the tools:

```tsx
  const [tools, more, fetchedSources] = await Promise.all([
    getStoryTools(story.id),
    listMoreInBeat(story.beat, story.id),
    getStorySources(story.id),
  ]);
  const sources: StorySource[] =
    fetchedSources.length > 0
      ? fetchedSources
      : [{ name: story.sourceName, siteUrl: story.sourceSiteUrl, url: story.sourceUrl }];
  const outletNames = [...new Set(sources.map((s) => s.name))];
  const hasBody = story.body !== null && story.bodyWords > 0;
  const now = new Date();
  const indexable = storyRobots(story.bodyWords).index;
```

The `reportedAt` line stays, but is used only by legacy stories.

4. JSON-LD: `{indexable ? <JsonLd data={newsArticleJsonLd(story, sources)} /> : null}`.
5. Replace the meta line `<p>` with:

```tsx
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="text-foreground">By Enki</span>
            <span aria-hidden>·</span>
            {hasBody ? (
              <>
                <time dateTime={story.publishedAt}>{formatAge(story.publishedAt, now)}</time>
                <span aria-hidden>·</span>
                <span className="break-words">Reporting from {outletNames.join(", ")}</span>
              </>
            ) : (
              <>
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
              </>
            )}
          </p>
```

6. Replace everything from the summary `<p>` down to (and including) the "Read the full story" `<a>` with:

```tsx
        <p className="text-lg leading-relaxed text-pretty">{story.summary}</p>

        {hasBody && story.body ? (
          <>
            <ArticleBody body={story.body} />
            <section className="flex flex-col gap-3 border-t border-border pt-6">
              <h2 className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Sources</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {sources.map((source) => (
                  <li key={source.url} className="min-w-0">
                    <a
                      href={safeExternalHref(source.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <span className="break-words">{source.name}</span>
                      <Icon name="ArrowUpRight" className="size-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
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
          </>
        )}
```

- [ ] **Step 6: Reword `/news/about`**

In `src/app/news/about/page.tsx`, replace the first two paragraphs (lines 19 to 28) with:

```tsx
        <p>
          Enki follows a set of AI news sources every day and picks the stories worth your time.
          Each story is written by Enki from the reporting of the outlets it lists as sources, and
          every one of them is linked. Their original reporting belongs to them.
        </p>
        <p>
          The section headed &ldquo;What it means for founders&rdquo; is Enki&apos;s own analysis:
          what the news changes for people building companies. Where outlets disagree on a detail,
          we leave it out rather than guess.
        </p>
```

Update the page `description` metadata to: `"Where Enki's AI news comes from, how stories are written from their sources, and how tool links work."` Then run `grep -rn "Summary by Enki" src` and expect no output.

- [ ] **Step 7: Run the gate**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 8: Visual sweep**

No published story has a body yet. To see the new layout, run through `execute_sql` a temporary update on one published story (note its slug; restore it afterwards):

```sql
update public.stories set body =
  'Opening paragraph with a [link](https://techcrunch.com/). ' || repeat('Filler sentence for layout. ', 60)
  || E'\n\n## What it means for founders\n\n- **First point** with detail.\n- Second point.\n- Third point.'
 where slug = '<SLUG>' returning body_words;
```

Start the preview with `preview_start` `{ name: "enki-dev" }`. Then run:

```bash
pnpm sweep -- / /tools /news /news/<SLUG> /news/about
```

Expected: every route at 390px and 1440px reads PASS. Take one screenshot of `/news/<SLUG>` at 390px and one at 1440px, and check:
- the founder rule
- "By Enki · … · Reporting from …"
- the Sources list
- no JSON-LD errors in the console

Then restore the story with `update public.stories set body = null where slug = '<SLUG>';`. Also sweep one legacy (no-body) story page, and confirm it still shows the "Read the full story" button with "By Enki".

- [ ] **Step 9: Commit**

```bash
git add src/components/news/article-body.tsx src/components/news/article-body.test.tsx "src/app/news/[slug]/page.tsx" src/app/news/about/page.tsx
git commit -m "feat(news): story pages render the full article, founder section and sources"
```

---

### Task 5: Admin editor, sources panel and merging

**Files:**
- Modify: `src/app/admin/news/actions.ts`
- Modify: `src/app/admin/news/actions.test.ts`
- Modify: `src/app/admin/news/types.ts`
- Modify: `src/app/admin/news/page.tsx`
- Modify: `src/app/admin/news/news-queue.tsx`
- Modify: `src/app/admin/news/story-editor.tsx`

**Interfaces:**
- Consumes: `bodyProblems`, `countWords`, `BODY_MIN_WORDS`, `BODY_MAX_WORDS`, `FOUNDER_HEADING` (Task 2); the RPCs `admin_merge_story` and `admin_set_story_status` (Task 1).
- Produces:
  - `mergeStory(id: string, intoId: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `QueueSource = { id: string; sourceName: string; sourceUrl: string }`
  - `QueueStory.sources: QueueSource[]`
  - `MergeTarget = { id: string; headline: string }`
  - `NewsQueue` and `StoryEditor` take `mergeTargets: MergeTarget[]`

- [ ] **Step 1: Write the failing action tests**

In `src/app/admin/news/actions.test.ts`, add `mergeStory` to the destructured import and append:

```ts
const INTO = "9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d";

describe("mergeStory", () => {
  it("refuses a non-admin", async () => {
    const stub = supabaseStub({ isAdmin: false });
    createClient.mockReturnValue(stub);
    expect((await mergeStory(ID, INTO)).ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_merge_story", expect.anything());
  });

  it("refuses bad ids and self-merges before touching the database", async () => {
    const stub = supabaseStub({ isAdmin: true });
    createClient.mockReturnValue(stub);
    expect((await mergeStory("not-a-uuid", INTO)).ok).toBe(false);
    expect((await mergeStory(ID, ID)).ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_merge_story", expect.anything());
  });

  it("merges through the guarded RPC and refreshes the queue", async () => {
    const stub = supabaseStub({ isAdmin: true, rpc: { admin_merge_story: { data: true, error: null } } });
    createClient.mockReturnValue(stub);
    expect(await mergeStory(ID, INTO)).toEqual({ ok: true });
    expect(stub.rpc).toHaveBeenCalledWith("admin_merge_story", { p_story_id: ID, p_into_id: INTO });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/news");
    expect(revalidatePath).toHaveBeenCalledWith("/news", "layout");
  });

  it("reports a merge the database refused", async () => {
    createClient.mockReturnValue(
      supabaseStub({ isAdmin: true, rpc: { admin_merge_story: { data: false, error: null } } }),
    );
    const res = await mergeStory(ID, INTO);
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("publishStory body", () => {
  it("passes a valid body to the RPC", async () => {
    const stub = supabaseStub({ isAdmin: true, rpc: { admin_publish_story: { data: "s-3f2a9c", error: null } } });
    createClient.mockReturnValue(stub);
    const body = `${"word ".repeat(295)}\n## What it means for founders\n`;
    await publishStory({ ...valid, body });
    expect(stub.rpc).toHaveBeenCalledWith("admin_publish_story", expect.objectContaining({ p_body: body.trim() }));
  });

  it("refuses an invalid body before the database", async () => {
    const stub = supabaseStub({ isAdmin: true });
    createClient.mockReturnValue(stub);
    const res = await publishStory({ ...valid, body: "far too short" });
    expect(res.ok).toBe(false);
    expect(stub.rpc).not.toHaveBeenCalledWith("admin_publish_story", expect.anything());
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test src/app/admin/news/actions.test.ts`
Expected: FAIL. `mergeStory` is not exported.

- [ ] **Step 3: Implement `mergeStory`**

Add to `src/app/admin/news/actions.ts`, after `setStoryStatus`:

```ts
const mergeSchema = z
  .object({ id: z.uuid(), intoId: z.uuid() })
  .refine((v) => v.id !== v.intoId, "A story cannot be merged into itself.");

export async function mergeStory(id: string, intoId: string): Promise<{ ok: true } | Fail> {
  const admin = await assertAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };

  const parsed = mergeSchema.safeParse({ id, intoId });
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_merge_story", {
    p_story_id: parsed.data.id,
    p_into_id: parsed.data.intoId,
  });
  if (error) {
    console.error("[enki] mergeStory failed", error);
    return { ok: false, error: "Could not merge the story. Try again." };
  }
  if (!data) return { ok: false, error: "That merge is not allowed. The target may have moved on." };

  revalidatePath("/admin/news");
  // Merging into a published story changes its public Sources list.
  revalidatePath("/news", "layout");
  return { ok: true };
}
```

- [ ] **Step 4: Run the action tests**

Run: `pnpm test src/app/admin/news/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend the types**

In `src/app/admin/news/types.ts`:

```ts
/** A duplicate row merged into a story as one of its sources. */
export type QueueSource = { id: string; sourceName: string; sourceUrl: string };

/** A story another row can be merged into. */
export type MergeTarget = { id: string; headline: string };
```

Add `sources: QueueSource[];` to `QueueStory`, after `sourceUrl`.

- [ ] **Step 6: Load sources and merge targets in the admin page**

In `src/app/admin/news/page.tsx`, extend the second `Promise.all` (the one keyed on `ids`) with a third query for merged children, and add a published-targets query for the pending view:

```ts
  const [excerptRes, toolRes, childRes] =
    ids.length > 0
      ? await Promise.all([
          supabase.from("story_excerpts").select("story_id, excerpt").in("story_id", ids),
          supabase.from("story_tools").select("story_id, tool_slug, position").in("story_id", ids).order("position"),
          supabase.from("stories").select("id, merged_into, source_name, source_url").eq("status", "merged").in("merged_into", ids),
        ])
      : [
          { data: [] as { story_id: string; excerpt: string }[] },
          { data: [] as { story_id: string; tool_slug: string; position: number }[] },
          { data: [] as { id: string; merged_into: string | null; source_name: string; source_url: string }[] },
        ];

  const sourcesOf = new Map<string, QueueSource[]>();
  for (const c of childRes.data ?? []) {
    if (!c.merged_into) continue;
    sourcesOf.set(c.merged_into, [
      ...(sourcesOf.get(c.merged_into) ?? []),
      { id: c.id, sourceName: c.source_name, sourceUrl: c.source_url },
    ]);
  }

  const { data: publishedTargets } =
    view === "pending"
      ? await supabase.from("stories").select("id, headline").eq("status", "published").order("published_at", { ascending: false }).limit(30)
      : { data: [] as { id: string; headline: string }[] };
```

In the `stories` mapping, add `sources: sourcesOf.get(r.id) ?? [],`. After it:

```ts
  const mergeTargets: MergeTarget[] =
    view === "pending"
      ? [
          ...rows.map((r) => ({ id: r.id, headline: r.headline })),
          ...(publishedTargets ?? []).map((r) => ({ id: r.id, headline: `Published: ${r.headline}` })),
        ]
      : [];
```

Import `QueueSource` and `MergeTarget` from `./types`. Pass `mergeTargets={mergeTargets}` to `<NewsQueue>`, and update the keyboard hint to `J and K move between stories, P publishes, R rejects. Merge duplicates into one story before writing it.`

- [ ] **Step 7: Thread `mergeTargets` through the queue**

In `news-queue.tsx`:
- Add `mergeTargets: MergeTarget[]` to the props type and destructure it.
- Pass `mergeTargets={mergeTargets}` to `<StoryEditor>`.
- In the row button's meta line, after the tools count, add `{story.sources.length > 0 ? \` · ${story.sources.length + 1} sources\` : ""}`.

- [ ] **Step 8: Build the editor**

In `story-editor.tsx`, update the imports:

```ts
import { BODY_MAX_WORDS, BODY_MIN_WORDS, FOUNDER_HEADING, SUMMARY_MAX, SUMMARY_MIN, bodyProblems, countWords } from "@/lib/news/schemas";
import { mergeStory, publishStory, setStoryStatus } from "@/app/admin/news/actions";
import type { MergeTarget, QueueStory, ToolOption } from "@/app/admin/news/types";
```

Add the `mergeTargets: MergeTarget[]` prop. Add state and derived values:

```ts
  const [mergeInto, setMergeInto] = useState("");
  const words = countWords(body);
  const problems = body.trim() ? bodyProblems(body) : [];
  const wordsOk = words >= BODY_MIN_WORDS && words <= BODY_MAX_WORDS;

  const merge = () =>
    startTransition(async () => {
      const res = await mergeStory(story.id, mergeInto);
      if (res.ok) toast.success("Merged");
      else toast.error(res.error);
    });

  const unmerge = (id: string) =>
    startTransition(async () => {
      const res = await setStoryStatus(id, "pending");
      if (res.ok) toast.success("Unmerged");
      else toast.error(res.error);
    });
```

After the excerpt block, add the sources panel:

```tsx
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3 text-sm">
        <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
          Sources to read before writing ({story.sources.length + 1})
        </p>
        <ul className="flex flex-col gap-1.5">
          <li className="min-w-0">
            <a href={safeExternalHref(story.sourceUrl)} target="_blank" rel="noopener noreferrer" className="break-words hover:text-teal">
              {story.sourceName}
            </a>
          </li>
          {story.sources.map((s) => (
            <li key={s.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <a href={safeExternalHref(s.sourceUrl)} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words hover:text-teal">
                {s.sourceName}
              </a>
              <button type="button" disabled={pending} onClick={() => unmerge(s.id)} className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60">
                Unmerge
              </button>
            </li>
          ))}
        </ul>
      </div>
```

Replace the story textarea block from Task 3 with:

```tsx
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex flex-wrap justify-between gap-2">
          Story ({BODY_MIN_WORDS} to {BODY_MAX_WORDS} words, ending with &ldquo;## {FOUNDER_HEADING}&rdquo;)
          <span className={cn("tabular-nums", body.trim() === "" || wordsOk ? "text-muted-foreground" : "text-destructive")}>
            {words} words
          </span>
        </span>
        <textarea className={cn(field, "min-h-96 font-mono text-[0.8rem] leading-relaxed")} value={body} onChange={(e) => setBody(e.target.value)} />
        {problems.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </label>
```

In the actions row, before the "Open original" link, add the merge control, pending view only:

```tsx
        {view === "pending" && mergeTargets.length > 1 ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              aria-label="Merge into"
              className={cn(field, "h-10 w-auto max-w-full sm:max-w-72")}
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
            >
              <option value="">Merge into…</option>
              {mergeTargets
                .filter((t) => t.id !== story.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.headline}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={pending || !mergeInto}
              onClick={merge}
              className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm text-muted-foreground hover:border-teal/40 hover:text-foreground disabled:opacity-60"
            >
              Merge
            </button>
          </span>
        ) : null}
```

(The ellipsis in "Merge into…" is U+2026, which is allowed. Only the two dashes are banned.)

- [ ] **Step 9: Run the gate**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 10: Check the admin in the browser (owner signed in)**

`pnpm sweep` cannot reach `/admin/*` (see the lessons). Start `enki-dev`, open `http://localhost:3000/admin/news` in the browser pane, and ask the owner to sign in there. Claude never types the password. Then, at 1440px and at 390px (`resize_window`):
- Open a story, and confirm the sources panel, the word count and the problem list, which updates as you type in the story field.
- Merge one Disrupt promo into another promo. Confirm that the target's sources panel lists it, and that "Unmerge" returns it to the queue. (This is a real write to production data; promos are safe to use and are rejected afterwards.)
- Take a screenshot at each width. Check that the merge select does not overflow at 390px.

Reset the viewport with `resize_window` `{ preset: "desktop" }`.

- [ ] **Step 11: Commit**

```bash
git add src/app/admin/news/actions.ts src/app/admin/news/actions.test.ts src/app/admin/news/types.ts src/app/admin/news/page.tsx src/app/admin/news/news-queue.tsx src/app/admin/news/story-editor.tsx
git commit -m "feat(admin): write full stories, see their sources, merge duplicate coverage"
```

---

### Task 6: Records, then content

**Files:**
- Modify: `HANDOFF.md` (§0 "Running the news", §4 schema table, RPC list and "Migrations applied")
- Modify: `C:\Users\Vivaan\.claude\projects\C--Users-Vivaan-Desktop-Enki\memory\news-summaries-by-claude.md` (outside the repo, not committed)

- [ ] **Step 1: Update HANDOFF**

In §4:
- Add `body?`, `body_words` (generated), `merged_into?` and status `merged` to the `stories` row.
- Add `admin_merge_story` and `story_sources` to the RPC list, noting that `story_sources` is anon-callable and returns only three columns for published stories.
- Add to "Migrations applied": `full_stories (2026-09-22; SQL in docs/superpowers/plans/2026-09-22-full-stories.md, Task 1)`.

In §0 "Running the news", replace the summary and take bullets with the per-story workflow and the editorial rules from spec §3.1 and §5. Change "Summary by Enki" to "By Enki", and update the "Story page" row of "What exists".

- [ ] **Step 2: Update the memory file**

Rewrite its body so it says:
- Claude writes full stories: 400 to 700 words, from every merged source read in full.
- Stories are synthesis only: no sentence copied or closely paraphrased, and at most one short attributed quote.
- There is a founder section of 2 to 4 points under `## What it means for founders`, with no investment advice and no angling for commission.
- There are no dashes, the byline is "By Enki", and there is no AI disclosure.

Keep the **Why** and **How to apply** lines, and keep the link to `[[enki-news-pivot]]`.

- [ ] **Step 3: Commit the handoff**

```bash
git add HANDOFF.md
git commit -m "docs(handoff): full stories, merged sources and the new daily workflow"
```

- [ ] **Step 4: Ask the owner to push**

Tell the owner the migration is live and the code is committed but not deployed. Publishing from enkitools.com is broken until they push. Do not push.

- [ ] **Step 5: Content (after the deploy, owner signed in at enkitools.com/admin/news)**

For each of these stories:
1. Merge its duplicates.
2. Read every source in full (browser tab for The Verge and Ars Technica).
3. Write the headline, summary and a 400 to 700 word body to spec §5.
4. Pick the beat, prune tools, publish.

The stories:
- the five researched on 2026-09-22: OpenAI math advisory group, the AI hallucination and the Chinese ship, Google's CC, the Muse zero-day, Trump's "AI Force"
- the four already published, merging their rejected duplicates back in: Muse blocked by Amazon, Anthropic's wet lab, Claude used to reach an OpenAI account, Gemini hacking three companies

Check each published page once at 390px for layout.
