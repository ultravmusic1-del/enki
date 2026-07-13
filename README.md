# Enki — the oracle for AI tools

A curated, human-vetted **AI tool review & directory** web app. Concept: **Enki**, the
Sumerian god of wisdom. Ancient oracle/clay-tablet gravitas fused with a sleek dark
AI-product UI. Tagline: **"Wisdom for the age of AI."**

## Getting started

Requires **Node 24.x** and **pnpm** (`npm install -g pnpm@latest`).

```bash
pnpm install     # install dependencies
pnpm dev         # dev server → http://localhost:3000 (Turbopack)
pnpm build       # production build (statically generates all pages)
pnpm start       # serve the production build
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest (unit tests)
pnpm test:e2e    # playwright (critical-flow E2E)
```

## What's inside

- **Landing** — a GSAP "oracle" hero (radiating rays, glowing emblem, pointer + scroll
  parallax), featured tools, category grid, a "how we vet" trust section, and stats.
- **Directory** (`/tools`) — fuzzy search (Fuse.js), filters (category, pricing, rating,
  tags), sort, and URL-synced state; results grid with an empty state.
- **Tool detail** (`/tools/[slug]`) — overview + verdict, key features, pros/cons, an Embla
  screenshot carousel, rating distribution, authored reviews, a "write a review" modal
  (React Hook Form + Zod), and related tools.
- **Categories** (`/categories`, `/categories/[slug]`).
- **⌘K command palette**, dark/light themes, film grain + aurora atmosphere.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
shadcn/ui (Radix) · Motion for React · GSAP + ScrollTrigger · Embla · Fuse.js ·
next-themes · Sonner · Vitest + Playwright.

## Content & data

Content is **local, Sanity-shaped seed data**. Documents live in `src/data/*`, are validated
by Zod schemas in `src/lib/schemas.ts`, and are read through a GROQ-shaped access layer in
`src/lib/content.ts`. Swapping to a live Sanity dataset later means changing those functions —
not the pages. There are no required environment variables.

See [`handoff.md`](./handoff.md) for the full design language, data model, and build notes.

## Deploy

Deploy to [Vercel](https://vercel.com/new) (`vercel`, or connect the repo in the dashboard).
No env vars needed.
