# SEO Domain Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `https://enkitools.com` the canonical origin in every machine-readable
surface the site emits, and retire `enki-five.vercel.app` as a competing copy.

**Architecture:** `siteConfig.url` is a single chokepoint consumed by six modules
(`layout.tsx`, `sitemap.ts`, `robots.ts`, `llms.txt/route.ts`, `structured-data.ts`,
`go/[slug]/route.ts`). Rewriting `resolveSiteUrl()` in `src/lib/site.ts` corrects all of
them without editing any consumer. A host-conditional 308 in `next.config.ts` retires the
old alias. The remaining changes are the Instagram `sameAs`, and documentation.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-29-seo-domain-migration-design.md`

**Operator prerequisite:** Task 2 deploys a redirect that breaks auth unless the Supabase
URL configuration is updated first. §Operator Checklist step 1 must be done before this
branch merges. Tasks 1–5 are safe to implement and commit in any case.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/lib/site.ts` | Modify | Canonical origin constant + resolution; social handles |
| `src/lib/site.test.ts` | Create | Locks the resolution order; the vercel.app regression guard |
| `next.config.ts` | Modify | 308 from the legacy Vercel host |
| `src/lib/structured-data.ts` | Modify | `sameAs` on Organization |
| `src/components/layout/site-footer.tsx` | Modify | Renders the single real social pill |
| `.env.example` | Modify | Documents the override, not a dead domain |
| `handoff.md` | Modify | Records the live domain and the new resolution order |

---

## Task 1: Canonical origin resolution

**Files:**
- Modify: `src/lib/site.ts:1-36` (the `resolveSiteUrl` block)
- Test: `src/lib/site.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/site.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { CANONICAL_SITE_URL, resolveSiteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSiteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL, without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.enkitools.com/");
    expect(resolveSiteUrl()).toBe("https://staging.enkitools.com");
  });

  it("gives a preview deployment its own origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "enki-git-branch.vercel.app");
    expect(resolveSiteUrl()).toBe("https://enki-git-branch.vercel.app");
  });

  it("falls back to localhost outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveSiteUrl()).toBe("http://localhost:3000");
  });

  // The regression this file exists for. Before this change a production build
  // with no NEXT_PUBLIC_SITE_URL resolved to enki-five.vercel.app, which made
  // every canonical, sitemap entry and JSON-LD id disown the real domain.
  it("never resolves a vercel.app origin in production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv(
      "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
      "enki-five.vercel.app",
    );
    expect(resolveSiteUrl()).toBe(CANONICAL_SITE_URL);
    expect(resolveSiteUrl()).not.toMatch(/vercel\.app$/);
  });

  it("pins the canonical domain", () => {
    expect(CANONICAL_SITE_URL).toBe("https://enkitools.com");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/lib/site.test.ts
```

Expected: FAIL — `CANONICAL_SITE_URL` and `resolveSiteUrl` are not exported from
`@/lib/site` (currently `resolveSiteUrl` is a module-private function).

- [ ] **Step 3: Rewrite the resolver**

Replace `src/lib/site.ts` lines 1–29 — the opening doc comment and the whole
`resolveSiteUrl` function, everything above the blank line preceding
`export const siteConfig = {` — with:

```ts
/**
 * The domain Enki owns and serves from.
 *
 * Committed rather than left to configuration on purpose. An unset
 * `NEXT_PUBLIC_SITE_URL` is exactly how every canonical, sitemap entry, robots
 * directive and JSON-LD `@id` came to point at the Vercel subdomain while the
 * site was already serving from this domain — telling search engines the real
 * page lived somewhere else. A production build is now correct with no
 * dashboard configuration at all.
 */
export const CANONICAL_SITE_URL = "https://enkitools.com";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * The site's canonical origin, with no trailing slash.
 *
 * This is not cosmetic: it backs every `<link rel="canonical">`, the sitemap,
 * robots.txt, `llms.txt`, the absolute OG/Twitter image URLs, all JSON-LD
 * identifiers, and the `/go/[slug]` fallback redirect.
 *
 * Order of preference:
 *  1. `NEXT_PUBLIC_SITE_URL` — an explicit override, e.g. a staging origin.
 *  2. Vercel preview deployments — their own origin, so a preview can never
 *     claim the production canonical.
 *  3. Any production build — the committed canonical above.
 *  4. Local development.
 *
 * Step 3 keys off `NODE_ENV`, not `VERCEL_ENV`, deliberately. This module is
 * imported by `site-footer.tsx`, a client component, so it is evaluated in the
 * browser bundle as well as on the server — and Next only inlines `NEXT_PUBLIC_*`
 * variables there. A bare `VERCEL_ENV` read would be `undefined` client-side and
 * resolve a different origin than the server did, which is a hydration mismatch.
 * `NODE_ENV` is inlined identically on both sides.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);

  // The NEXT_PUBLIC_ copies exist when "Automatically expose System Environment
  // Variables" is on (the default); the bare ones cover server-only rendering.
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (vercelEnv === "preview") {
    const previewHost =
      process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
    if (previewHost) return `https://${stripTrailingSlash(previewHost)}`;
  }

  if (process.env.NODE_ENV === "production") return CANONICAL_SITE_URL;

  return "http://localhost:3000";
}
```

Leave `export const siteConfig = { ... }` and everything below it untouched in this task —
it already reads `url: resolveSiteUrl()`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/lib/site.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Confirm no consumer needed editing**

```bash
pnpm typecheck
```

Expected: no errors. The six `siteConfig.url` consumers are unchanged by design.

- [ ] **Step 6: Commit**

```bash
git add src/lib/site.ts src/lib/site.test.ts
git commit -m "fix(seo): resolve the canonical origin to enkitools.com"
```

---

## Task 2: Retire the legacy Vercel host

**Files:**
- Modify: `next.config.ts:48-52` (the `nextConfig` object)

- [ ] **Step 1: Add the redirect**

In `next.config.ts`, add the import at the top of the file, directly under the existing
`import type { NextConfig } from "next";`:

```ts
import { CANONICAL_SITE_URL } from "./src/lib/site";
```

Then add this constant above `const nextConfig: NextConfig = {`:

```ts
/**
 * The project's original Vercel alias. It still serves a complete second copy of
 * every URL on the site, competing with enkitools.com for the same ranking
 * signal, so it is permanently redirected rather than left to be indexed.
 *
 * next.config redirects are evaluated before middleware, so a bounced request
 * never runs the Supabase session refresh in src/proxy.ts. The host condition
 * matches only this exact alias: preview deployments and localhost are
 * untouched, and no loop is possible because enkitools.com never matches it.
 */
const LEGACY_HOST = "enki-five.vercel.app";
```

And replace the `nextConfig` object with:

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: LEGACY_HOST }],
        destination: `${CANONICAL_SITE_URL}/:path*`,
        permanent: true,
      },
    ];
  },
};
```

- [ ] **Step 2: Verify the config loads and typechecks**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify Next accepts the redirect at build time**

```bash
pnpm build
```

Expected: build succeeds. An invalid `has` clause or malformed `destination` fails the
build here rather than in production. If the config loader rejects the relative import of
`./src/lib/site`, that surfaces at this step as a module-resolution error.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "fix(seo): 308 enki-five.vercel.app to the canonical domain"
```

---

## Task 3: Real social account and `sameAs`

**Files:**
- Modify: `src/lib/site.ts` (the `social` block, currently lines 59-63)
- Modify: `src/lib/structured-data.ts:14-25` (the Organization node)
- Modify: `src/components/layout/site-footer.tsx:27-31` (the `socialLinks` array)

- [ ] **Step 1: Replace the placeholder handles**

In `src/lib/site.ts`, replace:

```ts
  social: {
    twitter: "https://twitter.com",
    github: "https://github.com",
    linkedin: "https://linkedin.com",
  },
```

with:

```ts
  /**
   * Real, owned accounts only. These render as clickable links in the footer and
   * are asserted to search engines as `sameAs` on the Organization, so a
   * placeholder here is both a dead outbound link and a false entity claim.
   */
  social: {
    instagram: "https://www.instagram.com/enkitools.ai/",
  },
```

- [ ] **Step 2: Add `sameAs` to the Organization**

In `src/lib/structured-data.ts`, in the `siteJsonLd()` Organization node, add `sameAs`
immediately after the `logo` line so the block reads:

```ts
      {
        "@type": "Organization",
        "@id": `${BASE}/#organization`,
        name: siteConfig.name,
        url: BASE,
        description: siteConfig.description,
        logo: abs(siteConfig.ogImage),
        // Connects the entity to its verified profile. Only accounts Enki
        // actually controls belong here.
        sameAs: [siteConfig.social.instagram],
      },
```

- [ ] **Step 3: Render the single pill**

In `src/components/layout/site-footer.tsx`, replace the `socialLinks` array:

```ts
const socialLinks = [
  {
    name: "Instagram",
    href: siteConfig.social.instagram,
    icon: "ArrowUpRight",
  },
];
```

The `.map()` at line 174 and the surrounding `flex items-center gap-2` row need no change.
`ArrowUpRight` is kept because the icon registry in `src/components/shared/icon.tsx`
carries no brand glyphs; it also matches the existing pill treatment.

- [ ] **Step 4: Verify**

```bash
pnpm verify
```

Expected: typecheck, lint, and all tests pass.

- [ ] **Step 5: Visual sweep — required, this is a `.tsx` change**

Start the dev server via `preview_start` with `{ name: "enki-dev" }`, then:

```bash
pnpm sweep -- / /tools
```

Expected: every route/viewport pair reads PASS. The footer row drops from three pills to
one; the sweep confirms nothing overflows or escapes a clipping container at 390px and
1440px. Cite the output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/site.ts src/lib/structured-data.ts src/components/layout/site-footer.tsx
git commit -m "feat(seo): real Instagram link and Organization sameAs"
```

---

## Task 4: Documentation

**Files:**
- Modify: `.env.example:7-10`
- Modify: `handoff.md:71-74`, `handoff.md:92-104`

- [ ] **Step 1: Correct `.env.example`**

Replace lines 7–10 of `.env.example`:

```
# Canonical site origin (no trailing slash). Optional: production builds fall
# back to the committed canonical domain in src/lib/site.ts, so this only needs
# setting to override it — a staging origin, for example.
# NEXT_PUBLIC_SITE_URL=https://staging.enkitools.com
```

- [ ] **Step 2: Correct the live-site references in `handoff.md`**

Replace lines 71–74:

```markdown
**Repo:** `https://github.com/ultravmusic1-del/enki.git` (branch `main`, pushed).
**Live:** https://enkitools.com (Vercel project `enki`, auto-deploys on push to
`main`). `enki-five.vercel.app` 308-redirects here. Deployment Protection is on,
which gates the *deployment-specific* and preview URLs behind Vercel SSO; the
production domain above is public.
```

- [ ] **Step 3: Correct the auth and canonical-origin notes in `handoff.md`**

Replace lines 92–104 (the "### 2b" block through the end of the "Canonical origin"
paragraph):

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add .env.example handoff.md
git commit -m "docs: record enkitools.com as the live domain"
```

---

## Task 5: Local verification

**Files:** none modified.

- [ ] **Step 1: Full gate**

```bash
pnpm verify
```

Expected: typecheck, lint, and tests all pass.

- [ ] **Step 2: Production build emits the right origin**

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 3: Serve the production build**

```bash
npx next start -p 3100
```

Run this in the background; it must stay up for Steps 4 and 5. `next start` serves the
build with `NODE_ENV=production`, which is the branch under test.

- [ ] **Step 4: Prove the generated artefacts carry no Vercel origin**

```bash
curl -s localhost:3100/sitemap.xml | grep -c "vercel.app"
```

Expected: `0`. Repeat for the other two generated surfaces:

```bash
curl -s localhost:3100/robots.txt | grep -c "vercel.app"
```

```bash
curl -s localhost:3100/llms.txt | grep -c "vercel.app"
```

Expected: `0` for both.

- [ ] **Step 5: Confirm the canonical and JSON-LD in rendered HTML**

```bash
curl -s localhost:3100/ | grep -o '<link rel="canonical"[^>]*>'
```

Expected: `<link rel="canonical" href="https://enkitools.com"/>`

```bash
curl -s localhost:3100/ | grep -o 'instagram.com/enkitools.ai[^"]*'
```

Expected: at least one match, from the Organization `sameAs`.

- [ ] **Step 6: Stop the server and report**

Stop the `next start` process. No changes to commit. Report the output of Steps 1–5
verbatim when claiming the branch is ready.

---

## Operator Checklist

These are dashboard actions on accounts the implementer cannot access. **Step 1 must be
completed before this branch merges to `main`**, because merging deploys the Task 2
redirect.

### 1. Supabase — Auth URL configuration (blocking, do first)

Supabase Dashboard → project `qknsqurdawglctwqfwxe` → **Authentication** → **URL
Configuration**:

- Set **Site URL** to `https://enkitools.com`
- Under **Redirect URLs**, add `https://enkitools.com/auth/callback`
- **Keep** the existing `https://enki-five.vercel.app/auth/callback` entry for now.
  Confirmation emails already sitting in inboxes point at it. Remove it after ~7 days.

### 2. Vercel — add the `www` subdomain

Vercel Dashboard → project `enki` → **Settings** → **Domains**:

- Add `www.enkitools.com`
- Choose **Redirect to** `enkitools.com`, status **308 Permanent Redirect**
- Wait for the certificate to issue (Vercel does this automatically; usually under a
  minute). This closes the current TLS failure — `www.enkitools.com` presently serves a
  certificate that does not cover it.

### 3. Vercel — confirm no stale override

Same project → **Settings** → **Environment Variables**:

- If `NEXT_PUBLIC_SITE_URL` exists and is set to anything other than
  `https://enkitools.com`, delete it. The committed default now handles production.
- If it does not exist, do nothing — that is the expected state.

### 4. Google Search Console — first-time setup

At <https://search.google.com/search-console>:

1. **Add property** → choose **Domain** (not URL prefix). Enter `enkitools.com`.
   A domain property covers apex, `www`, and both protocols under one verification.
2. Google shows a `TXT` record value beginning `google-site-verification=`.
3. Add it in **Vercel** → **Domains** → `enkitools.com` → **DNS Records**
   (Vercel is the nameserver — `ns1.vercel-dns.com`):
   - Type: `TXT`
   - Name: `@`
   - Value: the string Google displayed
4. Back in Search Console, click **Verify**. If it fails, wait 10 minutes for DNS
   propagation and retry.
5. **Sitemaps** → submit `sitemap.xml`
6. **URL Inspection** → run once per page family and confirm the reported canonical is the
   `enkitools.com` URL: `/`, `/tools/cursor`, `/best/coding`, `/vs/cursor-vs-windsurf`

No Change of Address request applies — there is no verified property on the old host.

### 5. Post-deploy smoke test

After the branch merges and Vercel finishes deploying, report back on:

- `https://enkitools.com/` — canonical reads `https://enkitools.com`
- `https://enki-five.vercel.app/tools` — returns 308 to `https://enkitools.com/tools`
- `https://www.enkitools.com/` — loads with a valid certificate
- A real sign-up — confirmation email link completes on `enkitools.com`

The implementer can verify the first three over HTTP. The sign-up test needs a mailbox.
