# Write-Path Rate Limiting Design

**Date:** 2026-07-29 · **Baseline:** `06f885d` · **Pre-launch item:** `handoff.md` §12 A1
**Goal:** stop unauthenticated strangers writing unbounded rows into `subscribers`,
`tool_submissions` and `outbound_clicks`.

---

## 1. Evidence

Three paths accept writes with no authentication and no rate ceiling. Supabase's own
advisors flag all three as `INSERT … WITH CHECK (true)` for `anon`.

| Path | Table | Protection today | Abuse |
|---|---|---|---|
| `subscribe()` | `subscribers` | honeypot, Zod `email().max(254)` | subscribe anyone's address; flood the list |
| `submitTool()` | `tool_submissions` | honeypot, Zod | flood the moderation queue |
| `GET /go/[slug]` | `outbound_clicks` | **none** | inflate click counts |

The policies are not wrong — these are deliberately public. The gap is that nothing
limits **rate**.

**`/go/[slug]` is the sharpest.** It is a GET that writes a row: no form, no JS, no POST.
Crawlers, link prefetchers and scrapers inflate it with no malice at all, and those
counts drive the admin outbound-demand leaderboard and affiliate reporting. This is a
data-integrity defect that is already happening, not a hypothetical.

---

## 2. Decisions

| Question | Decision |
|---|---|
| Rate limiting | **`@vercel/firewall` `checkRateLimit()`** — first-party, per-route keys |
| Bot detection | **`botid`** on the two form actions — invisible, no CAPTCHA, no new CSP origin |
| Bot detection on `/go` | **No.** It is a user-facing navigation; a challenge there breaks the affiliate click |
| Honeypots | **Kept.** Free, catches naive bots before any network call |

Cloudflare Turnstile was rejected: it adds a third-party script origin to a CSP this
project intends to tighten to a nonce-based policy, and it puts a visible challenge in
front of a newsletter signup.

---

## 3. The failure-mode rule

This is the part that matters most, and it differs per path.

**Forms fail *open*.** If the rate-limit service is unreachable, `subscribe()` and
`submitTool()` proceed. A limiter outage must not take signup and submission down with
it — the downside of a few extra rows during an incident is far smaller than a silently
broken form. Bot detection likewise: `checkBotId()` erroring is treated as "not a bot".

**`/go/[slug]` fails open on the *redirect*, closed on the *recording*.** These are two
different actions sharing one request, and conflating them is the mistake to avoid:

- The redirect **always** happens. It is a real visitor going to a real tool, and it is
  how the site earns. Nothing may block it — not a rate limit, not a limiter outage.
- The recording is **skipped** when the caller is over the limit. A dropped click is a
  rounding error; an inflated leaderboard is a decision made on false data.

So the limiter guards the `insert`, never the `NextResponse.redirect`.

---

## 4. Limits

Per-IP, chosen to sit far above any human and far below a script:

| Path | Limit | Reasoning |
|---|---|---|
| `subscribe()` | 5 / hour | A person subscribes once. Five allows retries and shared NAT |
| `submitTool()` | 10 / day | Submitting more than ten tools a day is not an individual |
| `GET /go/[slug]` | 60 / minute | Generous — a visitor opening many tools in a session stays under it; a crawler does not |

Limits live in one module so they are reviewable in a single place rather than scattered
across three call sites.

---

## 5. Components

- **`src/lib/rate-limit.ts`** — the only place limits are defined. Exports one
  `guard(kind)` helper returning `{ allowed: boolean }`, swallowing limiter errors as
  `allowed: true` (§3's fail-open rule, implemented once rather than per call site).
- **`src/app/actions/newsletter.ts`** — `checkBotId()` then `guard('newsletter')`.
  Both return the existing friendly no-op shape so a bot learns nothing from the
  response, exactly as the honeypot already does.
- **`src/app/submit/actions.ts`** — same pattern, `guard('submit')`.
- **`src/app/go/[slug]/route.ts`** — `guard('outbound')` wraps only the `insert`.
- **`next.config.ts`** — `withBotId()` wrapping the existing exported config.

---

## 6. Verification

| Gate | Command |
|---|---|
| Types, lint, unit | `pnpm verify` |
| RLS invariant still holds | `pnpm audit:rls` — 7/7 |
| No new advisories | `pnpm audit --prod --audit-level high` |
| Supabase advisors | re-run; the three `WITH CHECK (true)` warnings remain (by design — the ceiling is now at the edge) |
| Build | `pnpm build` |
| Behaviour | unit tests for `guard()` fail-open; live probe after deploy |

Unit tests must cover the fail-open path explicitly — it is the branch that only runs
during an incident, so it is the branch nobody would otherwise notice was broken.

No `.tsx` render changes, so no visual sweep. Stated rather than silently skipped.

---

## 7. Out of scope

- The `WITH CHECK (true)` policies themselves. They are correct for public write paths;
  the fix is a rate ceiling, not an RLS change.
- Authenticated write paths (reviews, saved tools, collections) — already gated by auth
  and RLS.
- Admin actions — already call `assertAdmin()`.
