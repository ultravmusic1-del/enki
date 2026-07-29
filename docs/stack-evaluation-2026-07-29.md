# Stack Evaluation — Tooling Candidates

**Date:** 2026-07-29 · **Baseline:** `fb8bbb9` · **Status:** research only, nothing decided

Prompted by a plan to add Sentry. This evaluates what else would earn its place in Enki's
stack. No implementation followed; this exists so the reasoning survives the session.

**Not a spec.** Anything acted on gets its own design doc first.

---

## 1. Current stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/Radix ·
Supabase (auth, Postgres, RLS) · Vercel (hosting, Analytics, Speed Insights) ·
Vitest · Playwright *(installed, not wired to CI)* · three.js / react-three-fiber ·
GSAP / motion / anime.js · react-hook-form + Zod · Fuse.js · embla · cmdk · sonner

Observability today: Vercel Analytics and Speed Insights. **No error tracking.**

---

## 2. The organising insight

The highest-value additions are not new capabilities. They are **loops the project has
already opened and not closed**:

| Open loop | Evidence |
|---|---|
| A CSP that reports to nobody | `next.config.ts` sets `Content-Security-Policy-Report-Only` with no `report-uri` and no `report-to` |
| A Playwright dependency that never runs | `@playwright/test` in `package.json`; `.github/workflows/verify.yml` runs only `pnpm verify` |
| A subscriber list that never sends | Newsletter writes to `subscribers`; `handoff.md` §12 "Email sending — captures but doesn't send" |
| A cron nothing watches | `/api/keep-warm` guards Supabase auto-pause; nothing alerts if it stops |
| Forms with no rate ceiling | `handoff.md` §12 "Edge rate limiting ... no request-rate ceiling" |

Three of these are already named in `handoff.md` §12 as pre-launch requirements.

---

## 3. Tier 1 — a gap that is live now

### Sentry (already planned)

Beyond error tracking, two uses specific to this codebase:

**CSP report collector.** The CSP is report-only with no collector, so the browser computes
every violation and discards it. Sentry exposes a Security Policy Reporting endpoint;
pointing the header at it turns a dead policy into data. This directly unblocks the
*"nonce-based CSP"* item in `handoff.md` §12 "Still to build", which is currently stalled
on not knowing what an enforcing policy would break.

Set both `report-uri` (deprecated but universally supported) and `report-to`. `report-to`
reached broad browser support in March 2026; `report-uri` remains the compatibility path.

**Cron Monitors** for `/api/keep-warm` — see §4.

Sentry's Next.js SDK adds a client bundle. Weigh against the 3D hero's LCP budget and
measure with the Speed Insights already installed.

### Vercel Firewall + BotID

`handoff.md` §12 flags edge rate limiting as an operator decision needed before public
launch. `/submit`, `/go/*` and the newsletter action all write to Supabase protected by
**honeypots and Postgres CHECK constraints only**.

Vercel covers this first-party, so no new vendor:

- **Rate limiting** — WAF rules, or `checkRateLimit()` from `@vercel/firewall` for
  per-route control with a custom key
- **BotID** — `withBotId()` in `next.config.ts` plus `checkBotId()` in the server action.
  Invisible detection rather than a CAPTCHA, so no user friction and no third-party
  script fighting the CSP work

Preferred over Cloudflare Turnstile: no extra origin in `script-src`, no visible
challenge, and it composes with the existing honeypot rather than replacing it.

### Resend (or Postmark)

The only Tier 1 item that is a **product** gap rather than infrastructure. The newsletter
captures addresses and sends nothing, and an `/unsubscribe` page exists for a list that
has never been mailed. People who submitted an address were promised something.

`handoff.md` §12 already scopes this: weekly digest plus per-tool "notify me when this
changes" alerts, sourced from the freshness `changelog`, adding `RESEND_API_KEY`.

---

## 4. Tier 2 — real leverage, not urgent

**Playwright in CI.** The dependency is already paid for and not running. Auth,
`/submit` and admin have no end-to-end coverage; `handoff.md` §12 notes React components
are largely untested. Cheapest available win.

**Cron / uptime monitoring.** Supabase's free tier auto-pauses and `keep-warm` is
load-bearing. If it fails silently the content layer degrades to the seed fallback and
nothing says so — a failure mode that looks like normal operation. Sentry Cron Monitors
covers it without adding a vendor, which is the argument for doing it alongside Sentry
rather than buying Better Stack or UptimeRobot separately.

**Renovate or Dependabot.** CI *fails* on a high-severity production advisory
(`pnpm audit --prod --audit-level high`) but nothing proactively bumps, so the discovery
mechanism is a broken build.

---

## 5. Tier 3 — and two arguments against

**PostHog — recommended against, for now.** The obvious "add product analytics" answer.
But `outbound_clicks` already captures the money event, Vercel Analytics and Speed
Insights are installed, and a heavy client script works against both the 3D hero's LCP
budget and the nonce-CSP work. Revisit when there is traffic worth segmenting.

**Algolia / Typesense — not yet.** Fuse.js is correct at 27 tools. Real somewhere in the
hundreds.

**Chromatic / Percy — the interesting one.** `pnpm sweep` proves containment, and
`CLAUDE.md` says so plainly: *"The sweep proves containment, not taste."* Screenshot
diffing covers exactly the half deliberately left uncovered. Worth it once the design
stops moving; premature while it is still in flux.

---

## 6. A tension worth naming

Several candidates add third-party client scripts. Each one:

- adds an origin to `script-src` / `connect-src`, enlarging the policy that
  `handoff.md` §12 wants to tighten into a nonce-based enforcing CSP, and
- competes with a 3D hero for LCP.

So "add more SaaS to the frontend" carries a compounding cost here that it would not on a
plainer site. This is the main reason Tier 1 favours **server-side** additions (firewall,
BotID checks, email) and Tier 3 argues against client-side analytics.

---

## 7. If picking one

**Sentry, done fully** — errors, CSP collector, cron monitor. One vendor, three open loops
closed, and it unblocks the nonce-CSP work that several other items wait behind.

Rate limiting / BotID is the natural second, because `handoff.md` calls it a pre-launch
blocker and the forms are currently defended by honeypots alone.
