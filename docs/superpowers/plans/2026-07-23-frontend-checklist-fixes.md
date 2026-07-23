# Front-End Checklist Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the high- and medium-priority gaps found in the Front-End Checklist review of Enki without regressing existing functionality or design.

**Architecture:** Enki is a Next.js 16 (App Router) / React 19 app. Changes are additive: security headers via `next.config.ts`, canonical URLs + a web manifest via Next metadata conventions, two new static legal pages, a11y affordances (skip link, global focus ring), and a careful `next/image` migration of the three raw `<img>` usages. No data-model or routing changes.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind v4, next/image, next/font, Vitest, Playwright.

**Verification adaptation:** This work is config/markup/metadata-heavy, not unit-logic-heavy, so per-task "tests" are the type checker, linter, existing Vitest + Playwright suites, `next build`, and **visual confirmation in the browser preview** for anything touching layout. Each task ends with an explicit verification gate and a commit. The existing e2e suite guards functional regressions; the browser preview guards design regressions.

**Global verification commands (run from repo root):**
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

---

## File Structure

**Create:**
- `next.config.ts` (replace stub) — security response headers.
- `src/app/manifest.ts` — Web App Manifest (installability, favicons).
- `src/app/apple-icon.png` — Apple touch icon (copied from `public/brand/logo.png`).
- `src/app/privacy/page.tsx` — Privacy Policy page.
- `src/app/terms/page.tsx` — Terms of Service page.

**Modify:**
- `src/app/layout.tsx` — skip-to-content link + canonical for the home/default.
- `src/app/globals.css` — global `:focus-visible` fallback + skip-link styles.
- `src/app/page.tsx` — home canonical metadata.
- `src/app/tools/page.tsx`, `src/app/categories/page.tsx`, `src/app/compare/page.tsx`, `src/app/leaderboards/page.tsx`, `src/app/login/page.tsx`, `src/app/saved/page.tsx` — static-page canonicals.
- `src/app/tools/[slug]/page.tsx`, `src/app/categories/[slug]/page.tsx` — dynamic-page canonicals.
- `src/components/layout/site-footer.tsx` — Privacy/Terms links.
- `src/components/auth/login-form.tsx` — fix dangling "you agree to…" link to point at `/terms`.
- `src/components/shared/tool-logo.tsx` — `next/image`.
- `src/components/detail/screenshot-carousel.tsx` — `next/image` (fill).
- `src/components/home/featured-tool-card.tsx` — `next/image` + real `alt`.
- `src/components/detail/screenshot-carousel.tsx` — pause autoplay under reduced motion (same file, separate task).

---

## Task 1: Security response headers

**Files:**
- Modify: `next.config.ts`

Adds the safe, non-breaking security headers (nosniff, frame-options, referrer, HSTS, permissions-policy). A full Content-Security-Policy is intentionally **deferred** — Three.js, GSAP, inline styles, and Vercel Analytics need a nonce-based policy that must be validated separately, and a wrong CSP silently breaks the 3D hero.

- [ ] **Step 1: Replace `next.config.ts`**

```ts
import type { NextConfig } from "next";

// Applied to every route. A nonce-based Content-Security-Policy is deliberately
// omitted here: the 3D hero (three.js/GSAP) and Vercel Analytics need a
// validated policy, tracked as a separate follow-up.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build accepts the config**

Run: `npm run build`
Expected: build completes; no config schema error.

- [ ] **Step 3: Verify headers are emitted (after `npm run build` + dev preview in later verification phase)**

Deferred to the final verification phase (headers are only observable at runtime). Note here that it must be checked.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add baseline security response headers"
```

---

## Task 2: Canonical URLs on all pages

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/tools/page.tsx`, `src/app/categories/page.tsx`, `src/app/compare/page.tsx`, `src/app/leaderboards/page.tsx`, `src/app/login/page.tsx`, `src/app/saved/page.tsx`, `src/app/tools/[slug]/page.tsx`, `src/app/categories/[slug]/page.tsx`

`metadataBase` is already set in the layout, so relative canonical paths resolve to absolute URLs automatically. Do **not** set a canonical in the layout (it would become a wrong default for every child); set it per page.

- [ ] **Step 1: Home — add metadata export to `src/app/page.tsx`**

Add after the imports (top-level, before `const vetSteps`):

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};
```

- [ ] **Step 2: Static pages — add `alternates.canonical` to each existing `metadata` object**

In each file, add the `alternates` key to the existing `export const metadata` object using the page's own path:

- `src/app/tools/page.tsx` → `alternates: { canonical: "/tools" },`
- `src/app/categories/page.tsx` → `alternates: { canonical: "/categories" },`
- `src/app/compare/page.tsx` → `alternates: { canonical: "/compare" },`
- `src/app/leaderboards/page.tsx` → `alternates: { canonical: "/leaderboards" },`
- `src/app/login/page.tsx` → `alternates: { canonical: "/login" },`
- `src/app/saved/page.tsx` → `alternates: { canonical: "/saved" },`

- [ ] **Step 3: Dynamic tool page — `src/app/tools/[slug]/page.tsx`**

In the returned object of `generateMetadata` (the success branch, currently starting `return { title: ...`), add:

```ts
    alternates: { canonical: `/tools/${tool.slug}` },
```

- [ ] **Step 4: Dynamic category page — `src/app/categories/[slug]/page.tsx`**

Read the file first to find its `generateMetadata` success branch, then add to the returned metadata object:

```ts
    alternates: { canonical: `/categories/${slug}` },
```

(Use whatever the slug variable is named in that file — align to the existing code.)

- [ ] **Step 5: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS, no errors.

- [ ] **Step 6: Verify canonical renders**

Deferred to final verification phase: load `/` and `/tools/<slug>` in preview, confirm `<link rel="canonical" href="https://enki.tools/...">` in the DOM head.

- [ ] **Step 7: Commit**

```bash
git add src/app
git commit -m "feat(seo): set canonical URLs on all pages"
```

---

## Task 3: Web App Manifest + Apple touch icon

**Files:**
- Create: `src/app/manifest.ts`
- Create: `src/app/apple-icon.png` (copy of `public/brand/logo.png`)

- [ ] **Step 1: Copy the brand logo as the Apple touch icon**

Run (bash):
```bash
cp public/brand/logo.png src/app/apple-icon.png
```
Expected: file exists at `src/app/apple-icon.png`. Next auto-serves it as `<link rel="apple-touch-icon">`.

- [ ] **Step 2: Create `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} · ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#16191d",
    theme_color: "#16191d",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
```

Note: `/apple-icon.png` is served by Next from the `src/app/apple-icon.png` file convention; declaring `sizes: "512x512"` is a hint and does not require the source to be exactly that size.

- [ ] **Step 3: Verify build generates the manifest route**

Run: `npm run build`
Expected: build output lists `/manifest.webmanifest` (and `/apple-icon`) among generated routes.

- [ ] **Step 4: Commit**

```bash
git add src/app/manifest.ts src/app/apple-icon.png
git commit -m "feat(pwa): add web app manifest and apple touch icon"
```

---

## Task 4: Privacy & Terms pages + footer/login links

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Modify: `src/components/layout/site-footer.tsx`
- Modify: `src/components/auth/login-form.tsx`

Enki is described in-product as "in preview"; the copy reflects that honestly (a genuine, minimal policy — not fabricated legal guarantees).

- [ ] **Step 1: Create a shared legal-page layout inline — `src/app/privacy/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} handles your data.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Container className="prose-legal pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Legal
          </p>
          <h1 className="font-display text-4xl font-semibold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Enki is in preview. This policy describes our current practices and
            may change as the product matures.
          </p>
        </header>

        <section className="flex flex-col gap-3 text-pretty text-muted-foreground">
          <h2 className="font-display text-xl font-semibold text-foreground">
            What we collect
          </h2>
          <p>
            If you create an account we store the email address and optional
            display name you provide, and the tools you save or review. Anonymous,
            cookieless usage analytics are collected via Vercel Analytics to help
            us improve the site.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            How we use it
          </h2>
          <p>
            To operate your account, attribute your reviews, sync your saved
            tools across devices, and understand aggregate usage. We do not sell
            your personal data.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            Your choices
          </h2>
          <p>
            You can request deletion of your account and associated data at any
            time by contacting us at{" "}
            <a className="text-teal hover:underline" href="mailto:hello@enki.tools">
              hello@enki.tools
            </a>
            . Newsletter subscriptions can be cancelled at any time.
          </p>
        </section>
      </div>
    </Container>
  );
}
```

- [ ] **Step 2: Create `src/app/terms/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for using ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Legal
          </p>
          <h1 className="font-display text-4xl font-semibold">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Enki is in preview and provided on an “as is” basis.
          </p>
        </header>

        <section className="flex flex-col gap-3 text-pretty text-muted-foreground">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Using Enki
          </h2>
          <p>
            Enki is a curated directory of AI tools. Editorial scores and reviews
            are our opinion and provided for information only. Verify pricing and
            capabilities on each tool’s own site before relying on them.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            Your contributions
          </h2>
          <p>
            You are responsible for the reviews and content you submit, and you
            grant us a licence to display them on the site. Keep contributions
            lawful and respectful.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            Liability
          </h2>
          <p>
            To the fullest extent permitted by law, Enki is not liable for
            decisions made based on content on this site. Questions?{" "}
            <a className="text-teal hover:underline" href="mailto:hello@enki.tools">
              hello@enki.tools
            </a>
            .
          </p>
        </section>
      </div>
    </Container>
  );
}
```

- [ ] **Step 3: Add legal links to the footer — `src/components/layout/site-footer.tsx`**

In the bottom bar, wrap the copyright line so Privacy + Terms sit beside it. Replace the `© {2026} Enki…` `<p>` block with:

```tsx
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <p className="text-xs text-muted-foreground">
              © {2026} Enki. Wisdom for the age of AI.
            </p>
            <nav aria-label="Legal" className="flex items-center gap-4">
              <Link
                href="/privacy"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
            </nav>
          </div>
```

(`Link` is already imported in this file.)

- [ ] **Step 4: Fix the dangling agreement link — `src/components/auth/login-form.tsx`**

Replace the closing paragraph (currently "By continuing you agree to browse responsibly. Enki is in preview. … Back home") with a version that links to the real pages:

```tsx
      <p className="mt-5 text-center text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-teal hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-teal hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
```

(`Link` is already imported in this file.)

- [ ] **Step 5: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/privacy src/app/terms src/components/layout/site-footer.tsx src/components/auth/login-form.tsx
git commit -m "feat(legal): add privacy and terms pages with footer + login links"
```

---

## Task 5: Skip-to-content link + global focus-visible fallback

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Add the skip link and a `#main-content` target — `src/app/layout.tsx`**

Directly inside `<body …>`, before `<JsonLd …/>`, add:

```tsx
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
```

Then add `id="main-content"` and make the main focusable-on-jump by adding `tabIndex={-1}` to the existing `<main …>`:

```tsx
              <main
                id="main-content"
                tabIndex={-1}
                className="relative z-10 flex min-h-screen flex-col"
              >
```

- [ ] **Step 2: Add skip-link + global focus styles — `src/app/globals.css`**

Append near the top-level layer styles (after the base layer; place at end of file is fine):

```css
/* =========================================================================
   Accessibility affordances — skip link + a universal keyboard focus ring
   ========================================================================= */
.skip-link {
  position: fixed;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 100;
  transform: translateY(-150%);
  border-radius: 0.5rem;
  background: var(--brand-teal, #2dd4bf);
  color: #04171a;
  padding: 0.5rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  transition: transform 0.15s ease;
}
.skip-link:focus {
  transform: translateY(0);
  outline: none;
}

/* Universal keyboard focus indicator for anything that doesn't set its own. */
:where(a, button, [role="button"], input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-radius: 2px;
}
/* main receives focus only programmatically via the skip link — don't ring it. */
main:focus,
main:focus-visible {
  outline: none;
}
```

Note: confirm `--ring` and `--brand-teal` exist in `globals.css` (they are used elsewhere: `--ring` in `.dim:focus-visible`, `--brand-teal` in score gradient). If `--brand-teal` is not a bare var, use the same reference the score dial uses.

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Verify behavior**

Deferred to final verification phase: in preview, press Tab from page top → skip link appears; Enter → focus jumps to main. Tab through tool-page action buttons → visible focus ring on each.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(a11y): add skip-to-content link and global focus-visible ring"
```

---

## Task 6: Migrate `next/image` — screenshot carousel

**Files:**
- Modify: `src/components/detail/screenshot-carousel.tsx`

The parent is already `relative aspect-[16/10]`, so `fill` is a drop-in that preserves the exact box. This is the largest image payload → the biggest optimization win.

- [ ] **Step 1: Import next/image**

At the top of the file, add:
```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace the `<img>` in the `Screen` component**

Replace the eslint-disabled `<img …>` block (the one guarded by `if (shot.src)`) with:

```tsx
        <Image
          src={shot.src}
          alt={shot.title}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          loading="lazy"
          className="object-cover object-top"
        />
```

Remove the now-unnecessary `{/* eslint-disable-next-line @next/next/no-img-element */}` comment above it.

- [ ] **Step 3: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (the `no-img-element` disable is no longer needed and its removal must not trip `eslint-comments/no-unused-disable` — if lint flags the comment as unused, that confirms it was removed correctly).

- [ ] **Step 4: Visual check (final verification phase)**

Load a tool detail page; the screenshot carousel must look identical (16:10, cover, top-aligned) and still autoplay/navigate.

- [ ] **Step 5: Commit**

```bash
git add src/components/detail/screenshot-carousel.tsx
git commit -m "perf(images): serve tool screenshots via next/image"
```

---

## Task 7: Migrate `next/image` — tool logo

**Files:**
- Modify: `src/components/shared/tool-logo.tsx`

The chip `<span>` fixes the box size (size-9/12/16) with padding; the image fills it via `object-contain`. Use explicit `width`/`height` (equal, matching the largest chip) so Next has intrinsic dimensions while CSS `size-full` drives the actual fit. This avoids `fill` positioning inside the padded grid cell.

- [ ] **Step 1: Import next/image**

```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace the `<img>` and drop the eslint disable**

Replace:
```tsx
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={`${name} logo`}
        loading="lazy"
        className="size-full object-contain"
      />
```
with:
```tsx
      <Image
        src={logo}
        alt={`${name} logo`}
        width={64}
        height={64}
        loading="lazy"
        className="size-full object-contain"
      />
```

- [ ] **Step 3: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Visual check (final verification phase)**

Logos on the directory, tool cards, and tool detail hero must render identically on their white chips (contained, centered, not stretched).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/tool-logo.tsx
git commit -m "perf(images): serve tool logos via next/image"
```

---

## Task 8: Migrate `next/image` — featured tool card + fix alt

**Files:**
- Modify: `src/components/home/featured-tool-card.tsx`

`.dim__logo img` CSS already forces `width/height:100%; object-fit:contain`, and that selector matches the `<img>` next/image renders. Provide explicit `width`/`height` (68, the box size) and a real `alt`.

- [ ] **Step 1: Import next/image**

```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace the `<img>` and drop the eslint disable**

Replace:
```tsx
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tool.logo} alt="" />
```
with:
```tsx
              <Image
                src={tool.logo}
                alt={`${tool.name} logo`}
                width={68}
                height={68}
              />
```

- [ ] **Step 3: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Visual check (final verification phase)**

On the home page, the featured cards' logo chips must render identically (white chip, contained logo) with the 3D hover tilt intact.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/featured-tool-card.tsx
git commit -m "perf(images): serve featured-card logo via next/image and add alt text"
```

---

## Task 9: Respect reduced motion in the screenshot carousel autoplay

**Files:**
- Modify: `src/components/detail/screenshot-carousel.tsx`

Embla autoplay animates moving content; users who prefer reduced motion should not get autoplay. Gate the Autoplay plugin behind a `prefers-reduced-motion` check evaluated on the client.

- [ ] **Step 1: Compute a reduced-motion flag and conditionally enable Autoplay**

At the top of the `ScreenshotCarousel` component body, before `useEmblaCarousel`, add:

```tsx
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Change the `useEmblaCarousel` plugins argument from always-on Autoplay to:

```tsx
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    prefersReducedMotion
      ? []
      : [Autoplay({ delay: 4800, stopOnInteraction: true, stopOnMouseEnter: true })],
  );
```

Rationale: this is a client component (`"use client"`), so `window` is available at render on the client; the SSR pass yields `[]` (no autoplay), and hydration on a reduced-motion machine matches. On non-reduced-motion clients autoplay engages after hydration — acceptable and non-visual-breaking. Manual prev/next/dots remain fully functional either way.

- [ ] **Step 2: Verify types + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/detail/screenshot-carousel.tsx
git commit -m "a11y: disable screenshot autoplay under prefers-reduced-motion"
```

---

## Final Verification Phase

Run every gate and record the result. Do not claim success without the output.

- [ ] **V1: Static gates**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
Expected: all PASS. Capture the build route list (confirm `/manifest.webmanifest`, `/apple-icon`, `/privacy`, `/terms` appear).

- [ ] **V2: E2E suite (functional regression guard)**

```bash
npm run test:e2e
```
Expected: PASS (or same baseline as before the change — if e2e requires env/services not present locally, note that and rely on V1 + manual preview).

- [ ] **V3: Browser preview — design + behavior**

Start the dev server via the preview tool and verify, capturing a screenshot of each:
1. Home `/` — featured-card logos render correctly; 3D hero + hover tilt intact.
2. A tool detail page `/tools/<slug>` — logo chip + screenshot carousel look identical; carousel navigates.
3. Footer — Privacy/Terms links present and navigate to the new pages.
4. `/privacy` and `/terms` render with correct styling.
5. 404 page unaffected.
6. Keyboard: Tab from top → skip link appears and works; focus rings visible on interactive elements.

- [ ] **V4: Runtime headers + head tags**

In preview, via network/DOM inspection:
- Response headers include `x-content-type-options: nosniff`, `x-frame-options`, `referrer-policy`, `strict-transport-security`, `permissions-policy`.
- `<link rel="canonical">` present on `/` and `/tools/<slug>`.
- `<link rel="manifest">` and `<link rel="apple-touch-icon">` present.

- [ ] **V5: Summarize**

Report what passed, any deviations, and confirm no design regression against the screenshots.

---

## Self-Review

- **Spec coverage:** Security headers (T1), canonicals (T2), manifest+icons (T3), privacy/terms+links (T4), skip link+focus (T5), image migration ×3 (T6–T8), carousel reduced-motion (T9). The review's "verify console statements" item was resolved during planning — all three are correctly guarded — so no task is needed. Full CSP and `favicon.ico` raster fallback are explicitly deferred with reasons (T1 note; icon.svg + apple-icon cover modern + iOS). Animation-library consolidation is out of scope (invasive, not a checklist blocker).
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** canonical values are string literals; `alternates.canonical` is standard Next `Metadata`. `Image` imports are per-file. `siteConfig` fields used (`name`, `tagline`, `description`) all exist in `src/lib/site.ts`.
