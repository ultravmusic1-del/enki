# Enki — Project Handoff

> A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**,
> the Sumerian god of wisdom, "the oracle for AI tools." Fuses ancient
> oracle/clay-tablet gravitas with a sleek dark AI-product UI.
> Tagline: **"Wisdom for the age of AI."**

Single source of truth for continuing work in a fresh session. **Read §1 and §2
first** — current state, the live backend, and how to unlock the admin.

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

**Gates:** `pnpm verify` (typecheck + lint + test) is the gate, and the
pre-commit hook runs it for any commit touching code. `pnpm build` is
authoritative for routing, `pnpm sweep` for layout. Counts are deliberately not
recorded here — they go stale. Run the commands.

**Repo:** `https://github.com/ultravmusic1-del/enki.git` (branch `main`, pushed).
**Live:** https://enki-five.vercel.app (Vercel project `enki`, auto-deploys on
push to `main`). Deployment Protection is on, which gates the *deployment-specific*
and preview URLs behind Vercel SSO; the production alias above is public.

---

## 2. ⚠ Important context for continuing (READ THIS)

### 2a. Environment variables (required)
```
NEXT_PUBLIC_SUPABASE_URL=https://qknsqurdawglctwqfwxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_iRpRQepBf8ozIoeBYH-sqQ_mjhupS5a
```
In **`.env.local`** (gitignored, so it never travels between machines);
`.env.example` documents them and `pnpm doctor` reports exactly which keys a
machine is missing.
Both are the **publishable/anon** kind — safe client-side; RLS enforces access.
The `service_role` key is never used or stored. **No new env vars are required**
for the current features; the (unbuilt) email digest would add `RESEND_API_KEY`.

### 2b. Deployed ✅ — one auth setting still outstanding
Live at **https://enki-five.vercel.app**; `git push` to `main` auto-deploys.
Env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Still to do:** add the Vercel URL to **Supabase → Auth → URL Configuration**
(Site URL = `https://enki-five.vercel.app`, Redirect URLs += 
`https://enki-five.vercel.app/auth/callback`). Password sign-in works without
this, but confirmation and recovery emails will point at the wrong origin.

**Canonical origin:** `siteConfig.url` is resolved from the environment, not
hard-coded — `NEXT_PUBLIC_SITE_URL` if set, else Vercel's injected production
domain, else localhost. Set `NEXT_PUBLIC_SITE_URL` when a custom domain is
attached; nothing needs changing until then.
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
pnpm doctor         # env, deps, hooks, toolchain, Supabase, and what's in flight
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
pnpm doctor
```

`pnpm doctor --fix` repairs hooks and dependencies and creates a missing
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

### RPCs (SECURITY DEFINER)
- **`is_admin()`** → boolean; used by RLS + the app gate without exposing `admins`.
- **`admin_click_stats(days int)`** → per-tool click counts; self-guards with
  `is_admin()` (non-admins get 0 rows even if they call it directly). `anon`
  cannot execute it.
- **`admin_set_review_status(review_id uuid, new_status text)`** → boolean; the
  only path that may write `reviews.status`. Self-guards with `is_admin()` and
  returns false (not an error) for everyone else. `anon` cannot execute it.

### Migrations applied (via MCP)
`init_auth_backend`, `lock_down_handle_new_user`, `create_outbound_clicks`,
`admin_foundation` (admins + is_admin + reviews.status + click-stats RPC),
`create_tool_submissions`, `create_collections`, `create_subscribers`,
`create_tools_table`, **`harden_review_moderation`**, **`harden_public_input`**,
**`revoke_admin_rpc_from_public`**, **`tighten_submission_url_scheme`**,
**`narrow_profiles_read`**, **`revoke_unnecessary_anon_grants`**.

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
| Tests | Vitest (jsdom) + Playwright |
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
  OK; the collections manager has one justified `eslint-disable` for its load effect).
- **Integrity guardrails (don't break):** never ship a fabricated sponsored tool,
  deal, coupon, or vetting date in the committed seed — those are operator-set.
  Sponsored placement **never** touches editorial score/verdict/search/leaderboards.
- **Affiliate rel:** outbound links carry `rel="sponsored"` only when a tool has an
  `affiliateUrl`; all outbound routes through `/go/[slug]` for tracking.

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
   (`getBoundingClientRect`) to verify layout, not screenshots.
7. **Git hooks live in `.githooks/`, not `.git/hooks`.** `.git/hooks` is never
   pushed, so a hook installed by hand on one machine does not exist on the
   other — this is why an earlier pre-commit hook silently vanished. The
   versioned hook is wired by `core.hooksPath`, which the `prepare` script sets
   on every `pnpm install`. `pnpm doctor` reports it if it is unset.
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

---

## 11. code-review-graph (dev tooling)

Tree-sitter/SQLite structural graph + MCP tools for token-efficient
exploration/review. Auto-reindexes on Edit/Write and commit; `CLAUDE.md` tells
Claude to prefer graph tools over Grep/Read. Rebuild: `code-review-graph build`;
stats: `code-review-graph status`. Requires a Claude Code restart to load the MCP.

---

## 12. Open items / next steps

### Operator decisions needed before a public launch

- **The seed `rating` / `reviewCount` on tools are editorial sample figures, not
  real community aggregates**, and the six reviewers in `src/data/authors.ts` are
  invented personas. The parts that could not be substantiated at all are now
  gone — the "verified reviewer" badge, the invented "helpful" counts, the star
  histogram synthesized from an aggregate, and all `AggregateRating`/`Review`
  structured data (gated behind `siteConfig.hasVerifiedRatings`, currently
  `false`). **The displayed numbers and the bylines remain.** For a site that
  earns affiliate revenue off these rankings, decide before launch whether to
  (a) replace them with real moderated-review aggregates, (b) relabel them
  plainly as editorial estimates, or (c) remove them. Flip
  `hasVerifiedRatings` to `true` only once (a) is done.
- **Edge rate limiting.** The public forms have honeypots and Postgres CHECK
  constraints, but no request-rate ceiling. Add Vercel WAF / firewall rules for
  `/submit`, `/go/*`, and the newsletter action at deploy time.
- **Enable leaked-password protection** in Supabase → Auth (flagged by the
  security advisors; dashboard-only setting).

### Still to build

- **Deploy** (§2b) — Vercel git import + env vars (your action), then verify; grant
  yourself admin (§2c).
- **Email sending** — the newsletter *captures* subscribers but doesn't send.
  Wire a provider (Resend/Postmark) + `RESEND_API_KEY` for the weekly digest +
  per-tool "notify me when this changes" alerts (the freshness `changelog` is the
  source).
- **Link-health cron** — a Vercel Cron that pings each tool's site and flags dead
  links into the admin re-vet queue (folded conceptually into freshness; not built).
- **CMS authoring UX** — the tool editor is a Zod-validated **JSON editor** (fully
  functional). A field-by-field form (array editors for keyFeatures/screenshots/
  pros/cons, Supabase Storage for logo/screenshot uploads) is the polish pass.
- **A nonce-based CSP** — deliberately omitted in `next.config.ts` because the 3D
  hero and Vercel Analytics need a validated policy first.
- **Component/E2E tests** — `lib` logic and the admin/CMS server actions are now
  covered (121 tests); the React components remain largely untested.
- **Consider a real `createdAt`/`updatedAt` on tools** (now that they can be
  DB-backed) to power an honest RSS feed / "recently added" digest.
```
