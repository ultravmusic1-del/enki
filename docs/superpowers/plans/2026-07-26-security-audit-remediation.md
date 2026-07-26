# Security Audit & Remediation Plan

**Date:** 2026-07-26 · **Target:** Enki `900a39a` · **Live:** https://enki-five.vercel.app
**Backend:** Supabase `qknsqurdawglctwqfwxe` · **Host:** Vercel (auto-deploy on `main`)

Scope: application code, database (RLS/grants/constraints), auth flows, dependency
tree, and the Vercel deployment. Every finding below was verified against the
running system or the live database, not inferred from reading alone. Where a
finding turned out to be *less* severe than it first appeared, that is stated.

---

## 1. What is actually solid

Worth recording, because these are the controls a future change must not regress.

| Control | Verification |
|---|---|
| **Review self-approval bypass is genuinely closed** | `information_schema.column_privileges`: `authenticated` UPDATE on `reviews` is limited to `body, rating, title, updated_at`. `status` is not grantable, so the only write path is `admin_set_review_status()`, which self-guards on `is_admin()`. |
| **RLS holds against the public anon key** | Live probe with the publishable key returned `[]` for `tool_submissions`, `subscribers`, `outbound_clicks`, `admins`, `reviews`, `collections`. |
| **Admin gate works in production** | `/admin` and `/admin/tools` both 307 to `/login?redirect=/admin` for an anonymous caller. |
| **Every admin server action re-checks authorization** | `assertAdmin()` is called inside `saveTool`, `deleteTool`, `setReviewStatus`, `setSubmissionStatus`, and fails closed when the DB is unreachable. |
| **DB-sourced content is re-validated before render** | `loadDbTools()` runs `toolSchema.safeParse` per row and drops failures, so a tampered `tools.data` JSONB cannot reach a page unvalidated. |
| **Only one HTML-injection sink, and it is escaped** | `json-ld.tsx` is the sole `dangerouslySetInnerHTML`; it escapes `<` to `<`, closing the JSON-LD `</script>` breakout. |
| **Security headers are live** | HSTS (2y, preload), `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, restrictive `Permissions-Policy` all present on production responses. |
| **Public tool links never expose the raw target** | All outbound anchors use `outboundHref()` → `/go/<slug>`, an internal path. The external URL only ever appears in a `Location:` header, which browsers do not execute. |
| **Install-time script execution is allowlisted** | `pnpm-workspace.yaml` `onlyBuiltDependencies` limits build scripts to `sharp`, `unrs-resolver`, `@tailwindcss/oxide`, `esbuild`. |
| **No fabricated structured data** | `siteConfig.hasVerifiedRatings === false`, so no `AggregateRating`/`Review` markup is emitted. |

---

## 2. Findings

Ranked by real, present risk — not by how alarming the class sounds.

### F1 — Next.js 16.2.10 carries 9 advisories, 4 of them HIGH · **HIGH**

`pnpm audit` against the installed tree:

| Severity | Advisory |
|---|---|
| HIGH | Middleware / Proxy bypass in App Router using **Turbopack** and single locale |
| HIGH | Denial of Service in App Router using **Server Actions** |
| HIGH | SSRF in Server Actions on custom servers |
| HIGH | SSRF in rewrites via attacker-controlled destination hostname |
| MODERATE | Unauthenticated disclosure of internal **Server Function endpoints** |
| MODERATE | Cache confusion of response bodies for requests with bodies (×2) |
| MODERATE | Unbounded Server Action payload in Edge runtime |
| MODERATE | DoS in the Image Optimization API using SVGs |

Enki uses Turbopack *and* a `proxy.ts` *and* server actions, so the first two
land squarely on this architecture. The proxy only refreshes the Supabase
session — authorization lives in `requireAdmin()` at the page level — so a proxy
bypass does not by itself grant admin access. That is good defence in depth, but
it is not a reason to stay unpatched.

**Fix: `next` 16.2.10 → 16.2.11.** One patch bump clears all nine.

Also HIGH in the production tree: `sharp` (libvips CVEs, via `next`), `postcss`
(arbitrary file read via `sourceMappingURL`, via `next`), `brace-expansion` (DoS).

### F2 — Unvalidated redirect at `/login?redirect=` · **MEDIUM**

`src/components/auth/login-form.tsx:16`

```ts
const redirectTo = searchParams.get("redirect") || "/";
// ...
router.push(redirectTo);   // line 40 (sign-in) and 55 (sign-up)
```

Fully attacker-controlled, no validation. Next performs a hard navigation for an
absolute cross-origin URL, so
`https://enki-five.vercel.app/login?redirect=https://evil.example` shows the
real domain and the real login form, then drops the user on the attacker's site
*immediately after they authenticate* — the point at which they are most
convinced the site is genuine. Prime credential-phishing and OAuth-consent bait.

The server-side twin at `src/app/auth/callback/route.ts:14` is **not**
vulnerable: it builds `${origin}${redirect}`, so an absolute URL cannot escape
the origin. Only the client form needs fixing.

### F3 — `profiles` is world-readable, leaking the admin's user id · **MEDIUM**

Policy `Profiles are viewable by everyone` is `SELECT USING (true)` for `public`.
An unauthenticated request with the publishable key returns every row:

```
GET /rest/v1/profiles?select=*
[{"id":"66f63065-…","display_name":"Ada Reviewer","created_at":"2026-07-13T…"},
 {"id":"7fc156ef-b643-48af-84e9-…", …}]
```

That second id is the **admin's** auth UUID (handoff §2c). So an anonymous
attacker gets: full user enumeration, every display name, account-creation
timestamps, and the specific identity to target for session theft or password
reset abuse. `anon` also holds unnecessary INSERT/UPDATE grants on all three
`profiles` columns (RLS blocks them today because `auth.uid()` is NULL, but the
grant should not exist).

### F4 — "Private notes" are published when a collection is shared · **MEDIUM**

The UI promises privacy in two places:

- `collections-manager.tsx:126` — "add **private notes**"
- `collections-manager.tsx:258` — placeholder "Add a **private note**…"

But `src/app/lists/[id]/page.tsx:47` renders `{note}` for every item of a public
collection, and RLS permits it (`items readable with parent` → `c.is_public OR
owner`). Flipping a collection to Public to share the *tool list* also publishes
the notes, with no warning at the toggle. `/lists/[id]` is indexable, so search
engines will crawl them.

This is a confidentiality failure created by the product's own wording rather
than an attacker capability, which is exactly why it is easy to miss.

### F5 — No URL protocol allowlist anywhere · **MEDIUM (latent)**

`z.url()` in Zod v4 only checks that `new URL()` parses. Verified empirically —
all of these are **ACCEPTED** by `z.url()`:

```
javascript:alert(document.cookie)    JaVaScRiPt:alert(1)
data:text/html,<script>alert(1)</script>    vbscript:msgbox(1)    file:///etc/passwd
```

This governs `toolSchema.website`, `toolSchema.affiliateUrl`, and the **public**
`submissionFormSchema.url`. The database does not compensate:
`tool_submissions_url_check` is length-only (1–2048 chars). So anyone can store
`javascript:…` in `tool_submissions.url`, via the server action *or* directly
through PostgREST with the public key.

`src/app/admin/page.tsx:187` then renders that value as `href={s.url}` on the
admin dashboard.

**Honest severity assessment.** I tested this rather than assuming, and it is
*not* currently exploitable:

| Anchor config | `javascript:` executes? |
|---|---|
| no `target` | **YES** — in Enki's origin |
| `target="_self"` | **YES** |
| `target="_blank"` | no |
| the admin page's exact config (`_blank` + `rel="noopener noreferrer"`) | **no** |

Chrome 148 refuses `javascript:` for `_blank` navigations, and the admin anchor
has `target="_blank"`. (Proof that the underlying mechanism does work in this
origin: an anchor without `target` executed and replaced the live document with
its return value.)

So the risk is **latent, not live**. It matters because the only thing standing
between a stored `javascript:` payload and script execution in an authenticated
admin's session is a cosmetic presentation attribute that no test protects and
no comment explains. Delete `target="_blank"` in a styling tidy-up — an entirely
plausible edit — and this becomes an anonymous-to-admin XSS. Separately,
`/go/[slug]` will happily emit any scheme in `Location:`, including mobile
deep-link schemes.

### F6 — No rate limiting on any anonymous write · **MEDIUM**

`outbound_clicks`, `subscribers`, and `tool_submissions` all have
`INSERT … WITH CHECK (true)` for `anon`. The publishable key is public by design,
so an attacker calls PostgREST directly and **the honeypot and Zod checks never
execute** — they only exist in the server action path. There is no `vercel.json`
and no WAF rule.

Consequences: unbounded free-tier storage growth, a flooded admin moderation
queue (which also raises the odds of an operator misclicking an F5 payload),
newsletter list poisoning, and garbage in the outbound-demand analytics that
drive editorial decisions. Known and documented as an open item in handoff §12;
recording it here with the mechanism made explicit.

### F7 — No Content-Security-Policy · **LOW–MEDIUM**

Confirmed absent on production responses; deliberately deferred in
`next.config.ts` because of the three.js hero and Vercel Analytics. Worth
re-prioritising: a `script-src` policy without `unsafe-inline` blocks
`javascript:` URLs outright, which would convert F5 from "one attribute away
from XSS" into "defended at two layers."

### F8 — `shadcn` is a production dependency · **LOW**

`shadcn` sits in `dependencies`, not `devDependencies`. It is a scaffolding CLI
that no runtime code imports, and it drags into the production tree:
`fast-uri` (**HIGH** — host confusion), `@hono/node-server` (path traversal),
`brace-expansion` (**HIGH** — DoS), plus `ts-morph`, `@modelcontextprotocol/sdk`,
and `@dotenvx/dotenvx`. Moving it removes several advisories from production
outright.

### F9 — Over-broad table grants · **LOW**

`anon` and `authenticated` both hold INSERT/UPDATE on every column of `tools`.
RLS blocks it today (the `admins write tools` policy is `{authenticated}` +
`is_admin()`, and no policy admits an `anon` INSERT at all), so this is not
exploitable. But it is a latent footgun: one permissive policy added later and
the grant is already in place. Same pattern on `profiles`.

### F10 — Weak password policy · **LOW**

Client-side `minLength={6}`, and Supabase's leaked-password protection
(HaveIBeenPwned) is **disabled** — flagged by the security advisor. For an
account that can hold admin, six characters with no breach check is thin.

### F11 — CI workflow grants a default-scoped token · **LOW**

`.github/workflows/verify.yml` (added earlier today) sets no `permissions:`
block, so it inherits the repository default, which may be read/write. The job
needs read-only. Fork PRs already get a read-only token regardless, so impact is
limited, but least privilege should be explicit.

### F12 — Supabase Auth redirect URLs still unconfigured · **LOW**

Outstanding from handoff §2b. Confirmation and recovery emails point at the wrong
origin. Security-relevant, not just cosmetic: a wrong redirect allowlist is how
token-leak-via-redirect bugs happen, and it should be pinned to the production
origin at the same time F2 is fixed.

---

## 3. Remediation plan

Ordered by risk-reduction per unit of effort. Each phase is independently
shippable and independently verifiable.

### Phase 0 — Same-day, near-zero risk

| # | Action | Verify |
|---|---|---|
| 0.1 | `pnpm up next@16.2.11` (F1) | `pnpm audit` shows the 9 `next` advisories gone; `pnpm verify` + `pnpm build` clean; `pnpm sweep` clean |
| 0.2 | Move `shadcn` to `devDependencies` (F8) | `pnpm audit --prod` no longer lists `fast-uri`, `@hono/node-server`, `brace-expansion` |
| 0.3 | Add `pnpm overrides` for `sharp`/`postcss` if 0.1 doesn't lift them (F1) | `pnpm audit` |
| 0.4 | **Dashboard, yours:** enable leaked-password protection (F10) | Supabase security advisor stops reporting it |
| 0.5 | **Dashboard, yours:** set Auth Site URL + `/auth/callback` redirect allowlist (F12) | A real signup email links to the production origin |
| 0.6 | `permissions: {contents: read}` in `verify.yml` (F11) | CI still green |

### Phase 1 — Close the live defects (code + one migration)

**1.1 Redirect validator (F2).** New `src/lib/safe-redirect.ts`:

```ts
/**
 * Only ever redirect to a path on this origin. An attacker-supplied absolute
 * URL, protocol-relative "//evil.com", or backslash variant "/\evil.com"
 * (which several browsers normalize to "//") all collapse to "/".
 */
export function safeInternalPath(raw: string | null, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;      // absolute or scheme-relative
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
```

Use it in `login-form.tsx` and, defensively, in `auth/callback/route.ts`. Unit
tests for each rejection case.

**1.2 URL protocol allowlist (F5), three layers.**

- A shared `httpUrl` Zod schema — `z.url()` plus a `.refine()` restricting the
  protocol to `http:`/`https:` — replacing `z.url()` on `toolSchema.website`,
  `toolSchema.affiliateUrl`, and `submissionFormSchema.url`.
- A migration tightening `tool_submissions_url_check` to require an `https?://`
  prefix, so a direct PostgREST caller is bound by the same rule.
- A `safeExternalHref()` helper returning `"#"` for anything non-http, applied at
  `admin/page.tsx:187`, plus a scheme check in `/go/[slug]` before
  `NextResponse.redirect`.

Belt and braces deliberately: the DB constraint covers callers who bypass the
app, and the render helper covers rows already stored.

**1.3 Restrict `profiles` reads (F3).** Replace `USING (true)` with a policy
exposing a profile only when it is the caller's own *or* the user has an approved
review or a public collection — the two places a display name is legitimately
shown. Then `revoke insert, update on public.profiles from anon`.

Needs care: `/lists/[id]` reads the curator's `display_name` and review lists
read author names. Both stay inside the narrowed policy. Verify by re-running the
anon probe and confirming the tool detail page and a public list still render
their names.

**1.4 Private notes (F4)** — needs a product decision, see §4.

### Phase 2 — Defence in depth

**2.1 CSP (F7), staged.** Emit a nonce from `proxy.ts`, ship
`Content-Security-Policy-Report-Only` first, collect violations from the real 3D
hero and Vercel Analytics, tighten, then enforce. Target `script-src 'self'
'nonce-…' 'strict-dynamic'` with no `unsafe-inline`, which is what kills
`javascript:` URLs.

**2.2 Rate limiting (F6).** Vercel WAF rules on `/submit`, `/go/*`, and the
newsletter action, *plus* something at the data layer — the WAF cannot see a
direct PostgREST call. Options: a per-IP-hash insert-rate trigger, or move anon
writes behind a server-only route that holds the sole insert grant. The second is
architecturally cleaner and worth costing.

**2.3 Grant cleanup (F9).** `revoke insert, update on public.tools from anon` and
narrow `authenticated` to what the CMS needs. Re-verify the admin CMS end to end
afterwards — this is the change most likely to break something.

### Phase 3 — Make the fixes permanent

**3.1 Regression tests.** Protocol allowlist (the `javascript:`/`data:`/
`vbscript:` cases, mirroring the probe that found F5); `safeInternalPath`;
a test asserting no admin/public component renders a raw external URL in `href`.
This is the same "promote the gotcha into a test" pattern already used for the
`.upsert()` trap.

**3.2 `pnpm audit` in CI.** Fail on high severity, with an explicit
documented-and-dated allowlist for anything genuinely unfixable — so F1 cannot
silently recur.

**3.3 An RLS smoke test.** Script the anon-key probe from this audit
(`tool_submissions`, `subscribers`, `outbound_clicks`, `admins` must all return
`[]`) and fold it into `pnpm doctor` or a separate `pnpm audit:rls`. Policy
regressions are invisible until someone checks.

---

## 4. Decision needed from you

**F4, private notes.** Three options, and this is a product call, not a security
one:

1. **Never publish notes.** Stop selecting `note` on `/lists/[id]`. Notes stay
   genuinely private; public lists become tool lists only. Honours the current
   wording, loses a feature you may have intended.
2. **Two kinds of note.** A private note plus an optional public "why this made
   the list" blurb. Most useful, most work.
3. **Relabel and warn.** Drop the word "private", and make the Public toggle warn
   that notes become visible. Cheapest, but a shared list still exposes anything
   already written under the old promise — so it needs a one-off review of
   existing rows.

My recommendation is **1 now, 2 later if you want curated commentary** — it is
the only option that does not leave already-written notes exposed.

---

## 5. Explicitly out of scope

- No penetration testing against third-party infrastructure (Supabase, Vercel).
- No attempt to bypass Vercel Deployment Protection.
- **No destructive or polluting writes to the production database.** F5's
  storability was established from the DB constraint definition and the Zod
  probe, not by inserting a payload into `tool_submissions`.
- The editorial-integrity items in handoff §12 (sample `rating`/`reviewCount`,
  invented reviewer personas) are a disclosure and FTC matter, already tracked
  there, and are not restated here.
