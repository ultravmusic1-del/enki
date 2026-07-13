# Enki — Project Handoff

> A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**,
> the Sumerian god of wisdom, "the oracle for AI tools." Fuses ancient
> oracle/clay-tablet gravitas with a sleek dark AI-product UI.
> Tagline: **"Wisdom for the age of AI."**

This is the single source of truth for continuing work in a fresh session. Read
§1 and §2 first, they cover the current state and the one open issue.

---

## 1. Current status

The MVP (data layer, chrome + landing, directory/detail/category pages, motion,
tests) is complete, and several rounds of visual/UX polish have been layered on.
As of the latest session the app is **dark-mode only** (light mode was removed,
see §8) and carries new tool-detail polish (score dial, route transitions,
softened section seams).

**The app is NOT deployed** — run `vercel` or connect the repo in the Vercel
dashboard (needs your Vercel auth). No env vars required; all content is local
seed data.

Repo: `https://github.com/ultravmusic1-del/enki.git` (branch `main`).

---

## 2. ⚠ Open issue — "light mode still shows" (READ THIS FIRST)

**Symptom (reported by the owner):** after the dark-only conversion, the site
still appears to render in light mode when viewed.

**What the code actually is:** the light theme has been fully removed and the app
is hardcoded to dark. This was verified in-session (see §8 for the exact checks):
`<html>` carries a static `class="dark"`, `:root` holds only the dark design
tokens, `color-scheme: dark` is set, every Tailwind `dark:` variant still
resolves, and there is no theme toggle or `next-themes` anywhere. There is no
code path left that produces a light render.

**Most likely cause of the symptom — stale compiled output, not the source.**
This project's Turbopack dev server has repeatedly served **stale CSS/JS chunks**
after edits this session (the classic bug documented in §7 — new `globals.css`
classes get silently dropped until the server is forced to recompile). On top of
that, a browser that already loaded the pre-conversion bundle can keep serving the
old `next-themes` script + light CSS from cache. Either one reproduces exactly
this "I removed light mode but still see it" symptom while the source is correct.

**How to confirm / resolve (do this before assuming a real bug):**

```bash
# 1. Stop every running dev server for this repo (there may be more than one).
# 2. Nuke the build cache and restart clean:
rm -rf .next
pnpm dev                       # or: pnpm build && pnpm start
# 3. Hard-refresh the browser (Ctrl/Cmd+Shift+R) to drop the cached bundle.
```

Then check in devtools: `document.documentElement.className` should contain
`dark`, and `getComputedStyle(document.documentElement).getPropertyValue('--background')`
should be `#16191d`. The **production build is always authoritative** — if
`pnpm build && pnpm start` renders dark, the source is correct and any remaining
light render is a stale-cache artifact.

**If it is still light after a clean rebuild + hard refresh**, then (and only
then) treat it as a real regression: grep for any lingering `next-themes`,
`.dark` class removal, `prefers-color-scheme`, or hardcoded light hex values, and
confirm `src/app/globals.css` `:root` contains the dark tokens (not light).

---

## 3. How to run

Requires **Node 24.x** and **pnpm** (`npm install -g pnpm@latest` if missing).

```bash
pnpm install
pnpm dev          # http://localhost:3000  (Next 16 + Turbopack)
pnpm build        # production build (authoritative — use to settle CSS doubts)
pnpm start        # serve the production build
pnpm typecheck | pnpm lint | pnpm test | pnpm test:e2e
```

`.claude/launch.json` defines the `enki-dev` server (port 3000) for tooling. If a
dev server from another session already holds port 3000, start on another port
(`pnpm dev --port 3005`) — Next only allows one dev server per project dir.

**Verified green** (run after any change):

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint (flat config; React Compiler rules on — see §6)
pnpm test        # vitest — unit tests
pnpm test:e2e    # playwright — critical-flow tests (builds + serves first)
pnpm build       # static pages (tool + category + core routes)
```

---

## 4. Tech stack (all installed; see `package.json`)

| Layer | Choice |
|-------|--------|
| Runtime / PM | Node **24.x**, **pnpm 11.12.0** |
| Framework | **Next.js 16.2.10**, App Router, **Turbopack** dev |
| UI | **React 19.2.4**, **TypeScript** (strict) |
| Styling | **Tailwind CSS v4** — CSS-first config in `src/app/globals.css` (no `tailwind.config`) |
| Components | **shadcn/ui**, Radix `radix-nova` preset (unified `radix-ui` pkg) in `src/components/ui/` |
| Icons | **lucide-react `^1.24.0`** (1.x major — resolve via the icon registry, see §6) |
| Motion | **Motion for React** (`motion` `^12`, import from `motion/react`) |
| Scroll/hero anim | **GSAP + ScrollTrigger** `^3.15` (+ a tiny `useGSAP` hook in `src/lib/use-gsap.ts`) |
| 3D | **three `^0.180`** + **@react-three/fiber `^9`** + **@react-three/drei `^10`** (hero model only) |
| Carousels | **Embla** (`embla-carousel-react` + `-autoplay`) |
| Search | **Fuse.js `^7`**, dynamically imported |
| Forms | **React Hook Form + Zod `^4`** (review modal + newsletter; client-only, toast success) |
| Theme | **Dark only.** `class="dark"` is hardcoded on `<html>`; no theme switching, no `next-themes` |
| Toasts | **Sonner** (`<Toaster/>` mounted in layout, `theme="dark"`) |
| Analytics | **Vercel Web Analytics + Speed Insights** (mounted in layout) |
| Tests | **Vitest** (jsdom) + **Playwright** |
| CMS | **Sanity** — NOT wired; seed data is Sanity-shaped for a later swap |
| Hosting | **Vercel** |

---

## 5. Architecture & file map

Server Components by default; `"use client"` only where interactivity/motion
needs it. `@/*` aliases `src/*`.

```
src/
  app/
    layout.tsx                 # fonts + hardcoded <html class="dark"> + grain
                               #   + CommandMenuProvider + SiteHeader + SiteFooter
                               #   + Toaster + Analytics + metadata (no ThemeProvider)
    template.tsx               # ★ route transition — remounts per navigation so the
                               #   `.page-transition` CSS animation replays (fade + lift)
    globals.css                # ★ ALL design tokens (dark only, on :root), atmosphere
                               #   utilities, liquid-nav, dimensional-card (.dim*), tagline
                               #   pill, score dial (.score-arc), page transition, keyframes
    page.tsx                   # Home: OracleHero → featured → categories → how-we-vet → CTA
    not-found.tsx              # branded 404
    tools/page.tsx             # /tools directory (Suspense-wrapped DirectoryExplorer)
    tools/[slug]/page.tsx      # tool detail — generateStaticParams + generateMetadata
    categories/page.tsx        # /categories grid
    categories/[slug]/page.tsx # category landing (filtered tools)
  components/
    ui/                        # shadcn Radix primitives (button, card, dialog, command, sheet, …)
    layout/                    # site-header (liquid-glass pill nav), site-footer (newsletter),
                               #   command-menu (⌘K + Fuse)      [no theme-toggle — removed]
    home/                      # oracle-hero, oracle-model(+scene) [R3F], featured-tool-card,
                               #   category-tile   (featured/category use the .dim 3D "shape system")
    directory/                 # directory-explorer (search + filters + sort, URL-synced)
    detail/                    # screenshot-carousel (Embla), rating-distribution, review-list,
                               #   review-modal (RHF+Zod; accepts triggerClassName)
    shared/                    # container, section-heading, star-rating, monogram, tool-logo,
                               #   pricing-badge, aurora, reveal, border-beam, tool-card,
                               #   category-card, icon (registry)
                               #   [no theme-provider — removed]
  data/                        # tools.ts (27), categories.ts (8), authors.ts (6), reviews.ts (27)
  lib/
    schemas.ts                 # Zod schemas (Sanity-shaped) + form schemas
    content.ts                 # GROQ-shaped access layer (validates seed at load, throws in dev)
    filters.ts                 # pure, tested filter/sort helpers  (+ content.test.ts, filters.test.ts)
    site.ts                    # siteConfig (name, tagline, nav, social)
    fonts.ts                   # Cardot(local) + Hanken Grotesk + IBM Plex Mono → CSS vars
    use-gsap.ts                # minimal scoped useGSAP hook
    utils.ts                   # cn()
  fonts/                       # Cardot .otf/.ttf
tests/e2e/directory.spec.ts    # Playwright critical flows
public/
  models/enki-model.glb        # optimized 3D Enki emblem (~1.3 MB, meshopt) — hero
  logos/<slug>.png             # 27 real brand logos (see §5-logos below)
  brand/                       # logo.png, logo-mask.png (tintable), inspiration.png
  icon.svg                     # favicon (teal 8-point star)
scripts/make-logo-mask.mjs     # regenerates public/brand/logo-mask.png (needs pngjs)
```

---

## 6. Design language & key features

### Palette (dark only; teal is the ONLY accent)
`#16191D` void · `#222831` surface · `#393E46` slate/border · **`#00ADB5` teal** ·
`#35E4EC` bright teal · `#EEEEEE` mist (text). All live on `:root` in
`globals.css` as CSS vars (`--brand-*`, `--glow`, semantic `--background`/`--card`/…).
Tailwind exposes `bg-teal`, `text-mist`, etc. There is no light theme — `:root`
holds the dark values directly, `color-scheme: dark` is set, and the `.dark`
class stays on `<html>` purely so Tailwind `dark:` variant utilities keep
resolving (button/dialog/sheet rely on them). Keep the class.

### Typography (`src/lib/fonts.ts`)
- **Cardot** (local `.otf`) — display/headings. The brand face (reads uppercase).
- **Hanken Grotesk** — body/UI. Deliberately not Inter/Roboto.
- **IBM Plex Mono** — eyebrows, tags, ratings, metadata ("verified" feel).
- CSS vars `--font-display` / `--font-sans` / `--font-mono`.

### Atmosphere utilities (in `globals.css`)
`.grain` (fixed film-grain), `.text-glow`, `.glass`, `.spotlight` (edge-anchored
radial — good inside cards, NOT full-bleed sections; sections use a centered
bloom instead), `.emblem` (tintable logo mask), `.ring-hairline`. Keyframes:
aurora, float, shimmer, pulse-ring, marquee, tagline-glint, **score-draw** (score
dial arc), **page-in** (route transition). `prefers-reduced-motion` neutralizes
animation globally (block at the bottom of `globals.css`).

### Signature pieces (where to find them)
- **3D oracle hero** — `home/oracle-hero.tsx` + `oracle-model*.tsx` (lazy R3F GLB,
  spring-physics mouse interaction, GSAP intro + scroll parallax).
- **Liquid-glass nav** — `layout/site-header.tsx` + `.liquid-nav*` in globals.
- **Dimensional "shape system" cards** — `.dim*` classes; `home/featured-tool-card.tsx`
  and `home/category-tile.tsx`. 3D tilt on hover.
- **Command palette** — `layout/command-menu.tsx` (⌘K, lazy Fuse).
- **Directory** — `directory/directory-explorer.tsx`: Fuse search + filter rail +
  sort, all URL-synced; mobile filters in a Sheet.
- **Tool detail** — `tools/[slug]/page.tsx`: hero identity → Screenshots → **editor
  score dial** → Overview/verdict → key features → pros/cons → Reviews → sidebar →
  related tools.

### Route transitions (`app/template.tsx` + `.page-transition` in globals)
Every client navigation fades + lifts its page in, reusing the `Reveal` easing so
navigation shares one motion language. `backwards` fill mode prevents a
first-paint flash and leaves NO resting transform (so sticky sidebars and the home
hero's ScrollTrigger parallax stay intact). Chrome (header, portaled dialogs/toasts)
lives outside the wrapper, so it stays stable during the transition.

### Brand logos (`public/logos/<slug>.png`)
27 real brand icon marks fetched by domain, self-hosted, shown on a consistent
white chip (`shared/tool-logo.tsx`). Third-party trademarks used nominatively. To
swap one, drop a PNG at `public/logos/<slug>.png`; delete a file and that tool
falls back to its monogram.

---

## 7. Data model, content layer & conventions

### Data model (mirror as Sanity documents later)
Author in `src/data/*.ts`, validate with Zod in `src/lib/schemas.ts`, resolve via
`src/lib/content.ts` (function names mirror GROQ so a live-Sanity swap is a config
change, not a rewrite).

- **category**: `slug, name, tagline, description, icon` (lucide name string), `accent`.
- **tool**: `slug, logo?, name, tagline, description, longDescription, website,
  categorySlug, tags[], pricing {model, startingPrice?, hasFreeTrial?, note?}, pros[],
  cons[], keyFeatures[{title, description, icon}], integrations[], platforms[],
  accent, featured, foundedYear, company, screenshots[{title, caption, hue}],
  verdict, editorScore (0–10), rating (1–5, one decimal), reviewCount (int)`.
- **author**: `id, name, role, accent`.
- **review**: `id, toolSlug, authorId, rating, title, body, date, helpful, verified`.
  The 5-bucket star distribution is synthesized deterministically from
  `rating` + `reviewCount` (`getRatingDistribution` in `content.ts`).

`content.ts` runs Zod `safeParse` + referential-integrity checks at module load
and throws loudly in dev on bad data.

### Conventions (keep these)
- **Teal is the only accent. Dark only.** Atmospheric, "oracle-meets-AI" voice.
  Avoid generic AI-slop aesthetics.
- **Respect `prefers-reduced-motion`** in every animation.
- **Keep `class="dark"` on `<html>`** — Tailwind `dark:` variants depend on it.
- **Icons are strings** in data → mapped via the registry in `shared/icon.tsx`
  (guards against lucide 1.x renames). Add new icons there.
- **No em-dashes in displayed copy** — use commas/colons/periods/parentheses; title
  separators use a middot `·`. (Code/CSS comments are exempt.)
- **React Compiler lint rules are active** (`react-hooks/*`): don't read/mutate refs
  during render, don't `setState` synchronously in an effect, don't mutate `useMemo`
  values. In R3F code keep mutable state in `useRef` and assign in effects.

---

## 8. Recent session changelog (uncommitted → this commit)

Work done in the latest session, in order:

1. **Editor score redesign** (`tools/[slug]/page.tsx`, `detail/review-modal.tsx`,
   `globals.css`) — replaced the flat progress-bar score widget with a radial
   **score dial** (SVG gradient ring, draws in via `.score-arc` / `score-draw`),
   a qualitative verdict word (Exceptional/Excellent/…), and matched-height pill
   CTAs (`ReviewModal` gained a `triggerClassName` prop). The "Visit <tool>"
   button no longer wraps.
2. **Route transitions** (`app/template.tsx`, `globals.css`) — added a site-wide
   fade+lift page transition (`.page-transition` / `page-in`, `backwards` fill).
3. **Softened hero seam** (`tools/[slug]/page.tsx`, `categories/[slug]/page.tsx`) —
   replaced the hard full-width `border-b` between the masthead and the first
   content section with a center-weighted hairline that fades to transparent at
   the edges.
4. **Removed light mode entirely** — the app is dark-only now:
   - `layout.tsx`: dropped `<ThemeProvider>`, hardcoded `<html class="dark">`,
     single dark `themeColor`.
   - `globals.css`: folded the dark tokens onto `:root`, deleted the light `:root`
     values and both `.dark` override blocks (semantic + liquid-nav), added
     `color-scheme: dark`. Kept `@custom-variant dark` + the `.dark` class so
     `dark:` utilities still resolve.
   - `ui/sonner.tsx`: hardcoded `theme="dark"`, removed `useTheme`.
   - `layout/site-header.tsx`: removed the `ThemeToggle`.
   - Deleted `components/theme-provider.tsx` and `components/layout/theme-toggle.tsx`.
   - Removed `next-themes` from `package.json` (lockfile synced).

   In-session verification of the dark-only conversion: `pnpm typecheck` + `pnpm
   lint` pass; `<html>` carries `dark`; `--background` resolves `#16191d`;
   `color-scheme: dark`; a real `dark:` utility (`dark:border-input`) still
   applies; the toggle is gone; home + detail render dark; no console errors.
   **Caveat:** verified against the running dev server's live-compiled output, not
   a fresh `pnpm build`, because a competing dev server held `.next`. See §2 — if
   the owner still sees light, it is almost certainly stale build cache / browser
   cache, resolved by a clean `rm -rf .next` rebuild + hard refresh.

---

## 9. Gotchas (these cost real time)

1. **Turbopack dev stale chunk/CSS bug (most common — and the likely cause of the
   §2 open issue).** After editing `globals.css` (new classes silently dropped) or
   after rapid HMR, the dev server can serve a **stale compiled chunk** — styles
   don't apply, or phantom `ReferenceError`s appear from an old file version. **Fix:**
   stop the dev server, `rm -rf .next`, restart. Re-saving the edited file a second
   time sometimes forces a recompile. The production build is always correct, so
   verify against `pnpm build` / `pnpm start` when in doubt.
2. **pnpm native builds.** pnpm 11 errors on undecided native build scripts
   (`sharp`, `unrs-resolver`). Fixed by `pnpm-workspace.yaml` + `.npmrc`. If it
   recurs: `pnpm approve-builds`.
3. **Flaky/slow installs.** On a poor connection, retry with low concurrency:
   `npm_config_network_concurrency=2 pnpm install`.
4. **Screenshots of the app in tooling.** The GPU-heavy hero can make automated
   screenshots time out or blank below the fold. It's a capture limitation, not a
   page bug.
5. **shadcn CLI under pnpm** hits a zod ESM bug via `pnpm dlx`; use `npx
   shadcn@latest add <c> -y` instead. (All needed primitives are already added.)
6. **One dev server per project dir.** `next dev` refuses to start a second server
   in the same folder. If port 3000 is taken by another session's server, either
   use it or `pnpm dev --port <n>`.

---

## 10. Ideas / possible next steps (none required)

- Confirm the §2 open issue is a stale-cache artifact via a clean `pnpm build`.
- Deploy to Vercel; optionally buy/point a domain.
- Swap the local seed for a live Sanity dataset (reimplement `content.ts` against
  GROQ; the schema already matches).
- Submit-a-tool form, tool comparison, or a blog (intentionally out of MVP).
- Real OG images per tool; sitemap/robots.

---

## 11. Brand assets

- `brand/` (and `public/brand/`) — untouched originals: `logo.png` (teal Enki mask),
  `inspiration.png` (the EQTY "Verify to Trust" reference).
- `public/brand/logo-mask.png` — generated tintable alpha mask powering `.emblem`.
  Regenerate: `node scripts/make-logo-mask.mjs`.
- `public/models/enki-model.glb` — the 3D emblem. Re-optimize with
  `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-size 512 --simplify`.
- `public/icon.svg` — favicon.
- Fonts in `src/fonts/` (Cardot).
