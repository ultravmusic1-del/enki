# Enki — Project Handoff

> A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**,
> the Sumerian god of wisdom — "the oracle for AI tools." Fuses ancient
> oracle/clay-tablet gravitas with sleek dark AI-product UI.
> Tagline: **"Wisdom for the age of AI."**

This document is everything needed to continue the build on another device. Read it
top-to-bottom before writing code.

---

## 1. Current status (as of this handoff)

The project is **complete through the planned MVP**. All six tasks are done and verified.

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold Next.js 16 app + install all dependencies | ✅ Done |
| 2 | Design system: fonts, tokens, theme, atmosphere | ✅ Done |
| 3 | Data layer + seed content (Sanity-shaped) | ✅ Done |
| 4 | Shared chrome (header/footer/⌘K) + landing page | ✅ Done |
| 5 | Directory, tool-detail, category pages | ✅ Done |
| 6 | Motion polish, tests (Vitest + Playwright), browser verification | ✅ Done |

**Verified working:** clean `pnpm build` (40 static pages: 27 tool pages + 8 category pages
+ core routes), `pnpm typecheck`, `pnpm lint`, and `pnpm test` (31 unit tests) all pass.
Driven in a browser in both dark and light themes with zero console errors: landing (GSAP
oracle hero), directory (search + filters + URL sync), tool detail (carousel, rating
distribution, review modal validation), categories, and ⌘K command palette.

**What was built on top of the foundation:**
- `src/lib/schemas.ts` — Zod schemas mirroring Sanity documents.
- `src/data/*` — 27 tools, 8 categories, 6 authors, 27 authored reviews.
- `src/lib/content.ts` — GROQ-shaped access layer with load-time validation, referential
  integrity checks, deterministic rating-distribution synthesis, and search docs.
- `src/lib/filters.ts` — pure, tested filter/sort helpers.
- Full page set under `src/app/` and components under `src/components/{shared,layout,home,directory,detail}`.

**To deploy:** the user runs `vercel` (or connects the repo in the Vercel dashboard) — deploy
needs their Vercel auth. No env vars are required; content is local seed data.

---

## 2. The brief & locked decisions

Original brief: build a high-quality AI-tool review/directory app called **Enki**, using
the provided brand logo, Cardot font, and palette `#222831 #393E46 #00ADB5 #EEEEEE`,
with one UI reference (`brand/inspiration.png` — the EQTY Lab "Verify to Trust AI" dark
hero). Mandated stack is in §3.

Decisions confirmed with the user (all "recommended" options):

1. **Content data → Local seed, Sanity-shaped.** Typed TS/Zod seed data modeled on a real
   Sanity schema, read through a data-access layer whose function signatures mirror GROQ.
   App is fully self-contained/demo-reliable; swapping to live Sanity later is a config
   change, not a rewrite. (Do **not** provision live Sanity — OAuth isn't reachable here.)
2. **Scope → Deep core directory.** Landing, browse+filter+fuzzy-search directory, rich
   tool-detail pages with reviews/ratings, categories. Depth over breadth. (No submit-a-tool
   form / compare / blog for MVP.)
3. **Motion → High craft, focused.** One or two hero-grade GSAP/ScrollTrigger set-pieces
   + tasteful Motion micro-interactions everywhere. Polished, not gratuitous.
4. **Delivery → Runnable locally + verified.** Build clean, run on localhost, drive in a
   browser to verify. User deploys to Vercel themselves (deploy needs their Vercel auth).

---

## 3. Tech stack (mandated)

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Node.js 24.x | `v24.13.1` on the original machine |
| Package manager | **pnpm** `11.12.0` | see §5 for install gotchas |
| Framework | **Next.js 16.2.10**, App Router | Turbopack dev |
| UI runtime | **React 19.2.4** | |
| Language | **TypeScript**, strict | |
| Styling | **Tailwind CSS v4** | CSS-first config in `globals.css`, no `tailwind.config` |
| Design system | **shadcn/ui, Radix preset** (`radix-nova` style) | uses unified `radix-ui` pkg + `lucide` icons |
| Icons | **lucide-react** `^1.24.0` | note: this is a 1.x major |
| Main animation | **Motion for React** (`motion` `^12`) | import from `motion/react` |
| Advanced animation | **GSAP + ScrollTrigger** `^3.15` | use selectively (hero) |
| Decorative | **Magic UI** | copy-in components, use sparingly (featured cards only) |
| Carousels | **Embla** (`embla-carousel-react` + `-autoplay`) | tool-detail screenshots |
| CMS | **Sanity** | **NOT wired** — seed data is Sanity-shaped for later swap |
| Search | **Fuse.js** `^7`, dynamically imported | directory fuzzy search |
| Forms | **React Hook Form + Zod** | review modal + newsletter (client-only, toast success) |
| Theme | **next-themes** | dark default, light option |
| Notifications | **Sonner** | `<Toaster/>` already mounted in layout |
| Analytics | **Vercel Web Analytics + Speed Insights** | already mounted in layout |
| Testing | **Vitest + Playwright** | scripts in package.json, configs not yet created |
| Hosting | **Vercel** | user deploys |

All of the above are already installed (see `package.json`). Additional dev dep: `pngjs`
(used once by the logo-mask script; can stay as devDep).

---

## 4. How to run

```bash
# from repo root
pnpm install          # installs; builds sharp/unrs-resolver natively (see §5)
pnpm dev              # http://localhost:3000  (Turbopack)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run   (no tests written yet)
pnpm test:e2e         # playwright   (no tests/config yet)
pnpm lint             # eslint
```

Node 24 + pnpm required. If `pnpm` is missing: `npm install -g pnpm@latest` (see §5).

---

## 5. Environment gotchas (IMPORTANT — these cost real time)

These were all solved on the original machine; a fresh clone should mostly "just work"
because the fixes are committed (`.npmrc`, `pnpm-workspace.yaml`). But know them:

1. **pnpm install / dev exits code 1 on "Ignored build scripts."** pnpm 11 now *errors*
   (not warns) on undecided native build scripts (`sharp`, `unrs-resolver`). Fixed by
   `pnpm-workspace.yaml` listing them under both `allowBuilds: {name: true}` and
   `onlyBuiltDependencies:`. If it recurs, run `pnpm approve-builds` or re-add those keys.
2. **`pnpm dev` re-runs install every start** (pnpm's `verifyDepsBeforeRun`) and that
   install can trip #1. Disabled via **`.npmrc` → `verify-deps-before-run=false`** (committed).
3. **`sharp` is an optional transitive dep of Next** for prod image optimization. It builds
   natively via the allowlist above. If it fails to build, Next falls back gracefully — not
   fatal for dev/demo.
4. **shadcn CLI under pnpm** hits a `zod` ESM resolution bug via `pnpm dlx`. Workaround: run
   it with **`npx`** instead, e.g.
   `npx shadcn@latest add <component> -y`. Also: `shadcn init` needs
   `-b radix -p nova -t next -y --no-monorepo` (the `-b`/`--base` is the *design-system base*
   = `radix`, the `-p`/`--preset` color theme = `nova`; the "base color" is separate).
5. **shadcn CLI aborts mid-run** on the same build-warning exit code, sometimes skipping
   `src/lib/utils.ts` and the theme injection into `globals.css`. Both were written by hand
   (they're committed). If you `shadcn add` more components and `cn` goes missing, it's this.
6. **pnpm install must be activated** on a bare machine: Node ships `corepack`; the reliable
   path used here was `npm install -g pnpm@latest` (corepack's `enable` needs admin to write
   into `C:\Program Files\nodejs`).

---

## 6. Design language (the soul of the app)

**Concept:** Enki as the oracle of wisdom for the AI era. Ancient-meets-AI. Every tool is
"vetted" — the inspiration's "Verify to Trust" ethos maps onto reviews + ratings.

**Palette** (brand → layered):
- `#16191D` void (deepest bg) · `#222831` surface · `#393E46` slate (elevated/border)
- `#00ADB5` teal (the single accent — glow, rays, links, ratings) · `#35E4EC` bright teal
- `#EEEEEE` mist (text)
- Dark is the **default/primary** theme; light is a supported secondary.

**Typography** (all wired in `src/lib/fonts.ts`):
- **Display / headings → Cardot** (local `.otf`, weights 400/600, in `src/fonts/`). Brand face.
- **Body / UI → Hanken Grotesk** (Google). Deliberately *not* Inter/Roboto.
- **Mono / eyebrows / tags / ratings / metadata → IBM Plex Mono** (Google). Techno "verified" feel.
- Exposed as CSS vars `--font-display`, `--font-sans`, `--font-mono` and Tailwind
  `font-display` / `font-sans` / `font-mono`.

**Motifs:** the Enki mask emblem as a glowing hero "oracle"; radiating rays/8-point star
(the star is the favicon, `public/icon.svg`); glowing chip/circuit traces; **aurora/flow
curves** in teal (Enki = water/flow — replaces the inspiration's green light-streaks);
cards as **"tablets"**; subtle film grain.

**Chrome:** pill nav with border + backdrop-blur, ghost "Log In" + solid mist pill CTA
(mirrors inspiration), theme toggle, ⌘K command palette.

**Atmosphere utilities** (defined in `globals.css` as Tailwind v4 `@utility`):
- `.grain` — fixed full-bleed film-grain overlay (already mounted once in layout).
- `.text-glow` — teal text with glow. `.glass` — frosted panel. `.spotlight` — radial glow bg.
- `.emblem` — renders the Enki logo as a **tintable mask** (`background-color: currentColor`).
  Use `<span className="emblem" style={{color: 'var(--brand-teal)'}} />` at any size/color.
- `.ring-hairline` — subtle inset hairline border.
- Keyframes/animations: `--animate-aurora`, `-float`, `-shimmer`, `-pulse-ring`, `-marquee`.
- `prefers-reduced-motion` fully neutralizes animation (block at bottom of `globals.css`).

---

## 7. Brand assets & how they're processed

- `brand/logo.png` — original teal Enki mask, **1254×1254 RGB, NO alpha** (teal on solid
  black). `brand/inspiration.png` — the UI reference. `brand/cardot-font.zip` — the font.
  (`brand/` = untouched originals; also copied into `public/brand/`.)
- **`public/brand/logo-mask.png`** — generated **alpha mask** (white silhouette, alpha =
  source brightness, tight-cropped to 815×815). This is the important one: it lets the emblem
  be tinted any color and composite cleanly on any bg. Regenerate with:
  `node scripts/make-logo-mask.mjs` (script is committed; needs `pngjs`).
- **`public/icon.svg`** — favicon: teal 8-point star (from the emblem's brow) on a rounded
  void tile. Referenced in `layout.tsx` metadata.
- Fonts extracted to `src/fonts/` (Cardot regular + semibold, `.otf` used).
- **No real logos exist for the seeded tools.** Plan: render branded **monogram tiles**
  (first letter + a per-tool accent color stored in seed data). Screenshots on detail pages:
  generated gradient "screen" placeholders with captions (store a hue per screenshot).

---

## 8. Data model (Sanity-shaped) & remaining implementation plan

### Data model — mirror these as Sanity documents later
Author in `src/data/*.ts`, validate with Zod in `src/lib/schemas.ts`, resolve via
`src/lib/content.ts` (functions named like GROQ queries so a live-Sanity swap is trivial).

- **category**: `slug, name, description, tagline, icon` (lucide name string), `accent` (hex).
- **tool**: `slug, name, tagline, description, longDescription, website, categorySlug,
  tags[], pricing {model: free|freemium|paid|enterprise, startingPrice?, hasFreeTrial?, note?},
  pros[], cons[], keyFeatures[{title, description, icon}], integrations[], platforms[],
  accent (hex, for monogram), featured (bool), foundedYear, company,
  screenshots[{title, caption, hue}], verdict, editorScore (0–10),
  rating (number 1–5, one decimal), reviewCount (int)`.
  - `rating`/`reviewCount` are the canonical displayed aggregates (like a real directory).
- **author**: `id, name, role, accent`.
- **review**: `id, toolSlug, authorId, rating (1–5), title, body, date (ISO), helpful, verified`.
  - Author a handful of qualitative reviews per notable tool (not all 100s). For the
    star-**distribution** bars on detail pages, synthesize a plausible 5-bucket distribution
    deterministically from `rating` + `reviewCount` (helper in `content.ts`). Show the
    aggregate + distribution + the authored qualitative reviews.

**Content-layer functions** (`src/lib/content.ts`): `getAllTools`, `getToolBySlug`,
`getFeaturedTools`, `getCategories` (with `toolCount`), `getCategoryBySlug`,
`getToolsByCategory`, `getRelatedTools(tool, n)`, `getReviewsForTool`, `getStats` (totals),
`getSearchDocs` (lightweight docs for Fuse). Run Zod `safeParse` on seed at module load and
throw in dev on mismatch. Store `icon` as a **string**; map to imported Lucide icons via an
icon registry component (guards against `lucide-react` 1.x renames).

Seed volume target: **~24–30 tools across 6–8 categories** (e.g. Writing, Image, Coding,
Productivity, Video, Audio/Voice, Research, Marketing/Agents) so search/filter/detail feel alive.

### Task 4 — Chrome + landing
- `src/components/layout/`: `site-header` (pill nav, blur, theme toggle, CTA, ⌘K trigger),
  `site-footer`, `command-palette` (cmdk `command` component + Fuse over tools/categories).
- `src/app/page.tsx` (replace default): **GSAP oracle hero** (emblem + radiating rays draw-in,
  aurora curves, pointer parallax) → featured tools → categories grid → "How we vet" trust
  section (`#how-we-vet`) → stats band → CTA → footer. Motion scroll-reveals per section.
- Shared: `container`, `section-heading`/eyebrow, `tool-card` ("tablet"), `category-card`,
  `star-rating`, `pricing-badge`, `monogram` (tool logo tile), `aurora` bg component.

### Task 5 — Directory / detail / categories
- `/tools`: filter rail (category, pricing, min rating, tags) + **Fuse.js** fuzzy search
  (dynamic `import("fuse.js")`) + sort (rating/newest/name) + **URL-synced** state
  (searchParams) + responsive tablet grid + results count + empty state.
- `/tools/[slug]`: hero (monogram, name, aggregate rating, verdict, visit CTA), pros/cons,
  key features, pricing, **Embla** screenshot carousel, rating distribution bars, authored
  reviews, **"Write a review" modal** (RHF+Zod, client-only, Sonner success), related tools.
  Add `generateStaticParams` + `generateMetadata`.
- `/categories` (grid) and `/categories/[slug]` (category landing → filtered tools).

### Task 6 — Motion, tests, verify
- Motion micro-interactions (card hover-lift, staggered grids, filter transitions, rating
  bars fill on view); Magic UI border-beam/shimmer on **featured** cards only; reduced-motion
  fallbacks throughout.
- **Vitest** (`vitest.config.ts`, jsdom): data-layer resolution, rating aggregation +
  distribution helper, Fuse ranking, filter logic. **Playwright** (`playwright.config.ts`):
  critical flow search → filter → open detail.
- Clean `pnpm build` + `pnpm typecheck`; then drive the app in a browser to verify.

---

## 9. File map (what exists now)

```
src/
  app/
    layout.tsx        # fonts + ThemeProvider(dark default) + grain + Toaster + Analytics + metadata
    page.tsx          # ⚠ still default create-next-app page — REPLACE in Task 4
    globals.css       # ★ full Enki token system, both themes, atmosphere utilities, keyframes
  components/
    theme-provider.tsx
    ui/               # 23 shadcn Radix-preset primitives (button, card, dialog, command, ...)
  fonts/              # Cardot .otf/.ttf + info.txt
  lib/
    fonts.ts          # Cardot(local) + Hanken Grotesk + IBM Plex Mono → CSS vars
    site.ts           # siteConfig (name, tagline, description, url, nav, social)
    utils.ts          # cn()
scripts/make-logo-mask.mjs   # regenerates public/brand/logo-mask.png
public/brand/         # logo.png, logo-mask.png (tintable), inspiration.png
public/icon.svg       # favicon (8-point star)
components.json       # shadcn config (radix-nova, lucide, rsc, @/* aliases)
.npmrc                # verify-deps-before-run=false
pnpm-workspace.yaml   # allowBuilds/onlyBuiltDependencies for native builds
.claude/launch.json   # "enki-dev" dev-server config (port 3000)
```

Not yet created: `src/lib/schemas.ts`, `src/lib/content.ts`, `src/data/*`, all pages beyond
the default, `vitest.config.ts`, `playwright.config.ts`, tests.

---

## 10. Working conventions

- Follow the existing design tokens religiously — teal is the **only** accent; keep the
  dark-first, atmospheric, oracle-meets-AI voice. Avoid generic AI-slop aesthetics.
- Server Components by default; `"use client"` only where interactivity/motion needs it.
- Keep files focused and small; extract components with clear single purposes.
- Respect `prefers-reduced-motion` in every animation.
- The brainstorming/design was approved verbally; the frontend-design skill guidance
  (distinctive type, bold cohesive direction, atmosphere over flat color) is the north star.
