# Enki — Project Handoff

> A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**,
> the Sumerian god of wisdom, "the oracle for AI tools." Fuses ancient
> oracle/clay-tablet gravitas with a sleek dark AI-product UI.
> Tagline: **"Wisdom for the age of AI."**

Single source of truth for continuing work in a fresh session. **Read §0 first**
(the work in flight), then §1 and §2: current state, the live backend, and how
to unlock the admin.

> **Direction change (2026-09-19):** Enki is pivoting from a tool directory to an
> **AI news front page** (Yahoo Finance-style) with affiliate links on each
> story; the directory becomes secondary. §1–§12 still describe the directory
> accurately. §0 describes the pivot.

---

## 0. In flight — AI news pivot (updated 2026-09-20)

### Start here tomorrow
1. `git pull` is not needed — nothing is pushed. **10 commits are waiting on
   `main`** (`git log origin/main..HEAD`), including the fix that unblocks
   Vercel. **The live deploy stays broken until they are pushed.**
2. `pnpm install && pnpm run doctor` (note: `pnpm run`, see below), then
   `pnpm verify`.
3. **The only work left in merge 1 is the admin UI walkthrough**, which needs
   the owner signed in: start `preview_start` `enki-dev`, have the owner sign in
   at `/login`, then check `/admin/news`, `/admin/news/sources` and `/admin` at
   390px and 1440px, publish one story end to end, and read the console.
   **41 real pending stories are already in the queue**, so nothing needs
   fetching first.

### Status
The pivot is specified in four merges. **Merge 1 (news ingestion + admin queue)
is code-complete: 15 of 16 tasks done.** Tasks 1–12 are pushed; 13–15 are
committed locally. What exists, with typecheck, lint and 439 tests green:
- the RSS/Atom parser
- the tool matcher
- the ingest loop
- the Supabase ingest store
- the daily cron route
- the admin server actions
- the RLS audit extension (16/16 PASS live on 2026-09-20)
- the admin UI: `/admin/news`, `/admin/news/sources`, and the dashboard KPI

The database migration is **live in production**, 7 feeds are seeded, and
**ingestion has now run for real** (2026-09-20): 41 pending stories from 5 of
the 7 sources, each with its excerpt, 19 with images, no source errors, and a
second run inserted 0, proving dedup. The live `pnpm audit:rls` passes 16/16
against a database that now genuinely has hidden rows.

What is missing from **Task 16**:
- The secrets are all in place: `.env.local`, Supabase Vault, and (owner
  confirmed 2026-09-21) Vercel, with `CRON_SECRET`. **Not yet verified:** that
  the Vercel `NEWS_INGEST_SECRET` matches Vault. The first production cron run
  proves it — a `not authorized` error in Sentry monitor `ingest-news` means the
  two differ.
- the admin UI has **never been rendered in a browser**. No visual sweep has run
  against it, because `/admin/*` needs a signed-in owner.

No public page has changed. Merges 2–4 (story pages, new homepage,
repositioning) have no plans yet.

### Where to read
- **Spec (approved):** `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md`.
  All four merges and every product decision are in it.
- **Plan for merge 1:** `docs/superpowers/plans/2026-09-19-news-ingestion-and-admin.md`.
  Tasks 1–15 are done; continue at **Task 16**. The top of the plan lists six
  deliberate deviations from the spec.
- **Git:** branch `main`, clean tree, with the Task 13–15 commits and this
  handoff ahead of `origin/main` (`git log origin/main..HEAD`).

### What changed (merge 1, commits `3037c50..b112de4`)
- `src/lib/news/` holds the whole ingestion pipeline:
  - `parse-feed.ts` (RSS 2.0/1.0/Atom)
  - `match-tools.ts` (name/alias matching, case-sensitive for common-word names)
  - `ingest.ts` (`ingestAll` over an `IngestStore` interface)
  - `ingest-store.ts` (store over the ingest RPCs)
  - `run-ingest.ts` (wires env + anon client + Sentry)
  - `schemas.ts`, `slug.ts`, `format-age.ts`
  - every module has a sibling test
- `src/data/beats.ts` defines the 5 news beats; its slugs must match the
  `stories.beat` check constraint.
- `src/lib/schemas.ts` gains optional `aliases` on tools, and `src/data/tools.ts`
  seeds aliases on 7 tools.
- `src/app/api/ingest-news/route.ts` is the daily cron (`vercel.json`, `0 5 * * *`)
  with the Sentry monitor `ingest-news`. It **fails closed without
  `CRON_SECRET`**.
- `src/app/admin/news/actions.ts` holds the actions `publishStory`,
  `setStoryStatus`, `fetchNewsNow`, `addNewsSource` and `setNewsSourceActive`.
- `src/lib/supabase/database.types.ts` gains hand-written types for the new
  tables and RPCs. Do not regenerate the file.
- `scripts/audit-rls*` adds probes for unpublished stories, excerpts, sources and
  the five RPCs. The live `pnpm audit:rls` was all PASS on 2026-09-19.
- `package.json` adds `fast-xml-parser@5.11.1`.

### Decisions (settled with the owner — do not re-litigate)
- **Sourcing:** stories are **aggregated from RSS feeds and curated by the
  owner**. Nothing publishes without approval, and the owner **writes every
  summary by hand**. **No LLM** anywhere in the pipeline.
- **Excerpt:** the publisher's text is **never rendered publicly**. It lives in
  the admin-only table `story_excerpts`.
- **Tool links:** they are auto-suggested at ingest and confirmed by the owner.
- **Story pages:** a headline click opens an Enki story page (`/news/[slug]`)
  that links to the source. The page is `noindex` unless the owner's "take" is at
  least 300 characters.
- **Ticker:** it shows "Tools in the news" (mention counts). **No stock or
  market data.** It is hidden until 3 or more tools have mentions.
- **Sections:** 5 fixed news beats, not directory categories.
- **Oracle hero:** the 3D hero **moves to `/tools`**; the homepage opens on news.
- **Keep:** the domain `enkitools.com` and the tagline.
- **Ingest trigger:** a daily cron plus an admin "Fetch now" button.
- **Database writes:**
  - **No `service_role` key.** The cron writes through secret-gated `SECURITY
    DEFINER` RPCs, and the secret can only create *pending* stories.
  - `stories` has **no table-level write grant** for any API role. Admin writes
    go only through `admin_publish_story` and `admin_set_story_status`.
- **Git workflow:** the owner's rule is to work on `main`, with **no branches,
  worktrees or PRs unless asked**, and to push only when explicitly asked.
- **Execution method:** subagent-driven. There is one implementer per task or
  batch, followed by a spec review and then a code-quality review.

### Not done (in order)
- [ ] **Task 16 (owner first).** Only the owner creates the secret (see Traps).
  Then run `pnpm verify`, `pnpm audit:rls`, a local cron call, and an admin UI
  walkthrough with the owner signed in. Update §2a and §4 if anything changed.
- [ ] **Merges 2–4** each need their own plan, written with
  `superpowers:writing-plans` from spec §11:
  - **2:** story, `/news`, beat and about pages, plus `story_views`
  - **3:** the homepage
  - **4:** `/tools` repositioning and metadata

  Merge 2 must decide how to show source names publicly, since `news_sources` is
  admin-only.
- [ ] **CI is red on `main`, and not from this work.** `pnpm audit --prod
  --audit-level high` fails on 11 advisories in `next`, `sharp`, `@sentry/nextjs`,
  `@react-three/drei` and `browserslist`. It was already failing on 2026-09-15.

### Open question for the owner (raised 2026-09-20, not decided)
**The directory does not contain the tools the news is about, so almost no story
earns an affiliate link.** Of the first 41 ingested stories, 8 mention ChatGPT or
OpenAI, 7 mention Claude or Anthropic and 2 mention Gemini — none of which are
listed — while Cursor, Perplexity, Midjourney and ElevenLabs appear zero times.
Tool links came out at **0 of 41**, and the matcher is behaving correctly. The
likely fix is to add the lab products (ChatGPT, Claude, Gemini, Copilot, Grok) to
the directory. Decide before merge 3 builds a homepage around the revenue.

### Traps
- **A parameter must never share a name with a column it is compared against**
  (cost an hour on 2026-09-20). `news_ingest_authorized(secret text)` compared
  `vault.decrypted_secrets.decrypted_secret = secret`, and because that view has
  its own `secret` column, Postgres resolved the name to the column — so the
  check rejected *every* call, correct secret included, and the RLS audit's
  "refused" results proved nothing. Fixed by renaming the parameter `p_secret`
  (migration `fix_news_ingest_authorized_param_shadowing`); the three public RPCs
  keep `secret` as their argument name, so the app was unchanged.
- **`pnpm doctor` now runs pnpm's own built-in command.** pnpm 11.26 added a
  `doctor` subcommand that shadows the project script: use **`pnpm run doctor`**.
- **pnpm 11.12.0 is a broken release** (npm marks it deprecated) and Vercel
  refuses to install it, which failed the deploy of `b112de4`. The pin is now
  `pnpm@11.26.0`; keep it on 11.x so the lockfile format does not change.
- **The ingest secret must be identical in three places:**
  - `.env.local` as `NEWS_INGEST_SECRET`
  - Vercel env vars (with `CRON_SECRET`)
  - Supabase Vault:
    ```sql
    select vault.create_secret('<value>', 'news_ingest_secret', '...');
    ```

  It must be at least 32 characters. **Claude must never see or handle the
  value.** The owner generates it with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Until then, `pnpm run doctor` fails the env check on purpose, because
  `.env.example` marks the key as required.
- **The admin UI can't be swept automatically.** `pnpm sweep` is
  unauthenticated, so it cannot reach `/admin/*`, and Claude cannot type the
  admin password. The owner signs in inside the browser pane, then Claude checks
  390px and 1440px by hand.
- **Literal `\uXXXX` escapes get decoded into real characters** by the
  file-editing tools on this setup. Write them through a Node script using
  `String.fromCharCode(92)`, then check the bytes on disk.
- **Supabase grants new tables and functions to `anon` and `authenticated` by
  default.** Every new object needs `revoke all ... from public, anon,
  authenticated` before its own grants. See the `enki-supabase-change` skill.
- **Feed quirks:**
  - VentureBeat returns 429 to bots and was left out of the seed.
  - The OpenAI feed carries about 1,210 items; the 72h window plus the 30-per-source
    cap handles it.
  - Anthropic and Meta have no official RSS.
- **Compute `formatAge` on the server** and pass the string down. Doing it in a
  client component causes a hydration mismatch.
- **Route tests** need `// @vitest-environment node` as their **first line**.
- **Cron timing:** Vercel Hobby crons can fire any time within the hour, so this
  route's monitor uses `checkinMargin: 60`. `keep-warm` uses `10` and may
  false-alarm. Not verified.
- **`story_tools.tool_slug` has no foreign key to the directory.** A slug is
  trusted if it matches the slug regex.

### How to run and verify (current state)
```bash
git pull && pnpm install && pnpm run doctor   # env check fails until NEWS_INGEST_SECRET is set (expected)
pnpm verify                               # expect 437 tests passing
pnpm audit:rls                            # expect all PASS, "RLS holds."
pnpm build                                # expect ƒ /api/ingest-news in the route list
```
Once the secret is set, start the dev server (`preview_start` `enki-dev`) and
run:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/ingest-news
```
The first run should return `inserted > 0`, and an immediate second run
`inserted: 0` (dedup). `/admin/news` and `/admin/news/sources` return 404 until
Tasks 13–14 are built.

---

## 1. Current status

Enki is a **feature-complete, dark-only Next.js 16 app with a real Supabase
backend**, now with a **monetization layer, a role-gated admin/CMS, a
programmatic-SEO surface, and engagement features**. It grew well past the
review-directory MVP over two build sessions.

### Public pages
home · `/tools` (directory) · `/tools/[slug]` (detail) · `/finder` (guided
recommender) · `/categories` · `/categories/[slug]` · `/leaderboards` ·
`/compare` · `/deals` · `/saved` · `/collections` · `/lists/[id]` (shared list) ·
`/submit` · `/best/[category]` · `/alternatives/[slug]` · `/vs/[versus]` ·
`/privacy` · `/terms` · `/login` · `/auth/callback`.
**Routes / endpoints:** `/go/[slug]` (tracked outbound redirect), `/llms.txt`,
`sitemap.xml`, `robots.txt`, per-tool + site OG/Twitter images, web manifest,
`apple-icon`.

### Admin (role-gated, `/admin`)
`/admin` dashboard — KPIs (tools, reviews, pending reviews, 30-day outbound clicks, pending
submissions, subscribers), **outbound-demand leaderboard**, **review
moderation**, **re-vet queue**, **submission moderation**. `/admin/tools` +
`/admin/tools/[slug]` — **tool CMS** (create/edit/publish via a Zod-validated
JSON editor). See §2c to grant yourself admin.

### Everything that works (verified across sessions)
- **Auth** — Supabase email/password; session middleware; header account menu.
- **Reviews** — auth-gated, Postgres-persisted, and **pre-moderated**: new and
  edited reviews land as `pending` and only an admin-guarded RPC
  (`admin_set_review_status`) can publish them. Authors see their own queued
  review labelled "Awaiting review"; everyone else sees approved only. The
  community rating averages **approved reviews only**.
- **Saved tools** — localStorage logged-out, Supabase-synced logged-in.
- **Collections** — named groups of tools + private notes; a collection can be
  made public → shareable `/lists/[id]` (indexable).
- **Compare / Leaderboards** — as before (side-by-side + editor/community boards).
- **Finder** (`/finder`) — deterministic 3-question recommender ("Ask the Oracle"),
  shareable URLs, reasoned results. No LLM.
- **Monetization** — tracked affiliate outbound (`/go/[slug]` logs a click, 302s
  to `affiliateUrl ?? website`) + FTC disclosure; labeled **sponsored** pinning
  (browse only, never search/leaderboards); **deals/coupons** (badge + tool-page
  box + `/deals` roundup).
- **Programmatic SEO** — `/best/[category]`, `/alternatives/[slug]`,
  `/vs/[versus]` (same-category pairs, canonicalized), `llms.txt`, ItemList/FAQ/
  Breadcrumb JSON-LD, full sitemap coverage, internal links.
- **Freshness** — optional `lastVetted` per tool → "Last vetted" trust line + an
  admin re-vet queue (unset = "never vetted").
- **Submit-a-tool** (`/submit`) — public form → `tool_submissions` → admin queue.
- **Newsletter** — footer form now **really captures** subscribers (was a stub).
  Sending digests/alerts is a documented follow-on (needs an email provider key).
- **SEO/PWA/legal/a11y baseline** — canonicals on every page, security headers,
  web manifest + apple-touch-icon, `/privacy` + `/terms`, skip-link + global
  focus ring.
- **Canonical domain** (2026-07-29) — everything resolves to `enkitools.com`:
  canonicals, OG, 111 sitemap entries, robots, `llms.txt`, JSON-LD ids.
  `enki-five.vercel.app` and `www` 308 to the apex. `CANONICAL_SITE_URL` is
  committed in `src/lib/site.ts` rather than read from a dashboard variable, and
  `src/lib/site.test.ts` fails the build if a production build could ever resolve
  a `.vercel.app` origin again.
- **IndexNow** (2026-07-29) — `pnpm indexnow` pushes URLs to Bing, Yandex, Naver,
  Seznam and Yep (and via Bing: DuckDuckGo, Copilot, ChatGPT search). Manual by
  design; a host guard refuses any URL not on `enkitools.com`, and a drift test
  pins the script's key to the library and the published key file.
- **One index-control mechanism** (2026-07-29) — `robots.txt` no longer disallows
  anything; private routes carry `noindex`, which crawlers can now actually see.
  A blocked crawler never fetches the page, so it never reads the `noindex`.
- **Observability** (2026-07-29) — Sentry captures errors from all three runtimes,
  collects CSP violations (the policy had been report-only with no collector, so
  every violation was discarded), and monitors the `keep-warm` cron. Source maps
  upload on every build.
- **Hero first paint** (2026-07-29) — the intro reveal is CSS, not GSAP. It used
  to run after hydration and `.from({opacity: 0})` hid copy the visitor was
  already reading; measured as four seconds of correct hero followed by a blank
  one on a throttled cold load.
- **Hero payload** (2026-07-29) — model 1286 KB → 124 KB (200k → 20k triangles,
  unused textures and UVs stripped), preloaded so it no longer waits on the
  ~900 KB three.js chunk, and the placeholder is now a render of the model itself
  instead of a 415 KB flat emblem. Emblem mask 415 KB → 42 KB sitewide.

**Gates:** `pnpm verify` (typecheck + lint + test) is the gate, and the
pre-commit hook runs it for any commit touching code. `pnpm build` is
authoritative for routing, `pnpm sweep` for layout. Counts are deliberately not
recorded here — they go stale. Run the commands.

**Repo:** `https://github.com/ultravmusic1-del/enki.git` (branch `main`, pushed).
**Live:** https://enkitools.com (Vercel project `enki`, auto-deploys on push to
`main`). `enki-five.vercel.app` 308-redirects here. Deployment Protection is on,
which gates the *deployment-specific* and preview URLs behind Vercel SSO; the
production domain above is public.

---

## 2. ⚠ Important context for continuing (READ THIS)

### 2a. Environment variables (required)
```
NEXT_PUBLIC_SUPABASE_URL=https://qknsqurdawglctwqfwxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_iRpRQepBf8ozIoeBYH-sqQ_mjhupS5a
```
In **`.env.local`** (gitignored, so it never travels between machines);
`.env.example` documents them and `pnpm run doctor` reports exactly which keys a
machine is missing.
Both are the **publishable/anon** kind — safe client-side; RLS enforces access.
The `service_role` key is never used or stored. The (unbuilt) email digest would
add `RESEND_API_KEY`.

**News ingestion (2026-09-19)** adds two more (see §0 Traps):
- **`NEWS_INGEST_SECRET`** is required. It must be identical in `.env.local`,
  Vercel and the Supabase Vault secret `news_ingest_secret`.
- **`CRON_SECRET`** is set in Vercel; locally it's only needed to call
  `/api/ingest-news` by hand.

Neither is set anywhere yet.

### 2b. Deployed ✅
Live at **https://enkitools.com**; `git push` to `main` auto-deploys.
Env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Supabase → Auth → URL Configuration** must have Site URL =
`https://enkitools.com` and `https://enkitools.com/auth/callback` in Redirect
URLs. Password sign-in works without this, but confirmation and recovery emails
point at the wrong origin — and since `enki-five.vercel.app` now 308s to the
apex, a stale entry sends the PKCE exchange across an origin boundary and the
sign-up fails to complete.

**Canonical origin:** `siteConfig.url` resolves in this order —
`NEXT_PUBLIC_SITE_URL` if set, else a preview deployment's own origin, else the
committed `CANONICAL_SITE_URL` (`https://enkitools.com`) for any production
build, else localhost. It is deliberately not dependent on a dashboard variable:
`src/lib/site.test.ts` asserts a production build can never resolve a
`.vercel.app` origin.
**Build note:** the content layer now reads tools from Supabase at build time
(with a 2.5s timeout + seed fallback), so the DB should be **awake** during a
deploy for freshest content; if it's paused the build still succeeds on the seed.

### 2c. 🔑 Admin access — DONE for vivaankavalani11@gmail.com
Admin identity is a dedicated **`admins`** table (NOT a `profiles.role` — that
table has an unrestricted self-update policy, so a role there would let any user
self-promote). Steps:
1. Sign in to the app once (creates your auth user + profile).
2. Run in **Supabase → SQL Editor**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'YOUR_EMAIL_HERE'
   on conflict (user_id) do nothing;
   ```
3. Visit `/admin` — or use the **Admin** item that now appears in the account
   menu (desktop dropdown and mobile menu) for admins only. Non-admins are
   redirected to `/login`.

**Current state:** `vivaankavalani11@gmail.com`
(`7fc156ef-b643-48af-84e9-fee0a55d92af`) is in `admins`. Use the steps above to
add anyone else.

### 2d. The Supabase project auto-pauses (free tier)
It sleeps after inactivity. The content layer + all admin reads **fall back to
the static seed** when it's asleep, so the public site never breaks — but the
admin, auth, reviews, saved, submissions, etc. need it awake. Resume it in the
dashboard (or via the Supabase MCP `restore_project`) before testing those.

### 2e. Email confirmation is ON (Supabase default)
Real signups get a confirm-link email. For frictionless dev, toggle "Confirm
email" off in Supabase → Auth → Providers → Email (dashboard only).

---

## 3. How to run

```bash
pnpm install        # also wires core.hooksPath -> .githooks via `prepare`
pnpm run doctor     # env, deps, hooks, toolchain, Supabase, and what's in flight
pnpm dev            # http://localhost:3000 (Next 16 + Turbopack). Reads .env.local.
pnpm verify         # the gate: typecheck + lint + test
pnpm sweep          # the Visual Sweep as a command (needs a server running)
pnpm build          # production build (authoritative for routing)
pnpm start
pnpm typecheck | pnpm lint | pnpm test | pnpm test:e2e
```
`.claude/launch.json` (name `enki-dev`) has `autoPort:true` — auto-picks a free
port if 3000 is taken.

### Working across two machines

Enki is developed on two devices that sync through GitHub. Everything
gitignored (`.env.local`) or unversioned (`.git/hooks`, `node_modules`) drifts
between them silently, so start every session from a command rather than from
this document:

```bash
git pull
pnpm install
pnpm run doctor
```

pnpm 11.26 added its own built-in `doctor` subcommand, which shadows this
project's `doctor` script, so `pnpm run doctor` (not `pnpm doctor`) is what
runs `scripts/doctor.mjs`.

`pnpm run doctor --fix` repairs hooks and dependencies and creates a missing
`.env.local` from `.env.example`. It cannot know the secret values; fill them
from §2a. `--json` gives the same result machine-readably, and the exit code is
1 on any FAIL so it is safe to branch on.

End the day with a normal commit. The pre-commit hook runs `pnpm verify` when a
commit touches code and skips it for docs-only commits, and the
`verify` GitHub Actions workflow re-runs the same gate on push — the one check
that is machine-independent, standing between a bad commit and the live site.

---

## 4. Backend — Supabase (live)

**Project `enki`** — id `qknsqurdawglctwqfwxe`, region `ap-south-1`, free tier.
Managed via the Supabase MCP connector.

### Schema (`public`) — all RLS-enabled
| Table | Shape / purpose | RLS |
|---|---|---|
| `profiles` | `(id→auth.users, display_name, created_at)`, trigger-created on signup | public-read, self-write |
| `reviews` | `(id, tool_slug, user_id, rating 1–5, title?, body?, **status**, created_at, updated_at)` | public-read **approved**; owner read/write own; **`status` is column-revoked** — only `admin_set_review_status()` sets it, and a BEFORE trigger forces edits back to `pending` |
| `saved_tools` | `(user_id, tool_slug, created_at)` | owner-only |
| `admins` | `(user_id→auth.users, created_at)` — admin membership | **zero policies** (API-unreachable; SQL-only) |
| `outbound_clicks` | `(id, tool_slug, path, created_at)` — affiliate click log | anon **insert-only**; admins read |
| `tool_submissions` | `(id, name, url, category_slug?, pitch?, submitter_email?, status, created_at)` | anon **insert**; admins read/update |
| `collections` | `(id, user_id, name, is_public, created_at)` | owner all; **public rows world-readable** |
| `collection_items` | `(collection_id, tool_slug, note?, created_at)` | readable if parent readable; owner writes |
| `subscribers` | `(id, email unique, status, created_at)` | anon **insert**; admins read |
| `tools` | `(slug pk, **data jsonb**, published, created_at, updated_at)` — CMS content | public-read published; **admins write** |
| `news_sources` | `(id, name, feed_url unique, site_url, active, last_fetched_at, last_error, created_at)` | **admins only** (read/insert/update) |
| `stories` | `(id, slug?, source_id, source_url unique, headline, summary?, take?, beat?, image_url?, status pending/published/rejected, featured, source_published_at?, published_at?, created_at)` | public-read **published**; **no API write grants**: written only by the RPCs below |
| `story_excerpts` | `(story_id pk, excerpt)` — publisher text | **admins read only**; never rendered publicly |
| `story_tools` | `(story_id, tool_slug, position)` | readable exactly when the parent story is |

### RPCs (SECURITY DEFINER)
- **`is_admin()`** → boolean; used by RLS + the app gate without exposing `admins`.
- **`admin_click_stats(days int)`** → per-tool click counts; self-guards with
  `is_admin()` (non-admins get 0 rows even if they call it directly). `anon`
  cannot execute it.
- **`admin_set_review_status(review_id uuid, new_status text)`** → boolean; the
  only path that may write `reviews.status`. Self-guards with `is_admin()` and
  returns false (not an error) for everyone else. `anon` cannot execute it.
- **`ingest_sources(secret)`**, **`ingest_story(secret, …)`** and
  **`touch_news_source(secret, …)`** are secret-gated. The internal
  `news_ingest_authorized()` compares the argument against the Vault secret
  `news_ingest_secret`, and a wrong secret raises `42501`. `ingest_story` can
  only create **pending** rows. These three are executable by anon and
  authenticated; `news_ingest_authorized` is not executable by any API role.
- **`admin_publish_story(…)`** returns the slug and **`admin_set_story_status(…)`**
  returns a boolean. Both are guarded by `is_admin()` and executable by
  authenticated only.

### Migrations applied (via MCP)
`init_auth_backend`, `lock_down_handle_new_user`, `create_outbound_clicks`,
`admin_foundation` (admins + is_admin + reviews.status + click-stats RPC),
`create_tool_submissions`, `create_collections`, `create_subscribers`,
`create_tools_table`, **`harden_review_moderation`**, **`harden_public_input`**,
**`revoke_admin_rpc_from_public`**, **`tighten_submission_url_scheme`**,
**`narrow_profiles_read`**, **`revoke_unnecessary_anon_grants`**, **`add_data_rights_rpcs`**,
**`revoke_delete_account_from_anon`**, **`create_news_tables`** (2026-09-19; SQL
in the merge-1 plan's Task 8, plus an index on `stories.source_id`).

### Content layer — DB-preferred + seed fallback (IMPORTANT, new)
`src/lib/content.ts` is now **async**. Tools load from the `tools` table
(**override-by-slug, add-new**) **merged over the git-versioned seed**; if the DB
is empty/unreachable it falls back to pure seed. A **60s TTL cache** +
**2.5s timeout** keep a build from hammering or stalling on a paused DB. Admin
`saveTool`/`deleteTool` call `revalidatePath("/", "layout")` + `invalidateToolCache()`.
Categories/authors/seed-reviews remain seed-only.

### Supabase gotchas learned (important)
- **`.upsert()` / `.insert()` + RLS:** supabase-js `.insert()` defaults to
  `return=minimal` (no RETURNING → no SELECT needed) and works under
  **anon-insert-only** policies. `.upsert()` returns a representation → needs
  SELECT → **silently fails** where anon has no read policy (this bit the
  newsletter). For anon writes use `.insert()` and treat unique-violation
  (`error.code === '23505'`) as a friendly no-op.
- Query builders are **lazy thenables** — `void supabase.from(...).x()` never runs;
  `.then()`/`await` it.
- Seeded auth users need token columns set to `''` (not NULL) or GoTrue 500s.
- Supabase rejects emails with no MX (`*.test`, etc.); use a real domain.

---

## 5. Tech stack

| Layer | Choice |
|-------|--------|
| Runtime / PM | Node 24.x, pnpm (npm works too) |
| Framework | **Next.js 16.2.10**, App Router, Turbopack |
| UI | **React 19**, **TypeScript** strict; **Tailwind v4** (CSS-first in `globals.css`) |
| Components | shadcn/ui on unified `radix-ui` in `src/components/ui/` |
| Icons | **lucide-react 1.x** via the string registry in `shared/icon.tsx` |
| Motion / 3D | Motion for React; GSAP+ScrollTrigger (hero); anime.js v4 (leaderboards); three + R3F + drei (hero GLB) |
| Search | Fuse.js (threshold 0.3) |
| Forms | React Hook Form + Zod v4 |
| **Backend/Auth/CMS** | **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — see §4 |
| Server mutations | **Next server actions** (submit, newsletter, admin moderation + tool CRUD). Reviews, saved tools, and collections write from the **browser client** under RLS, not through server actions. **Every admin action calls `assertAdmin()` itself** — server actions are public POST endpoints, and RLS alone does not stop an unauthorized caller from triggering their side effects. |
| Toasts / Analytics | Sonner; Vercel Web Analytics + Speed Insights |
| **Observability** | **Sentry** (`@sentry/nextjs`) — errors on node/edge/client, CSP violation collector, cron check-ins. DSN committed in `src/lib/sentry.ts` (public by design); `SENTRY_AUTH_TOKEN` in Vercel for source maps |
| Tests | Vitest (jsdom) + Playwright. Specs live in **`tests/e2e/`**, not `e2e/`, which does not exist. `playwright.config.ts` sets `testDir: "./tests/e2e"` and builds + serves on port 3100 |
| Asset pipeline | `@gltf-transform/*` + `meshoptimizer` (hero model), `sharp` (brand mask, poster). Sources live in `assets/`, never served; `public/` artefacts are generated |
| Dev tooling | code-review-graph MCP (§10) |
| Theme / Hosting | Dark only (`class="dark"`); Vercel — live, auto-deploys on push to `main` |

---

## 6. Architecture & file map (new/changed highlighted)

Server Components by default; `"use client"` only where needed. `@/*` → `src/*`.

```
src/
  middleware.ts                # Supabase session refresh
  app/
    layout.tsx                 # <html class="dark"> providers; async (awaits getSearchDocs/getAllTools)
    page.tsx                   # Home (async)
    tools/… categories/… compare/ leaderboards/ saved/ login/ auth/
    finder/page.tsx            # NEW guided recommender → <OracleFinder>
    deals/page.tsx             # NEW deals roundup
    submit/page.tsx + actions.ts   # NEW submit-a-tool
    collections/page.tsx       # NEW (auth-gated manager)
    lists/[id]/page.tsx        # NEW public shared collection
    best/[category]/page.tsx   # NEW SEO listicle
    alternatives/[slug]/page.tsx   # NEW SEO
    vs/[versus]/page.tsx       # NEW SEO head-to-head
    go/[slug]/route.ts         # NEW tracked outbound redirect
    llms.txt/route.ts          # NEW
    privacy/ terms/            # NEW legal pages
    manifest.ts apple-icon.tsx # NEW PWA
    admin/
      page.tsx                 # dashboard (analytics/moderation/re-vet/submissions)
      actions.ts               # setReviewStatus, setSubmissionStatus
      moderation-actions.tsx submission-actions.tsx
      tools/page.tsx           # NEW CMS list
      tools/[slug]/page.tsx    # NEW CMS editor (+ new-tool template)
      tools/actions.ts tool-editor.tsx  # NEW saveTool/deleteTool + JSON editor
    actions/newsletter.ts      # NEW subscribe action
  components/
    finder/ collections/ submit/ seo/(ranked-tool-row)  # NEW
    detail/(… + deal-box, community-rating-summary)      # NEW additions
    shared/(… + affiliate-disclosure)                    # NEW
    layout/ home/ directory/ compare/ leaderboard/ saved/ auth/ ui/
  data/                        # tools.ts (27), categories.ts (8), authors.ts (6), reviews.ts (27) — the seed BASE
  lib/
    content.ts                 # ASYNC DB-preferred + seed fallback (see §4)
    finder.ts outbound.ts deals.ts freshness.ts reviews.ts seo.ts admin.ts   # NEW
    structured-data.ts         # + itemList/faq/breadcrumb builders
    supabase/(client,server,middleware,anon,database.types)   # anon.ts NEW (cookieless writes)
    schemas.ts filters.ts site.ts fonts.ts utils.ts
    *.test.ts                  # content, filters, structured-data, finder, outbound, deals, freshness, reviews, seo (88 tests)
  fonts/ · public/(models,logos,screenshots,brand,icon.svg)
  scripts/capture-screenshots.mjs · tests/e2e/(directory, finder)
  docs/superpowers/plans/      # written implementation plans (one per feature)
.claude/hooks/visual-sweep-guard.mjs   # NEW — see §9
```

---

## 7. Design language (unchanged core)

**Palette (dark only, teal is the accent; amber used only for deal/savings
affordances):** `#16191D` void · `#222831` surface · `#393E46` slate ·
**`#00ADB5` teal** · `#35E4EC` bright · `#EEEEEE` mist. All CSS vars on `:root`.
Keep `class="dark"` on `<html>`.

**Type:** Cardot (display) · Hanken Grotesk (body) · IBM Plex Mono (eyebrows).
**Atmosphere:** `.grain`, `.glass`, `.spotlight`, `.emblem`, `.ring-hairline`;
`prefers-reduced-motion` neutralizes animation globally.

---

## 8. Conventions (keep these)

- **DB-preferred + seed fallback** for tools (§4). Categories/authors/seed-reviews
  are seed-only. `content.ts` getters are **async** — `await` them (TS enforces it).
- **Teal accent, dark only.** Avoid AI-slop aesthetics. Respect reduced-motion.
- **Icons are strings** → registry in `shared/icon.tsx` (add new icons there;
  `Home`→`House` alias). Missing names fall back + warn in dev.
- **No em-dashes in displayed copy** (comments exempt).
- **React-hooks lint on** (no setState synchronously in an effect — async fetch is
  OK). Three files carry a justified `eslint-disable` for it: the collections
  manager's load effect, `detail/community-reviews.tsx`, and
  `lib/use-search-params-on-mount.ts`. When the rule fires on a genuine false
  positive, add a **visible** disable with a one-line reason. Do **not** wrap the
  effect body in a nested function to silence it: that defeats the rule for any
  body, including a bare setState, so it suppresses real findings too.
- **Integrity guardrails (don't break):** never ship a fabricated sponsored tool,
  deal, coupon, or vetting date in the committed seed — those are operator-set.
  Sponsored placement **never** touches editorial score/verdict/search/leaderboards.
- **Affiliate rel:** outbound links carry `rel="sponsored"` only when a tool has an
  `affiliateUrl`; all outbound routes through `/go/[slug]` for tracking.

### Security invariants (do not regress these)

- **URL schemes are allowlisted.** `src/lib/safe-url.ts` is the only authority.
  Never use bare `z.url()` for a stored URL — Zod v4 accepts `javascript:`,
  `data:`, and `file:`. New stored-URL fields use the `httpUrl` schema, and any
  new render site uses `safeExternalHref()`.
- **Redirect targets are validated.** `src/lib/safe-redirect.ts` is the only
  authority. Never hand a `?redirect=` parameter to `router.push()` directly.
- **Collection notes are private.** `/lists/[id]` must not select or render
  `collection_items.note`. The collections manager promises privacy in its copy.
- **`pnpm audit:rls` must stay green.** It proves anonymous callers cannot read
  `admins`, `profiles`, `reviews`, `collections`, `subscribers`,
  `tool_submissions`, or `outbound_clicks`.
- **CI fails on a high-severity production advisory.** `pnpm audit --prod
  --audit-level high` runs on every push; keep it at exit 0.

---

## 9. Visual Sweep rule (MANDATORY — see CLAUDE.md §"Visual Sweep")

Any change to visual code (`.tsx/.jsx/.css/.scss`, Tailwind, layout) **must** be
verified in a real browser before claiming done/committing — typecheck/lint/tests
don't catch layout breakage (overflow, clipping, misalignment). A `PostToolUse`
hook (`.claude/hooks/visual-sweep-guard.mjs`) reminds you the moment visual code
changes. Procedure (from CLAUDE.md): serve → load affected routes + `/` + `/tools`
→ console clean → **measure** bounding boxes (`badge.right <= card.right`, no
`scrollWidth > clientWidth`) at narrow + wide widths → cite what you checked.
This exists because a pricing-badge clip once shipped on HTML-only inspection.

---

## 10. Gotchas (these cost real time)

1. **`.upsert()` vs `.insert()` under anon RLS** — §4. The #1 non-obvious backend trap.
2. **DB-preferred content is async + build-time** — static pages bake tool content
   at build; a DB edit needs a revalidate (admin `saveTool` does it) or rebuild to
   appear on *static* pages. Dynamic routes (`/tools/[slug]` on-demand) reflect DB
   edits immediately.
3. **Verifying RHF form submits in automation** — a synthetic click may not fire
   `handleSubmit`; use `form.requestSubmit()` (this masked the submit + newsletter
   flows during verification until switched).
4. **Admin/auth features can't be visually verified without a login** — you can't
   create accounts in automation. Verify the gate (unauth → `/login`), RLS (via
   SQL as `anon`), and the data layer; the logged-in UI is a human click-through.
5. **Turbopack stale chunks / console buffer** — verify against a fresh tab +
   `build`, not the stale dev console. `rm -rf .next` clears the server side.
6. **Automated screenshots time out** on the GPU-heavy hero — use DOM measurement
   (`getBoundingClientRect`) to verify layout, not screenshots. Worse, the
   in-app browser pane often does not composite frames at all, and when it does
   not, **`requestAnimationFrame` callbacks never fire**. Anything built on rAF
   is therefore invisible to a sweep run through that pane, and will look
   broken when it is fine: focus management in `finder/oracle-finder.tsx` is
   the known case. Two consequences. First, right after `navigate` the pane can
   report `innerWidth: 0`; a `resize_window` plus a short wait fixes it, and a
   0-width viewport is not a layout bug. Second, to verify anything
   rAF-dependent, drive a real headless browser (a throwaway Playwright script)
   instead of trusting the pane.
7. **Git hooks live in `.githooks/`, not `.git/hooks`.** `.git/hooks` is never
   pushed, so a hook installed by hand on one machine does not exist on the
   other — this is why an earlier pre-commit hook silently vanished. The
   versioned hook is wired by `core.hooksPath`, which the `prepare` script sets
   on every `pnpm install`. `pnpm run doctor` reports it if it is unset.
   `.gitattributes` pins `.githooks/*` to LF: a CRLF on the shebang line makes
   `sh` fail with `bad interpreter` on macOS/Linux while working fine on Windows.
8. **`reviews.status` is not writable over PostgREST.** Table-level INSERT/UPDATE
   were revoked and re-granted per column. If you add a column to `reviews` you
   must grant it explicitly or writes start failing with a permission error. A
   table-level grant would silently re-open the self-approval bypass — never
   `grant update on public.reviews`.
9. **Turbopack builds an empty `middleware-manifest.json` for `proxy.ts`.** That
   is not a signal the proxy is dead — the code lands in a loader chunk. Verify
   by setting a response header in `proxy.ts` and curling a route, not by
   reading the manifest.
10. **`revoke execute ... from anon` on a function is a silent no-op.** Postgres
    grants EXECUTE on new functions to **PUBLIC**, and `anon` inherits it, so the
    revoke must target `public` and the intended roles be re-granted explicitly.
    Check with `select proacl from pg_proc` — a leading `=X/postgres` entry *is*
    the PUBLIC grant. `is_admin()` is deliberately left PUBLIC-executable: it is
    called inside the RLS policies that anonymous readers hit (`published OR
    is_admin()` on `tools`), and policy expressions are evaluated with the
    caller's privileges, so revoking it would break the public site.
11. **`z.url()` is not a protocol check.** Zod v4 only asks whether `new URL()`
    parses, so `javascript:`, `data:`, `vbscript:`, and `file:` all validate.
    Use the `httpUrl` schema in `src/lib/schemas.ts`, which delegates to
    `isHttpUrl()` in `src/lib/safe-url.ts`.
12. **`target="_blank"` is not a security control.** Chrome refuses
    `javascript:` for `_blank` navigations, which is why the admin submission
    link was never exploitable — but that is browser behaviour, not a decision
    this codebase made. The real controls are the schema, the
    `tool_submissions_url_check` constraint, and `safeExternalHref()`.
13. **A `javascript:` URL's return value replaces the document.** If you ever
    test this, note the navigation is *queued*: reading a marker synchronously
    after `.click()` gives a false negative. Await a macrotask first.

---

## 11. code-review-graph (dev tooling)

Tree-sitter/SQLite structural graph + MCP tools for token-efficient
exploration/review. Auto-reindexes on Edit/Write and commit; `CLAUDE.md` tells
Claude to prefer graph tools over Grep/Read. Rebuild: `code-review-graph build`;
stats: `code-review-graph status`. Requires a Claude Code restart to load the MCP.

---

## 12. Open items / next steps

**The single to-do list now lives in [`docs/roadmap.md`](docs/roadmap.md).**
It merges this section's pre-launch list with a verified external review of the
live site, and it supersedes the lists in
`docs/launch-readiness-audit-2026-07-29.md`, `docs/stack-evaluation-2026-07-29.md`
and the Operator Checklists inside `docs/superpowers/plans/*`. Every one of those
points at the roadmap. **Do not start a second one.**

**Exception while it is in flight:** the AI news pivot is tracked in §0 and its
spec and plan, not yet in the roadmap. Merge 4 of the spec adds it as a roadmap
phase.

Orientation only, so a fresh session knows where things stand:

- **Phase 0** is the launch gate. Three items on it are defects that contradict
  the site's own headline claim: `/alternatives/*` pads its lists with
  unrelated tools from other categories, `/tools` and `/compare` serve crawlers
  an empty Suspense fallback instead of the directory, and the copy credits
  "our editors" while `src/data/authors.ts` is deliberately empty.
- **Phase 1** is the moat: a published scoring rubric, evidence-based reviews,
  and an `/about` page with a named reviewer and an editorial policy.
- Phases 2-6 cover empty-feature cleanup, positioning, SEO durability, the
  internal-tools push (admin CMS, self-hosted newsletter, analytics board), and
  post-launch operations.

Already resolved and not on the list: the fabricated per-tool ratings and the six
invented reviewer personas are gone (`src/data/authors.ts` is deliberately empty,
no `rating:` fields remain in the seed, `hasVerifiedRatings` stays `false`).
Deploy, admin grant, and the domain migration are done.
