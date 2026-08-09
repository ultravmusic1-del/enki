# design-sync notes — Enki

Repo-specific gotchas. Read this before any re-sync.

## What Enki is, for sync purposes

Enki is a **Next.js application, not a design-system package**. There is no `dist/`, no
`main`/`module`/`exports`, and `private: true`. The synced surface is a deliberately
narrow slice: the shadcn/Radix primitives under `src/components/ui/`, which are
self-contained (no Supabase, auth context, or Next routing) and therefore render
standalone. Feature components (tool cards, oracle hero, directory, header) are excluded
on purpose — they depend on app providers and data and would render broken.

- **`src/design-system.ts`** is the hand-written export surface. Adding a primitive there
  publishes it. It is not imported by the app.
- Project: `Enki Design System` — `5cf6f6b8-9f66-48f2-b774-9e26c57b06c5`

## Build invariants (each of these cost a debugging cycle)

- **`--entry ./src/design-system.ts` is required.** Without it the converter resolves
  `PKG_DIR` to `node_modules/enki`, which does not exist in the package's own repo, and
  dies in `dts.mjs` `projectFor` reading a missing `package.json`. With `--entry` it
  walks up to the nearest named `package.json` — the repo root — and everything resolves.
- **NEVER create a `node_modules/enki` self-link.** It was tried as an alternative to
  `--entry`. The src walk follows it into `node_modules/enki/node_modules/enki/…` and the
  build OOMs after ~120s. It would also confuse `pnpm install` and `next build`.
- **`--entry` disables synth-entry mode**, so `src/` discovery never runs and the build
  reports `[ZERO_MATCH]` — 0 components. That is why `componentSrcMap` pins the 23
  families explicitly. Do not remove it expecting discovery to take over.
- **Real prop contracts require the emitted `.d.ts`.** Without them every component gets
  `[key: string]: unknown` and the design agent has no API to code against. `tsconfig.dts.json`
  emits declarations to `.design-sync/.cache/types/`, and `package.json` `types` points at
  them. Re-run `npx tsc -p tsconfig.dts.json` whenever `src/components/ui/` changes.

## Regenerate before every build (all live in gitignored `.cache/`)

`cfg.cssEntry` and `cfg.extraFonts` point at `.design-sync/.cache/`, which is **not
committed**. After a fresh clone, or any `pnpm build`, regenerate all three or the build
silently uses stale or missing assets:

```bash
pnpm build                                            # produces .next/static
cat .next/static/chunks/*.css > .design-sync/.cache/enki-compiled.css
mkdir -p .design-sync/.cache/fonts
cp .next/static/media/*.woff2 .next/static/media/*.otf .design-sync/.cache/fonts/
npx tsc -p tsconfig.dts.json                          # emits .cache/types
```

`src/app/globals.css` is Tailwind v4 **source** (`@import "tailwindcss"`), so it cannot be
`cssEntry` directly — it carries no utilities. The compiled chunks do, and the filenames
are build-hashed, hence the concatenate step.

## Provider: the dark-mode trap

`cfg.provider` is `DesignSystemRoot` (`src/lib/design-system-root.tsx`). It is **not
optional**. Enki is dark-only: token values live on `:root`, but the app also keeps
`class="dark"` on `<html>` so Tailwind `dark:` variant utilities resolve (Badge's
destructive variant among others). Without the wrapper, previews render on a white page
and silently lose every `dark:` rule — they look plausible and are wrong.

It also sets the font families by name rather than via next/font's `--font-*` variables,
because those are injected by a build-hashed class on `<html>` that does not exist outside
the Next app. The `@font-face` rules themselves ship, so the families resolve.

`DesignSystemRoot` is excluded from the component list (`componentSrcMap: null`) — it is
scaffolding, not a primitive.

## `guidelinesGlob` must stay `[]`

The default (`docs/*.md`) swept `docs/launch-readiness-audit-*.md` and
`docs/stack-evaluation-*.md` into `guidelines/`, which the design agent reads as **design
guidance**. A pre-launch checklist in that role is actively misleading. Enki has no design
guideline docs; keep it empty until it does.

## Authoring previews

Preview layout glue uses **inline styles, not Tailwind utilities**. Tailwind v4 scans
source files, so a utility that appears nowhere in `src/` is purged from the compiled CSS
and the preview renders unstyled. Component classes are safe (they are literal strings in
the component sources, including every cva variant); scaffolding classes you invent are
not.

## Known render warns

- Nothing recorded yet — only Button, Badge and Card have been authored and graded.

## Re-sync risks

- **`.cache/` is gitignored**, so compiled CSS, fonts and emitted types vanish on a fresh
  clone. The build will not fail loudly for all of these — regenerate per the block above
  before trusting a re-sync.
- **`package.json` `types` points into `.cache/`**, so on a fresh clone it dangles until
  the emit is re-run. Harmless to `next build` (metadata only) but it silently degrades
  the sync's prop contracts.
- **19 of 23 families are unauthored** and ship the floor card. Authoring them is
  incremental — authored files and grades carry forward.
- **99 of 102 components have no uploaded card** (only Button, Badge, Card were pushed).
  All 102 are importable from the bundle; only those three are documented to the agent.
- **`brand/logo-mask.png` is not in the bundle**, so the `.emblem` utility resolves to a
  missing mask and the Enki mark renders empty. Adding it needs a new upload plan that
  includes a `brand/**` write glob.
- The upload plan was approved for the incremental path but **close-out never ran** — the
  project is deliberately un-anchored (no `_ds_sync.json`), so the next sync re-verifies
  everything. That is the documented safe state, not a fault.
