# AI News Pivot Design

**Date:** 2026-09-19 · **Baseline:** `f2f35dc` · **Domain:** `enkitools.com`
**Goal:** turn Enki from an AI tool directory into an AI news front page, in the
spirit of Yahoo Finance's homepage, where every story carries the directory
tools it mentions as tracked affiliate links. The directory stays, one click
away, as the secondary product.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| Where stories come from | **Aggregated from RSS/Atom feeds, curated by the owner.** Nothing publishes without approval. |
| Who writes the summary | **The owner, by hand**, 40–320 characters. No LLM in the pipeline. |
| How tools attach to stories | **Auto-suggested by name/alias matching at ingest; confirmed by the owner** in the same approval step. |
| Where a headline click lands | **An Enki story page** (`/news/[slug]`) with a prominent link to the source. |
| Indexing of story pages | **`noindex, follow` by default.** Indexable only when the owner adds a take of 300+ characters. |
| Homepage ticker | **"Tools in the news"**: tools ranked by published-story mentions in the last 7 days. No market data. |
| Homepage sections | **Five fixed news beats**, independent of directory categories. |
| The 3D oracle hero | **Moves to `/tools`.** The homepage opens on news. |
| Ingestion trigger | **Daily Vercel Cron plus an admin "Fetch now" button**, sharing one code path. |
| Domain | **Keep `enkitools.com`.** Revisit only once news traffic dominates. |
| Tagline | **Keep "Wisdom for the age of AI."** |

---

## 2. Why the design is shaped this way

Enki's standing promise is "human-vetted, nothing fabricated". Phase 0 of
`docs/roadmap.md` was spent removing invented editors, padded alternatives and
unverifiable numbers. The news product has to keep that promise, which drives
four choices:

- **The publisher's excerpt is never rendered publicly.** It is stored for the
  owner's reference only. Public text is the owner's own summary and take.
  This keeps Enki clear of republishing copyrighted copy.
- **Aggregated summaries are not indexed.** Hundreds of short summaries are the
  thin-page pattern roadmap item 0.1b removed. A story earns indexing when it
  carries original commentary.
- **Every displayed metric is real and gated.** The ticker hides until three
  tools have mentions; Popular falls back to Latest until views mean something.
- **Every affiliate link is one the owner signed off.** Auto-matching only
  suggests.

Realistic volume, with hand-written summaries, is **5–15 stories per day**. The
homepage is designed to look full at that volume, and collapses gracefully
below it.

---

## 3. Data model

All tables RLS-enabled, following the existing `tools` pattern. Migrations
applied via the Supabase MCP and recorded in `handoff.md` §4. Follow the
`enki-supabase-change` skill before writing any of it.

### 3.1 Tables

**`news_sources`**: `id uuid pk, name text, feed_url text unique, site_url text,
active boolean default true, last_fetched_at timestamptz, last_error text,
created_at`.
Admins read and write. Anon has no access.

**`stories`**:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique | Set on publish: slugified headline + `-` + first 6 chars of `id` |
| `source_id` | uuid → `news_sources` | |
| `source_url` | text unique | Dedup key |
| `headline` | text | Editable by the owner before publishing |
| `excerpt` | text | Publisher's feed text. **Admin-only; never rendered publicly** |
| `summary` | text | Owner-written, 40–320 chars. Required to publish |
| `take` | text | Optional owner commentary |
| `beat` | text | One of the five beat slugs. Required to publish |
| `image_url` | text | From the feed enclosure/media tag, if any |
| `status` | text | `pending` / `published` / `rejected` |
| `featured` | boolean default false | |
| `source_published_at` | timestamptz | From the feed |
| `published_at` | timestamptz | Set on publish |
| `created_at` | timestamptz | |

Anon reads **published rows only**, and **`excerpt` is column-revoked from
anon** (the same technique as `reviews.status`). Admins read and write
everything.

**`story_tools`**: `story_id → stories, tool_slug text, position int`, primary
key `(story_id, tool_slug)`. Readable when the parent story is readable;
admins write.

**`story_views`**: `id, story_id → stories, created_at`. Anon **insert-only**,
admins read, following the `outbound_clicks` pattern. Stores no visitor data.

### 3.2 The ingest write path

The cron has no user session, and the project never uses the `service_role`
key. Ingestion therefore writes through one RPC:

**`ingest_story(secret text, source_id uuid, source_url text, headline text,
excerpt text, image_url text, source_published_at timestamptz, tool_slugs
text[])`**. It is `SECURITY DEFINER`. It:

1. Compares `secret` against a value held in a Supabase Vault secret (or a
   locked single-row config table readable by no role), and returns `false` on
   mismatch.
2. Inserts the story as `pending` only. It cannot set `status`, `summary`,
   `take`, `featured` or `published_at`.
3. Treats a `source_url` conflict as a no-op and returns `false`.
4. Inserts the suggested `story_tools` rows.

The same secret is stored as `NEWS_INGEST_SECRET` in `.env.local` (placeholder
in `.env.example`) and in Vercel. A leaked secret lets someone queue pending
rows, never publish them. Publishing stays behind `is_admin()`.

A companion **`touch_news_source(secret, source_id, error text)`** RPC updates
`last_fetched_at` / `last_error` under the same secret check.

### 3.3 Tool schema change

`toolSchema` in `src/lib/schemas.ts` gains **`aliases: z.array(z.string().min(1)).optional()`**
for alternate names the matcher should recognise (for example `"GPT-5"` on
ChatGPT). Seed tools get aliases where obviously useful; the CMS editor
accepts them through the existing JSON editor.

### 3.4 Beats

A fixed list in `src/data/beats.ts`, following `categories.ts`:

| Slug | Name |
|---|---|
| `models-labs` | Models & Labs |
| `products-launches` | Products & Launches |
| `funding-business` | Funding & Business |
| `policy-safety` | Policy & Safety |
| `research` | Research |

A `beat` check constraint in the database mirrors this list.

---

## 4. Ingestion

**`src/lib/news/ingest.ts`** exports `ingestAll()`, called from two places:

- **`GET /api/ingest-news`**: a new daily Vercel Cron entry in `vercel.json`
  (`0 5 * * *`), guarded by `CRON_SECRET` exactly like `keep-warm`, and wrapped
  in a `Sentry.withMonitor` check-in with slug `ingest-news`.
- **`fetchNewsNow()`**: an admin server action that calls `assertAdmin()` first.

Per active source, `ingestAll()`:

1. Fetches the feed with a 10s timeout. A failing feed is reported to Sentry,
   recorded via `touch_news_source`, and skipped; it never fails the run.
2. Parses RSS 2.0 and Atom with a small, maintained parser dependency (chosen
   in the plan; must handle both formats and media/enclosure images).
3. Takes items published in the last 72 hours, and at most 30 per source per
   run.
4. Runs the tool matcher over headline + excerpt.
5. Calls `ingest_story` for each item.

It returns a summary (`{ sources, fetched, inserted, failed }`) that the admin
button shows as a toast.

**Tool matcher**: `src/lib/news/match-tools.ts`, a pure function
`matchTools(text, tools) → slug[]`:

- Whole-word, case-insensitive match on each tool's `name` and `aliases`.
- Names on an ambiguity list (initially `Claude`, `Gemini`, `Notion`,
  `Copilot`, `Perplexity`) match **case-sensitively only**.
- Returns at most 5 slugs, in order of first appearance.

Starter feeds are seeded by the plan and edited afterwards in admin. Candidates:
OpenAI, Anthropic, Google DeepMind and Meta AI blogs; TechCrunch AI; The Verge
AI; VentureBeat AI; MIT Technology Review AI; Ars Technica AI.

---

## 5. Admin

### 5.1 Queue: `/admin/news`

- Lists `pending` stories newest first: headline, source, age.
- **Fetch now** button at the top, calling `fetchNewsNow()`.
- Expanding a row shows an editor:
  - headline (editable)
  - link to the original
  - the excerpt, read-only
  - **summary** textarea (required, 40–320 chars, with a live counter)
  - **beat** select (required)
  - **take** textarea (optional; shows "indexable" once it passes 300 chars)
  - **featured** toggle
  - suggested tools as removable chips, plus a search box to add any directory tool
- **Publish** and **Reject** buttons.
- Keyboard flow: `J`/`K` move between stories, `P` publishes, `R` rejects. The
  shortcuts are inactive while focus is in a text field.
- **Publish** validates with Zod, sets `status`, `slug` and `published_at`,
  replaces the story's `story_tools` rows, then calls `revalidatePath` for `/`,
  `/news`, the beat page and the story page.
- **Reject** sets `status = 'rejected'`. Rejected rows are kept because they
  are the dedup record.
- A **Published** tab lists recent published stories and allows editing
  summary, take, beat, featured and tools, or unpublishing.

### 5.2 Sources: `/admin/news/sources`

Add a feed, toggle it active, and see `last_fetched_at` and `last_error`.

### 5.3 Security

Every server action calls `assertAdmin()` itself, per the security invariant in
`handoff.md` §8. The admin dashboard KPI row gains **Pending stories**.

---

## 6. Public pages

### 6.1 Story page: `/news/[slug]`

Top to bottom:

1. Beat breadcrumb.
2. Headline.
3. Meta line: source name, the source's publish time, and "Summarised by
   Vivaan Kavalani" from `src/data/authors.ts`.
4. The summary.
5. The take, if present.
6. **"Read the full story at {Source}"**: a plain external link with
   `rel="noopener"`. Not routed through `/go`, which is reserved for tools.
7. **"Tools in this story"**: the affiliate disclosure, then compact tool cards
   (logo, name, tagline, editor score) whose CTAs go through `/go/[slug]`.
   Omitted when the story has no tools.
8. **"More in {Beat}"**: 5 recent stories.
9. A link to the "How Enki covers news" note.

**Metadata:**

- Canonical is the page itself.
- `robots: noindex, follow` unless `take` is 300+ characters, in which case the
  page is indexable and emits `NewsArticle` JSON-LD.
- The OG image uses the story headline via the existing OG helper.

**Rendering:** `dynamicParams = true`, no prebuilt params, revalidated on
publish. Unknown or unpublished slugs return 404.

**Views:** a small client component POSTs to **`/api/story-view`** once per
story per browser session (`sessionStorage`, wrapped in try/catch). The route
validates the id and inserts through the anon client. It joins the Vercel
Firewall rate-limit list.

### 6.2 Archive pages

- **`/news`**: every published story, newest first, paginated at 30 per page
  via a path segment (`/news/page/2`).
- **`/news/beat/[beat]`**: the same list, filtered to one beat. Five static
  params.

Filters are **path segments, not query strings**. Roadmap item 0.2 found that
`useSearchParams()` makes a page ship empty HTML to crawlers.

### 6.3 "How Enki covers news": `/news/about`

A short, plain page covering:

- headlines and reporting belong to the linked publishers
- the owner reads the source and writes every summary
- tool links may earn a commission, and never influence which stories run or
  how they are summarised

---

## 7. Homepage

Built entirely from server components, with no `useSearchParams`. The page is
revalidated on publish, with a 300-second fallback. It uses Enki's existing
design language (see `handoff.md` §7): void and surface backgrounds, teal
accent, Cardot headlines, Plex Mono labels, hairline rings. It is Yahoo's
density, not Yahoo's look. Atmosphere effects (`.spotlight`, glows) are kept
off the story grid for legibility, with at most a spotlight behind the lead.

### 7.1 Header

- `siteConfig.nav` becomes **News · Tools · Finder · Deals**.
- Categories, Compare and Leaderboards are reached from `/tools`.
- A beat row sits under the header on the homepage and all `/news` routes:
  Latest, the five beats, and **Directory →** at the end.

### 7.2 "Tools in the news" strip

- Directory tools ranked by count of `story_tools` rows on stories published in
  the last 7 days, showing name, logo and "N stories". Each entry links to
  `/tools/[slug]`.
- **Hidden entirely when fewer than 3 tools have mentions.**
- Scrolls horizontally on narrow screens; marked `data-sweep-ignore`.

### 7.3 Lead row

- **Lead story:** the most recent `featured` story from the last 48 hours.
  Otherwise the latest story. Shows image, headline, summary, source, age and
  tool chips.
- **Popular:** the top 5 stories by `story_views` in the last 48 hours, shown
  only when the top story has at least 10 views. Otherwise the same slot is
  titled **Latest** and lists the newest stories. Stories already shown as the
  lead are excluded.
- **Sidebar:**
  - a "Find a tool" field that opens the existing command menu
  - the top 5 directory tools by `editorScore`
  - a Finder link

### 7.4 Below the fold

- **Beat sections:** the five beats, three per row on desktop. Each shows up to
  4 stories from the last 7 days; the first has its image if it has one.
  **A beat with no recent stories is omitted** and the grid closes up. Headers
  link to `/news/beat/[beat]`.
- **Latest column:** the 5 newest stories and an "All news →" link.
- **Directory band:** tool count (from `getStats()`), featured tools, a
  categories link and the Finder.
- **Newsletter** signup (the existing form).

### 7.5 Images

Feed images are hotlinked with a lazily loaded `<img>`, fixed aspect ratio,
`referrerPolicy="no-referrer"`, and an `onError` fallback to the text-only
card. Stories without an image use a text-only card, never a stock placeholder.
The CSP already allows `img-src https:` (`next.config.ts:37`), so no CSP change
is needed.

### 7.6 Empty state

With zero published stories, the page shows a single "First stories coming
soon" line above the directory band, and nothing else from §7.2–7.4. It never
shows invented stories and never errors.

### 7.7 Mobile (below 768px)

One column, in this order:

1. beat row (horizontal scroll, `data-sweep-ignore`)
2. ticker
3. lead story
4. Popular / Latest
5. beat sections
6. sidebar
7. directory band
8. newsletter

---

## 8. Repositioning

### 8.1 `/tools`

- The **oracle hero** moves to the top of `/tools`, with its `.glb` preload,
  and the hero copy keeps its "oracle for AI tools" framing.
- Below it: the existing crawlable directory grid, then **Featured tools**,
  **Categories** and **How I vet**, moved from the current homepage.
- The trust-stats row moves with How I vet.
- The roadmap 0.2 guarantee is unchanged: `/tools` ships tool links in raw HTML.

### 8.2 Metadata and copy

- `siteConfig.description` changes to describe AI news with a vetted tool
  directory.
- Updated to match:
  - root metadata
  - homepage OG image
  - `manifest.ts`
  - `llms.txt`, which gains a news section
- The site `WebSite`/`Organization` JSON-LD is otherwise unchanged.
- The sitemap adds `/news`, the beat pages, `/news/about` and **indexable
  stories only**.

### 8.3 Trust copy

- The affiliate disclosure component's copy is extended to cover tool links on
  stories.
- `/privacy` gains a line for `story_views`: a story id and a timestamp,
  nothing about the visitor.

### 8.4 Unchanged

The Finder, Compare, Leaderboards, Deals, `/best`, `/alternatives`, `/vs`,
saved tools, collections, reviews and the tool CMS.

---

## 9. Failure handling

| Failure | Behaviour |
|---|---|
| Supabase paused or unreachable | Tools fall back to seed as today. Story queries return empty; the homepage shows the §7.6 empty state; story pages 404. The `keep-warm` cron makes this rare. |
| One feed broken or slow | Timeout, Sentry report, `last_error` recorded, other feeds continue. |
| Cron missed or failed | Sentry monitor `ingest-news` alerts, as for `keep-warm`. |
| Duplicate item | `source_url` unique conflict; silently skipped. |
| Feed image 404 or blocked | `onError` swaps to the text-only card. |
| Story unpublished after sharing | 404. |

---

## 10. Testing

**Unit (Vitest):**

- `matchTools`: whole-word matching, aliases, case-sensitive ambiguous names,
  the cap of 5, and no match inside other words.
- Slug generation.
- The indexability rule at 299, 300 and 301 characters.
- The Popular→Latest threshold.
- The ticker's 3-tool minimum.
- The beat-omission rule.
- Feed parsing on RSS and Atom fixtures, including a missing image and a
  malformed item.
- `ingestAll` with a stubbed fetch and RPC: one failing source doesn't stop the
  others, and the summary counts are correct.
- The `no-fabricated-metrics` guardrail is extended to cover the ticker and
  Popular.

**RLS (`pnpm audit:rls`), extended to prove that anon:**

- cannot read `pending` or `rejected` stories
- cannot read `stories.excerpt`
- cannot update or delete stories
- can insert a story only through `ingest_story` with the correct secret
- can insert but not read `story_views`
- has no access to `news_sources`

**E2E (Playwright, `tests/e2e/`):**

- The homepage renders a published story and its tool chips.
- A story page shows "Tools in this story" with `/go/` links, and carries
  `noindex` when it has no take.
- The admin publish flow moves a pending story to published.
- `/tools` renders the hero and keeps tool links with JavaScript disabled.

**Visual sweep:**

```
pnpm sweep -- / /tools /news /news/beat/models-labs /news/<a-seeded-slug> /admin/news
```

Every route must PASS at 390px and 1440px, with screenshots of `/` at both
widths.

---

## 11. Delivery

One spec, four merges. Each works on its own and passes `pnpm verify`.

1. **Data, ingestion and admin.** Tables, RPCs, `aliases`, beats, matcher,
   `ingestAll`, the cron route, `/admin/news` and `/admin/news/sources`. No
   public change; the owner can start collecting and approving stories.
2. **Public story pages.** `/news/[slug]`, `/news`, `/news/beat/[beat]`,
   `/news/about`, `/api/story-view`, and the sitemap entries.
3. **Homepage.** §7 in full, and the header nav and beat row.
4. **Repositioning.** §8. It also adds a new phase for this work to
   `docs/roadmap.md` and updates `handoff.md`.

**Operator steps (owner only):**

- Set `NEWS_INGEST_SECRET` in Vercel.
- Store the matching secret in Supabase Vault.
- Add a Vercel Firewall rate-limit rule for `/api/story-view`.
- Seed the first feeds in `/admin/news/sources` if the plan's starter list
  needs changes.

---

## 12. Out of scope

- LLM-written summaries or stories.
- Full-article scraping or re-hosting.
- Market or stock data.
- Comments and reactions on stories.
- A newsletter digest of stories. This is a natural follow-up, since
  subscriber capture exists.
- Stories in the Ctrl K command menu (tools only for now).
- Pushing stories to IndexNow automatically. `scripts/indexnow.mjs` can be run
  manually as today.
- Any domain change.
