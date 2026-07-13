# Enki — Project Handoff

> A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**,
> the Sumerian god of wisdom, "the oracle for AI tools." Fuses ancient
> oracle/clay-tablet gravitas with a sleek dark AI-product UI.
> Tagline: **"Wisdom for the age of AI."**

This is the single source of truth for continuing work in a fresh session. Read
§1–§6 before touching code.

---

## 1. Current status

**The app is complete, polished, and shippable.** The original MVP (data layer,
chrome + landing, directory/detail/category pages, motion, tests) is done, and
several rounds of visual/UX polish have been layered on since.

**Verified green** (run these to confirm after any change):

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint (flat config; React Compiler rules are on — see §6)
pnpm test        # vitest — 31 unit tests
pnpm test:e2e    # playwright — 5 critical-flow tests (builds + serves first)
pnpm build       # 40 static pages (27 tool + 8 category + core routes)
```

Driven in the browser in **both dark and light themes** with zero console errors.

**Not yet done / left to the owner:**
- **Deploy** — run `vercel` or connect the repo in the Vercel dashboard (needs
  your Vercel auth). No env vars required; all content is local seed data.
- Optional future work — see §8.

Repo: `https://github.com/ultravmusic1-del/enki.git` (branch `main`).

---

## 2. How to run

Requires **Node 24.x** and **pnpm** (`npm install -g pnpm@latest` if missing).

```bash
pnpm install
pnpm dev          # http://localhost:3000  (Next 16 + Turbopack)
pnpm build        # production build
pnpm start        # serve the production build
pnpm typecheck | pnpm lint | pnpm test | pnpm test:e2e
```

`.claude/launch.json` defines the `enki-dev` server (port 3000) for tooling.

---

## 3. Tech stack (all installed; see `package.json`)

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
| Theme | **next-themes** (dark default, light secondary) |
| Toasts | **Sonner** (`<Toaster/>` mounted in layout) |
| Analytics | **Vercel Web Analytics + Speed Insights** (mounted in layout) |
| Tests | **Vitest** (jsdom) + **Playwright** |
| CMS | **Sanity** — NOT wired; seed data is Sanity-shaped for a later swap |
| Hosting | **Vercel** |

---

## 4. Architecture & file map

Server Components by default; `"use client"` only where interactivity/motion
needs it. `@/*` aliases `src/*`.

```
src/
  app/
    layout.tsx                 # fonts + ThemeProvider(dark) + grain + CommandMenuProvider
                               #   + SiteHeader + SiteFooter + Toaster + Analytics + metadata
    globals.css                # ★ ALL design tokens (both themes), atmosphere utilities,
                               #   liquid-nav, dimensional-card (.dim*), tagline pill, keyframes
    page.tsx                   # Home: OracleHero → featured → categories → how-we-vet(+stats) → CTA
    not-found.tsx              # branded 404
    tools/page.tsx             # /tools directory (Suspense-wrapped DirectoryExplorer)
    tools/[slug]/page.tsx      # tool detail — generateStaticParams + generateMetadata
    categories/page.tsx        # /categories grid
    categories/[slug]/page.tsx # category landing (filtered tools)
  components/
    ui/                        # shadcn Radix primitives (button, card, dialog, command, sheet, …)
    layout/                    # site-header (liquid-glass pill nav), site-footer (newsletter),
                               #   command-menu (⌘K + Fuse), theme-toggle
    home/                      # oracle-hero, oracle-model(+scene) [R3F], featured-tool-card,
                               #   category-tile   (featured/category use the .dim 3D "shape system")
    directory/                 # directory-explorer (search + filters + sort, URL-synced)
    detail/                    # screenshot-carousel (Embla), rating-distribution, review-list,
                               #   review-modal (RHF+Zod)
    shared/                    # container, section-heading, star-rating (inline SVG), monogram,
                               #   tool-logo, pricing-badge, aurora, reveal, border-beam,
                               #   tool-card, category-card, icon (registry)
    theme-provider.tsx
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
  logos/<slug>.png             # 27 real brand logos (see §5)
  brand/                       # logo.png, logo-mask.png (tintable), inspiration.png
  icon.svg                     # favicon (teal 8-point star)
scripts/make-logo-mask.mjs     # regenerates public/brand/logo-mask.png (needs pngjs)
```

---

## 5. Design language & key features

### Palette (dark-first; teal is the ONLY accent)
`#16191D` void · `#222831` surface · `#393E46` slate/border · **`#00ADB5` teal** ·
`#35E4EC` bright teal · `#EEEEEE` mist (text). All in `globals.css` as CSS vars
(`--brand-*`, `--glow`, semantic `--background`/`--card`/…). Tailwind exposes
`bg-teal`, `text-mist`, etc.

### Typography (`src/lib/fonts.ts`)
- **Cardot** (local `.otf`) — display/headings. The brand face (reads uppercase).
- **Hanken Grotesk** — body/UI. Deliberately not Inter/Roboto.
- **IBM Plex Mono** — eyebrows, tags, ratings, metadata ("verified" feel).
- CSS vars `--font-display` / `--font-sans` / `--font-mono`.

### Atmosphere utilities (in `globals.css`)
`.grain` (fixed film-grain), `.text-glow`, `.glass`, `.spotlight` (edge-anchored
radial — good inside cards, NOT full-bleed sections; sections use a centered
bloom instead), `.emblem` (tintable logo mask: `<span className="emblem"
style={{color:'var(--brand-teal)'}}/>`), `.ring-hairline`. Keyframes: aurora,
float, shimmer, pulse-ring, marquee, tagline-glint. `prefers-reduced-motion`
neutralizes animation globally (block at the bottom of `globals.css`).

### Signature pieces (where to find them)
- **3D oracle hero** — `home/oracle-hero.tsx` + `oracle-model.tsx` (lazy wrapper,
  `next/dynamic ssr:false`, static-emblem fallback, WebGL error boundary) +
  `oracle-model-scene.tsx` (R3F). A meshopt-optimized GLB of the Enki emblem,
  teal PBR material, **spring-physics mouse interaction** (the oracle "looks at"
  the cursor, idle drift, cursor-tracking rim light, emissive "awaken"). Render
  loop is driven by a manual rAF in `frameloop="demand"` mode and paused when the
  hero scrolls out of view. The GLB was reduced from **78 MB → 1.3 MB** (weld +
  simplify to ~200k tris + meshopt + tiny textures) via `@gltf-transform/cli`.
- **Liquid-glass nav** — `layout/site-header.tsx` + `.liquid-nav*` in globals.
  Frosted pill, cursor-following teal glare, springy pill that follows the active/
  hovered link.
- **Dimensional "shape system" cards** — `.dim*` classes in globals; used by
  `home/featured-tool-card.tsx` (logo on a white chip over a tinted depth-stack)
  and `home/category-tile.tsx` (faceted-glass variant). 3D tilt on hover.
- **Tool logos** — `shared/tool-logo.tsx`: real brand logo on a uniform white
  "chip", monogram fallback when `tool.logo` is absent. See §5-logos.
- **Command palette** — `layout/command-menu.tsx` (⌘K, lazy Fuse over tools +
  categories, centered dialog).
- **Directory** — `directory/directory-explorer.tsx`: Fuse fuzzy search + filter
  rail (category/pricing/rating/tags) + sort, all **URL-synced** to searchParams,
  mobile filters in a Sheet.
- **Tool detail** — `tools/[slug]/page.tsx`: hero identity → **Screenshots** →
  **Editor score** bar (Visit + Write-a-review CTAs) → Overview/verdict → key
  features → pros/cons → Reviews (distribution bars + authored reviews) → sidebar
  (at-a-glance/platforms/integrations) → related tools.

### Brand logos (`public/logos/<slug>.png`)
27 real brand icon marks were fetched by domain (Google's favicon service),
self-hosted, and shown on a consistent white chip (`shared/tool-logo.tsx`).
They are third-party trademarks used nominatively (standard for a directory).
To swap/upgrade one, drop a PNG at `public/logos/<slug>.png`; delete a file and
that tool falls back to its monogram. A couple of brands only expose a small
(32–48 px) favicon, so those are softer than the 256 px ones.

---

## 6. Data model, content layer & conventions

### Data model (mirror as Sanity documents later)
Author in `src/data/*.ts`, validate with Zod in `src/lib/schemas.ts`, resolve via
`src/lib/content.ts` (function names mirror GROQ so a live-Sanity swap is a config
change, not a rewrite).

- **category**: `slug, name, tagline, description, icon` (lucide name string),
  `accent` (hex).
- **tool**: `slug, logo?` (path under /public), `name, tagline, description,
  longDescription, website, categorySlug, tags[], pricing {model:
  free|freemium|paid|enterprise, startingPrice?, hasFreeTrial?, note?}, pros[],
  cons[], keyFeatures[{title, description, icon}], integrations[], platforms[],
  accent (hex, monogram fallback), featured (bool), foundedYear, company,
  screenshots[{title, caption, hue}], verdict, editorScore (0–10), rating (1–5,
  one decimal), reviewCount (int)`. `rating`/`reviewCount` are the canonical
  displayed aggregates.
- **author**: `id, name, role, accent`.
- **review**: `id, toolSlug, authorId, rating (1–5), title, body, date (ISO),
  helpful, verified`. Only a handful of authored reviews per notable tool; the
  5-bucket star **distribution** is synthesized deterministically from
  `rating` + `reviewCount` (`getRatingDistribution` in `content.ts`).

`content.ts` runs Zod `safeParse` + referential-integrity checks at module load
and throws loudly in dev on bad data.

### Conventions (keep these)
- **Teal is the only accent.** Dark-first, atmospheric, "oracle-meets-AI" voice.
  Avoid generic AI-slop aesthetics.
- **Respect `prefers-reduced-motion`** in every animation.
- **Icons are strings** in data → mapped to imported components via the registry
  in `shared/icon.tsx` (guards against lucide 1.x renames). Add new icons there.
- **No em-dashes in displayed copy** — the app's visible text uses commas/colons/
  periods/parentheses instead (title separators use a middot `·`). Keep it that
  way when writing new copy. (Code/CSS comments are exempt.)
- **React Compiler lint rules are active** (`react-hooks/*`): don't read/mutate
  refs during render, don't `setState` synchronously in an effect, don't mutate
  `useMemo` values. In R3F code, keep mutable state in `useRef` and assign
  materials/etc. in effects, not memos (see `oracle-model-scene.tsx` for the
  pattern).

---

## 7. Gotchas (these cost real time)

1. **Turbopack dev stale chunk/CSS bug (most common).** After editing
   `globals.css` (new classes silently dropped) or after rapid HMR on a file,
   the dev server can serve a **stale compiled chunk** — symptoms include
   styles not applying or phantom `ReferenceError: X is not defined` from an old
   version of a file. **Fix:** stop the dev server, `rm -rf .next`, restart. The
   production build is always correct, so verify against `pnpm build` /
   `pnpm start` when in doubt.
2. **pnpm native builds.** pnpm 11 *errors* on undecided native build scripts
   (`sharp`, `unrs-resolver`). Fixed by `pnpm-workspace.yaml` (allowBuilds +
   onlyBuiltDependencies) and `.npmrc` → `verify-deps-before-run=false` (both
   committed). If it recurs: `pnpm approve-builds`.
3. **Flaky/slow installs.** On a poor connection, large binaries (`next`, swc,
   three, playwright) can time out. Retry with low concurrency:
   `npm_config_network_concurrency=2 pnpm install`.
4. **Screenshots of the app in tooling.** The GPU-heavy hero (grain feTurbulence,
   blurs, WebGL model, 3D cards) can make automated screenshots time out or blank
   below the fold. It's a capture limitation, not a page bug — the DOM is fine.
5. **shadcn CLI under pnpm** hits a zod ESM bug via `pnpm dlx`; use `npx
   shadcn@latest add <c> -y` instead. (All needed primitives are already added.)

---

## 8. Ideas / possible next steps (none required)

- Deploy to Vercel; optionally buy/point a domain.
- Swap the local seed for a live Sanity dataset (reimplement `content.ts`
  functions against GROQ; the schema already matches).
- Submit-a-tool form, tool comparison, or a blog (all intentionally out of MVP).
- Upgrade any low-res brand logo (`public/logos/<slug>.png`).
- Real OG images per tool; sitemap/robots.

---

## 9. Brand assets

- `brand/` (and `public/brand/`) — untouched originals: `logo.png` (teal Enki
  mask, 1254×1254, no alpha), `inspiration.png` (the EQTY "Verify to Trust" dark
  hero reference).
- `public/brand/logo-mask.png` — generated tintable alpha mask powering `.emblem`.
  Regenerate: `node scripts/make-logo-mask.mjs`.
- `public/models/enki-model.glb` — the 3D emblem (see §5). Re-optimize a new
  source with `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt
  --texture-size 512 --simplify` (weld + simplify first for very high-poly input).
- `public/icon.svg` — favicon.
- Fonts in `src/fonts/` (Cardot).
