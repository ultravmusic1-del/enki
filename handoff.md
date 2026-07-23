# Enki — Project Handoff

> A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**,
> the Sumerian god of wisdom, "the oracle for AI tools." Fuses ancient
> oracle/clay-tablet gravitas with a sleek dark AI-product UI.
> Tagline: **"Wisdom for the age of AI."**

Single source of truth for continuing work in a fresh session. **Read §1 and §2
first** — they cover the current state, the live backend, and what's still pending.

---

## 1. Current status

Enki is a **feature-complete, dark-only Next.js 16 app with a real Supabase
backend**. Far beyond the original static MVP: it now has auth, persisted
reviews, cross-device saved tools, comparison, leaderboards, and full SEO.

**Pages:** home · `/tools` (directory) · `/tools/[slug]` (detail) · `/categories`
· `/categories/[slug]` · `/leaderboards` · `/compare` · `/saved` · `/login` ·
`/auth/callback`.

**What works, verified this session:**
- **Auth** — Supabase email/password (sign in/up, session middleware, header
  account menu). Demo login: **`reviewer@enki.app` / `enkitest123`**.
- **Reviews** — auth-gated, persisted to Postgres (RLS owner-write / public-read);
  real reviews render under "From the Enki community" above the seeded samples.
- **Saved tools** — localStorage when logged out, **synced to Supabase when logged
  in** (with one-time local→DB migration on login).
- **Compare** — `/compare` (side-by-side, URL-shareable) + a global compare tray +
  per-card "compare" actions.
- **Leaderboards** — `/leaderboards`, anime.js-animated, editor + community boards.
- **Screenshots** — real 1280×800 captures per tool in `public/screenshots/`.
- **SEO** — `sitemap.ts`, `robots.ts`, JSON-LD structured data, dynamic OG/Twitter
  images per tool + site.
- **⌘K command palette** — fuzzy tool/category search + "Go to" page navigation.

**Gates green:** `pnpm typecheck`, `pnpm lint`, `pnpm build` (103 routes),
`pnpm test` (**45 tests**).

**Repo:** `https://github.com/ultravmusic1-del/enki.git` (branch `main`).
Latest commit: **`97bac6d`** (score-action clip fix + graph-flagged tests). Prior:
`bd44fbe` (the big feature + Supabase commit).

**NOT deployed yet** — see §2.

---

## 2. ⚠ Important context for continuing (READ THIS)

### 2a. Environment variables are now REQUIRED
The app needs Supabase config or auth/reviews/saved break:
```
NEXT_PUBLIC_SUPABASE_URL=https://qknsqurdawglctwqfwxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_iRpRQepBf8ozIoeBYH-sqQ_mjhupS5a
```
These live in **`.env.local`** (gitignored, present locally). `.env.example`
documents them (committed). Both values are the **publishable/anon** kind — safe
in the client; RLS enforces access. The `service_role` key is never used or stored.

### 2b. Deploy is pending YOUR manual step
The Vercel connector can only do inline file-upload (impractical at 22 MB of
assets) and has no Git-import or env-var tool. **Correct path:** import
`ultravmusic1-del/enki` at [vercel.com/new](https://vercel.com/new), add the two
env vars above, deploy. After that, `git push` auto-deploys. Once it builds, the
Vercel connector CAN read deployment/build logs to debug.
**Post-deploy:** add the Vercel URL to Supabase → Auth → URL Configuration (Site
URL + Redirect URLs) so signup-confirmation links resolve (email/password *login*
works without it).

### 2c. Uncommitted files (deliberately held — your decision)
`97bac6d` committed only the layout fix + tests. Still in the working tree:
- **code-review-graph integration** — `.mcp.json`, `CLAUDE.md`, `.claude/skills/`,
  `.claude/settings.json`, `.gitignore` (adds `.code-review-graph/`), and
  `.git/hooks/pre-commit`. Commit these if you want the team to share the graph.
- **`.claude/launch.json`** — `autoPort:true` change (so it uses a free port when
  3000 is taken by another chat's dev server).
- **`brand/*.pdf`** — personal PDFs; keep excluded.

### 2d. Email confirmation is ON (Supabase default)
Real signups get a confirm-link email; the seeded demo user is pre-confirmed so
you can log in instantly. For frictionless dev, toggle "Confirm email" off in
Supabase → Auth → Providers → Email (dashboard only; no MCP tool for it).

---

## 3. How to run

Requires **Node 24.x** and **pnpm**.
```bash
pnpm install
pnpm dev          # http://localhost:3000 (Next 16 + Turbopack). Reads .env.local.
pnpm build        # production build (authoritative)
pnpm start
pnpm typecheck | pnpm lint | pnpm test | pnpm test:e2e
```
`.claude/launch.json` (name `enki-dev`) has `autoPort:true` — if 3000 is taken it
auto-picks a free port (only signup-confirmation redirects care about the port).

---

## 4. Backend — Supabase (live)

**Project `enki`** — id `qknsqurdawglctwqfwxe`, region `ap-south-1`, free tier,
org `ultravmusic1-del's Org`. Managed via the Supabase MCP connector.

**Schema (`public`), all RLS-enabled:**
- **`profiles`** `(id → auth.users, display_name, created_at)` — auto-created on
  signup by the `handle_new_user()` trigger. Public-read, self-write.
- **`reviews`** `(id, tool_slug, user_id, rating 1–5, title?, body?, created_at,
  updated_at, unique(tool_slug,user_id))` — public-read, owner-write. `tool_slug`
  references the static seed catalog (no FK; tools stay seed data).
- **`saved_tools`** `(user_id, tool_slug, created_at, pk(user_id,tool_slug))` —
  owner-only.

**Migrations applied:** `init_auth_backend`, `lock_down_handle_new_user` (revoked
public EXECUTE on the trigger fn — a security-advisor finding). Advisor is clean.

**Next.js integration (`@supabase/ssr`):**
- `src/lib/supabase/{client,server,middleware}.ts` + `database.types.ts`.
- `src/middleware.ts` (session refresh; Next 16 warns it should be renamed to
  `proxy.ts` — deprecation, still works).
- `src/components/auth/{auth-provider,login-form,account-menu}.tsx`,
  `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`.

**Supabase gotchas learned (important):**
- **Query builders are lazy thenables** — a bare `void supabase.from(...).upsert()`
  never runs. You MUST `.then()` / `await` it (this caused a saved-sync bug).
- **Seeded auth users need token columns set to `''`, not NULL** (`confirmation_token`,
  `recovery_token`, `email_change*`, `phone_change*`, `reauthentication_token`), or
  GoTrue returns 500 on sign-in.
- Supabase **rejects emails with no MX** (e.g. `*.test`, `enki-test.com`); use a
  real domain, or seed a confirmed user via SQL for testing.

---

## 5. Tech stack

| Layer | Choice |
|-------|--------|
| Runtime / PM | Node **24.x**, **pnpm 11** |
| Framework | **Next.js 16.2.10**, App Router, **Turbopack** |
| UI | **React 19**, **TypeScript** strict; **Tailwind v4** (CSS-first in `globals.css`) |
| Components | **shadcn/ui** on unified `radix-ui` in `src/components/ui/` |
| Icons | **lucide-react 1.x** via the string registry in `shared/icon.tsx` |
| Motion | **Motion for React** (`motion/react`); **GSAP + ScrollTrigger** (hero); **anime.js v4** (leaderboards) |
| 3D | **three** + **@react-three/fiber** + **drei** (hero GLB only) |
| Search | **Fuse.js** (threshold 0.3 — tightened this session) |
| Forms | **React Hook Form + Zod v4** |
| **Backend/Auth** | **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — see §4 |
| Toasts / Analytics | **Sonner**; **Vercel Web Analytics + Speed Insights** |
| Tests | **Vitest** (jsdom) + **Playwright** |
| Dev tooling | **code-review-graph** MCP (structural graph; see §9) |
| Theme | **Dark only** — `class="dark"` hardcoded on `<html>`, no theme switching |
| Hosting | **Vercel** (not yet deployed) |

---

## 6. Architecture & file map

Server Components by default; `"use client"` only where needed. `@/*` → `src/*`.

```
src/
  middleware.ts                # Supabase session refresh (all routes)
  app/
    layout.tsx                 # <html class="dark"> + AuthProvider > SavedToolsProvider
                               #   > CommandMenuProvider (header/main) + CompareTray
                               #   + JsonLd(site) + Toaster + Analytics
    template.tsx               # route transition (.page-transition replay)
    globals.css                # ALL design tokens (dark), atmosphere utils, keyframes
    opengraph-image.tsx / twitter-image.tsx        # site OG cards (satori)
    sitemap.ts / robots.ts                          # SEO
    page.tsx                   # Home (oracle hero → featured → categories → vet → CTA)
    not-found.tsx
    tools/page.tsx             # /tools directory
    tools/[slug]/page.tsx      # tool detail (score dial + actions + reviews)
    tools/[slug]/opengraph-image.tsx / twitter-image.tsx   # per-tool OG cards
    categories/page.tsx · categories/[slug]/page.tsx
    compare/page.tsx           # /compare (Suspense → CompareView)
    leaderboards/page.tsx      # /leaderboards (LeaderboardsView, anime.js)
    saved/page.tsx             # /saved (SavedGallery)
    login/page.tsx · auth/callback/route.ts        # auth
  components/
    ui/                        # shadcn primitives
    layout/                    # site-header (liquid-glass nav + account + saved badge),
                               #   site-footer, command-menu (⌘K + Fuse + page nav)
    home/                      # oracle-hero, oracle-model(+scene) [R3F], featured/category cards
    directory/                 # directory-explorer (search/filter/sort, URL-synced)
    detail/                    # screenshot-carousel, rating-distribution, review-list,
                               #   review-modal (auth-gated → Supabase), community-reviews (DB)
    compare/                   # compare-view, compare-selection (store), compare-toggle, compare-tray
    leaderboard/               # leaderboards-view
    saved/                     # saved-tools (auth-aware store), save-button, saved-gallery
    auth/                      # auth-provider, login-form, account-menu
    seo/                       # json-ld
    shared/                    # tool-card, savable-tool-card, tool-logo, star-rating, monogram,
                               #   pricing-badge, container, section-heading, reveal, border-beam,
                               #   category-card, icon (registry)
  data/                        # tools.ts (27), categories.ts (8), authors.ts (6), reviews.ts (27 seed)
  lib/
    content.ts                 # access layer (+ getLeaderboards, getCompareTools)
    structured-data.ts         # JSON-LD builders (siteJsonLd, toolJsonLd)
    og.ts                      # OG-image font/palette helpers (satori)
    supabase/                  # client, server, middleware, database.types
    schemas.ts · filters.ts · site.ts · fonts.ts · use-gsap.ts · utils.ts
    *.test.ts                  # content, filters, structured-data (45 tests total)
  fonts/                       # Cardot .otf/.ttf
public/
  models/enki-model.glb (~1.3MB) · logos/<slug>.png (27) · screenshots/<slug>/*.png · brand/
scripts/capture-screenshots.mjs # Playwright screenshot capture (re-runnable per slug)
tests/e2e/directory.spec.ts
docs/superpowers/plans/         # written implementation plans
```

---

## 7. Design language (unchanged core)

**Palette (dark only, teal is the ONLY accent):** `#16191D` void · `#222831`
surface · `#393E46` slate · **`#00ADB5` teal** · `#35E4EC` bright · `#EEEEEE`
mist. All CSS vars on `:root` in `globals.css`. Keep `class="dark"` on `<html>`
(Tailwind `dark:` utilities depend on it).

**Type:** **Cardot** (local, display) · **Hanken Grotesk** (body) · **IBM Plex
Mono** (eyebrows/metadata). **Atmosphere:** `.grain`, `.glass`, `.spotlight`,
`.emblem`, `.ring-hairline`; keyframes incl. `score-draw`, `page-in`.
`prefers-reduced-motion` neutralizes animation globally.

---

## 8. Data model & conventions (keep these)

**Seed data** in `src/data/*.ts`, validated by Zod (`src/lib/schemas.ts`), resolved
via `src/lib/content.ts` (throws in dev on bad data). Tools/categories stay static
seed; only reviews + saved live in Supabase (hybrid by design).

- **Teal is the only accent. Dark only.** Avoid AI-slop aesthetics.
- **Respect `prefers-reduced-motion`** everywhere.
- **Icons are strings** → registry in `shared/icon.tsx` (guards lucide 1.x renames;
  `Home` is aliased to `House`). Add new icons there.
- **No em-dashes in displayed copy** (comments exempt).
- **React Compiler lint is on** (`react-hooks/*`): no setState synchronously in an
  effect (async data fetches are OK — setState resolves after `await`), no
  ref/`useMemo` mutation during render.

---

## 9. Recent session changelog

Everything below was built this session (all in `bd44fbe` unless noted):

1. **Real screenshots** — captured 1280×800 shots per tool (`scripts/capture-screenshots.mjs`),
   wired into the detail carousel with graceful fallback.
2. **Leaderboards** (`/leaderboards`) — anime.js v4 boards (editor score + community).
3. **Compare** (`/compare`) — side-by-side table (URL-shareable) + global compare
   tray + per-card compare actions.
4. **Saved tools** — bookmarks; localStorage → Supabase sync when signed in.
5. **Auth + backend** — Supabase project, schema, RLS, `handle_new_user` trigger,
   session middleware, email/password auth UI.
6. **Reviews → Postgres** — auth-gated submit + live community reviews display.
7. **SEO** — sitemap, robots, JSON-LD (`SoftwareApplication`/`AggregateRating`/
   `Review`/`BreadcrumbList` + site `Organization`/`WebSite`), dynamic OG/Twitter images.
8. **⌘K page navigation** — "Go to" group in the command palette.
9. **Fixes** — H1 "for AI" spacing, `Home`→`House` icon alias, footer nav parity
   (Compare/Leaderboards), tighter Fuse search relevance (0.4→0.3).
10. **`97bac6d`:** tool-detail score-action row moved to a full-width row below the
    score so the four buttons wrap instead of clipping at sub-fullscreen widths
    (all 27 tool pages); + regression tests for `getLeaderboards`, `getCompareTools`,
    and the structured-data builders (suite 31→45).
11. **code-review-graph** installed (dev tooling; §10) — *uncommitted, see §2c*.

---

## 10. Gotchas (these cost real time)

1. **Turbopack stale chunks / console buffer.** After edits the dev server can
   serve stale compiled chunks, and `read_console_messages` in tooling keeps
   showing **old, already-fixed errors** even after a server restart — verify
   against a fresh browser tab and `pnpm build`, not the stale console. `rm -rf
   .next` + restart clears the server side.
2. **Supabase query builders are lazy** — must `.then()`/`await` or the query
   never fires (§4).
3. **Seeded Supabase users need `''` token columns** or GoTrue 500s (§4).
4. **Automated screenshots time out** on the GPU-heavy hero / heavy pages — capture
   limitation, not a page bug. Prefer DOM measurement (`getBoundingClientRect`) to
   verify layout.
5. **code-review-graph pre-commit hook prints a `UnicodeEncodeError`** (Windows
   cp1252 can't encode its Rich output) but is guarded by `|| true` — commits are
   **not** blocked. Cosmetic.
6. **One dev server per project dir** / port 3000 contention → `autoPort` handles it.

---

## 11. code-review-graph (dev tooling)

Installed (`pip install`, Python 3.12). Builds a Tree-sitter/SQLite structural
graph of the repo and serves MCP tools for token-efficient exploration/review.
- **Graph:** 110 files, ~447 nodes, ~3.2k edges (`.code-review-graph/`, gitignored).
- **Auto:** hooks re-index after each Edit/Write and on commit; `CLAUDE.md` tells
  Claude to prefer graph tools over Grep/Read. Requires **Claude Code restart** to
  load the MCP server.
- **Rebuild:** `code-review-graph build`; stats: `code-review-graph status`.
- Flagged the biggest real gap: **test coverage** — the components/pages/auth/
  supabase layers are largely untested (only the `lib` pure functions are). The
  session added leaderboard/compare/structured-data tests; **auth, saved, and the
  React components remain untested** — the highest-leverage next work.

---

## 12. Open items / next steps

- **Deploy** (§2b) — Vercel git import + env vars (your action), then verify.
- **Commit the code-review-graph integration** if the team should share it (§2c).
- **Rename `middleware.ts` → `proxy.ts`** (Next 16 deprecation warning).
- **More tests** — auth flows, the saved-tools provider, compare/leaderboard
  components (mock Supabase with `@supabase/…` in vitest).
- Social login (Google/GitHub) if wanted — needs provider creds in the Supabase
  dashboard. Swap seed → live CMS later (`content.ts` is query-shaped).
