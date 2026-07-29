# SEO Domain Migration Design

**Date:** 2026-07-29 · **Baseline:** `e4dfec0` · **Domain:** `enkitools.com`
**Goal:** make `enkitools.com` the canonical origin everywhere, so the ranking signal
the site earns accrues to the domain Enki actually owns.

Scope is **technical correctness only**, as agreed. Content depth and keyword targeting
are explicitly deferred to §9.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| The domain | **`enkitools.com`.** `enktools.com` — the spelling the work was requested under — is NXDOMAIN at the registry. `enkitools.com` is delegated to `ns1/ns2.vercel-dns.com` and already serves the site. |
| Canonical host | **Apex**, `https://enkitools.com`. It already holds a valid certificate; `www` does not. |
| How the origin is resolved | **A committed production constant**, with `NEXT_PUBLIC_SITE_URL` still winning as an override. Not env-var-only — see §3. |
| `enki-five.vercel.app` | **308 redirect** to the apex, all paths. |
| Social links | **Fill, not remove.** Instagram only: `enkitools.ai`. |
| Google Search Console | **Not set up.** First-time domain-property verification via DNS TXT. |

---

## 2. The defect

The site's SEO scaffolding is well built. Every page carries `alternates.canonical`,
JSON-LD covers Organization / WebSite / SoftwareApplication / BreadcrumbList / ItemList /
FAQPage, `/vs/` pairs are canonicalised alphabetically so reversed URLs consolidate, and
`hasVerifiedRatings: false` correctly suppresses review markup that would otherwise be a
Google policy violation.

All of it points at the wrong host. Observed live on 2026-07-29:

```
https://enkitools.com/            <link rel="canonical" href="https://enki-five.vercel.app"/>
https://enkitools.com/            <meta property="og:url" content="https://enki-five.vercel.app"/>
https://enkitools.com/robots.txt  Host: https://enki-five.vercel.app
                                  Sitemap: https://enki-five.vercel.app/sitemap.xml
https://enkitools.com/sitemap.xml all 111 <loc> entries -> enki-five.vercel.app
https://enkitools.com/llms.txt    every link -> enki-five.vercel.app
```

`enkitools.com` is therefore telling search engines that the real page lives at
`enki-five.vercel.app`, and handing every ranking signal to the Vercel subdomain.

This is not a code bug. `resolveSiteUrl()` in `src/lib/site.ts` is behaving exactly as
written: `NEXT_PUBLIC_SITE_URL` was never set in Vercel, so resolution falls through to
`VERCEL_PROJECT_PRODUCTION_URL`. The file's own header comment predicted this failure
mode. The design below removes the silence, not just the symptom.

Two related defects:

- **`www.enkitools.com` serves no valid certificate.** The connection opens and the TLS
  trust check fails. Anyone typing `www.` gets a browser security interstitial.
- **`enki-five.vercel.app` still returns 200** with its own self-canonical — a complete
  second indexable copy of all 111 URLs.

---

## 3. Canonical origin resolution

`siteConfig.url` is the single chokepoint. Six modules consume it and none need editing:

`src/app/layout.tsx` · `src/app/sitemap.ts` · `src/app/robots.ts` ·
`src/app/llms.txt/route.ts` · `src/lib/structured-data.ts` · `src/app/go/[slug]/route.ts`

Fixing `resolveSiteUrl()` fixes canonicals, OG tags, the sitemap, robots.txt, `llms.txt`,
all JSON-LD `@id`/`url` fields, and the affiliate-redirect fallback in one edit.

### Why not env-var-only

Setting `NEXT_PUBLIC_SITE_URL` in Vercel would fix production today. It was rejected
because it leaves no record of the canonical domain in the repository, makes
`pnpm build` locally still emit Vercel URLs, reverts silently if the variable is ever
cleared, and cannot be covered by a test. An unset environment variable is the precise
cause of the defect in §2; the fix should not depend on the same mechanism.

### Client-bundle constraint

`src/lib/site.ts` is imported by `src/components/layout/site-footer.tsx`, a client
component. `resolveSiteUrl()` therefore executes in the browser bundle as well as on the
server. Next.js only inlines `NEXT_PUBLIC_*` variables into client bundles, so a bare
`VERCEL_ENV` check would read `undefined` in the browser and compute a *different*
origin than the server did — a hydration mismatch and wrong client-side URLs.

`NODE_ENV` is inlined identically on both sides and is the reliable signal. Preview
detection uses the `NEXT_PUBLIC_` copy first, matching the pattern the file already uses
for `VERCEL_PROJECT_PRODUCTION_URL`.

### Resolution order

```
NEXT_PUBLIC_SITE_URL set            -> use it (explicit override, e.g. staging)
Vercel preview deployment           -> that deployment's own origin
NODE_ENV === "production"           -> https://enkitools.com   (committed constant)
otherwise                           -> http://localhost:3000
```

Preview deploys keep their own origin so they can never claim production canonicals. Any
production build — on Vercel or not, configured or not — resolves to the committed
constant. Local development is unchanged.

### Test

New `src/lib/site.test.ts` covers each branch, plus the assertion that matters:

> With `NODE_ENV=production` and no `NEXT_PUBLIC_SITE_URL`, the resolved origin equals
> `https://enkitools.com` and does not end in `.vercel.app`.

That converts the failure in §2 from silent to loud.

---

## 4. Retiring `enki-five.vercel.app`

Add `redirects()` to `next.config.ts`:

- `source: "/:path*"`, `has: [{ type: "host", value: "enki-five.vercel.app" }]`
- `destination: "https://enkitools.com/:path*"`, `permanent: true` (308)

`next.config.ts` redirects are evaluated before middleware, so a bounced request never
runs the Supabase session refresh in `src/proxy.ts`. The host condition matches only the
production alias, so preview deployments and localhost are untouched, and no loop is
possible because `enkitools.com` never matches the condition.

---

## 5. Auth — must land first

Supabase currently has Site URL `https://enki-five.vercel.app` and
`https://enki-five.vercel.app/auth/callback` in Redirect URLs.

Once the 308 in §4 is live, a confirmation or OAuth link pointing at the Vercel host
redirects across an origin boundary mid-flow. PKCE verifier and session cookies are
origin-scoped and do not reliably survive that, so sign-up completion breaks.

**Ordering is load-bearing:**

1. Update Supabase Site URL to `https://enkitools.com` and add
   `https://enkitools.com/auth/callback` to Redirect URLs.
2. Keep the old `enki-five.vercel.app/auth/callback` entry during the transition so
   confirmation emails already in inboxes still resolve.
3. Only then deploy the 308.

To be executed through the `enki-supabase-change` skill.

---

## 6. `www` subdomain

Add `www.enkitools.com` as a domain in the Vercel project, configured to redirect to the
apex. Vercel issues the certificate, which closes the TLS failure. Dashboard step; no
code change.

---

## 7. Social links and `sameAs`

`siteConfig.social` currently holds three placeholders — `https://twitter.com`,
`https://github.com`, `https://linkedin.com` — rendered as real, clickable pills in the
footer. They are dead outbound links.

Replace with the one real account:

- `siteConfig.social` becomes `{ instagram: "https://www.instagram.com/enkitools.ai/" }`
- `socialLinks` in `site-footer.tsx` renders a single Instagram pill. The row is
  `flex items-center gap-2`, so going from three pills to one is layout-safe, but this is
  a `.tsx` change and therefore requires the visual sweep per `CLAUDE.md`.
- Organization JSON-LD in `structured-data.ts` gains
  `sameAs: ["https://www.instagram.com/enkitools.ai/"]`, connecting the entity to its
  verified profile.

---

## 8. Documentation and Search Console

**Docs, both currently wrong:**

- `.env.example:10` references `https://enki.tools` — a domain that does not exist.
- `handoff.md` documents `enki-five.vercel.app` as the live site throughout.

**Search Console, first-time setup.** A *domain* property is used rather than a URL-prefix
property, so apex and `www` are covered by one verification and no re-verification is
needed if the host preference changes.

1. Create a domain property for `enkitools.com`.
2. Add the supplied `TXT` record in Vercel's DNS panel (Vercel is the nameserver).
3. Verify, then submit `https://enkitools.com/sitemap.xml`.
4. Spot-check with URL Inspection on one route per family: `/`, `/tools/<slug>`,
   `/best/<category>`, `/vs/<pair>`.

Console actions are performed by the operator. The plan supplies exact values and a
checklist; it does not assume dashboard access.

No Change of Address request is applicable — there is no verified property on the old
host to migrate from.

---

## 9. Out of scope

Deferred deliberately, not overlooked:

- **Thin-content risk** on the ~100 generated `/best`, `/alternatives`, and `/vs` pages.
  Programmatically generated comparison pages with little unique substance are what
  Google's site-reputation and doorway-page guidance targets. Worth a dedicated pass.
- **Keyword-targeted titles and descriptions** across page families.
- **Internal linking depth** between tool, category, and comparison surfaces.
- Enforcing the CSP (currently report-only) — unrelated to this work.

---

## 10. Verification

Re-run the probes that exposed the defect, against `https://enkitools.com`:

| Check | Expected |
|---|---|
| `/` canonical + `og:url` | `https://enkitools.com` |
| `/robots.txt` | `Host:` and `Sitemap:` on `enkitools.com` |
| `/sitemap.xml` | 111 `<loc>`, zero containing `vercel.app` |
| `/llms.txt` | zero links containing `vercel.app` |
| `https://enki-five.vercel.app/tools` | `308` → `https://enkitools.com/tools` |
| `https://www.enkitools.com/` | valid certificate, redirects to apex |
| Organization JSON-LD | `sameAs` carries the Instagram URL |
| Sign-up flow | confirmation email link completes on `enkitools.com` |

Plus `pnpm verify` (typecheck + lint + test) and `pnpm sweep -- / /tools` for the footer
change.
