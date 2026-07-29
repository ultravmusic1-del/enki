# Launch Readiness Audit

**Date:** 2026-07-29 · **Baseline:** `000e566` · **Live:** https://enkitools.com

Assessment of what is sound and what still needs attention before the site is opened
to public users. Findings are separated by whether they were **verified by a command**
or **inferred from reading**, because the difference matters.

---

## 1. Verified working

Each of these was checked in this session, not assumed.

| Area | Evidence |
|---|---|
| RLS holds | `pnpm audit:rls` — 7/7 PASS: `admins`, `collections`, `outbound_clicks`, `profiles`, `reviews`, `subscribers`, `tool_submissions` all invisible to anon |
| Dependency advisories | `pnpm audit --prod --audit-level high` — no known vulnerabilities |
| Gate | `pnpm verify` — 274 tests across 30 files, typecheck + lint clean |
| Build | `pnpm build` succeeds; CI runs the gate plus a prod-only audit on every push |
| Canonical domain | Every canonical, OG tag, sitemap entry (111), robots directive, `llms.txt` link and JSON-LD id on `enkitools.com`; regression test blocks a `.vercel.app` origin ever shipping again |
| Old host retired | `enki-five.vercel.app` and `www` both 308 to the apex, single hop, path preserved |
| Index control | One mechanism — `Disallow` list emptied, private routes carry `noindex` that crawlers can now actually see |
| Push indexing | IndexNow live; 111 URLs accepted (HTTP 202) by Bing/Yandex/Naver/Seznam/Yep |
| Error tracking | Sentry initialising on node, edge and client; source maps uploading |
| Cron monitoring | `keep-warm` monitor active, healthy check-in recorded |
| Cron endpoint secured | `CRON_SECRET` set — unauthenticated, wrong-bearer, malformed and empty-bearer all 401 |
| Hero first paint | Intro no longer un-paints server-rendered copy; asserted h1 opacity never decreases after first paint |
| Hero payload | Model 1286 KB → 124 KB, poster 50 KB, emblem mask 415 KB → 42 KB, one model request |
| Content integrity | `authors.ts` deliberately empty; no `rating:` fields in seed data; `hasVerifiedRatings: false` |

**The content-integrity blocker in `handoff.md` §12 is resolved.** The invented reviewer
personas and per-tool rating figures are gone. `handoff.md` still describes them as
outstanding and is stale on this point.

---

## 2. Needs attention before public users

### Blocker — unauthenticated unrestricted writes, no rate limit

Supabase's own advisors flag three tables where `anon` can INSERT with `WITH CHECK (true)`:

- `outbound_clicks` — anyone can inflate click counts, which drive the admin
  outbound-demand leaderboard and, indirectly, affiliate reporting
- `subscribers` — anyone can add any address; also a vector for subscribing a
  third party's email without consent
- `tool_submissions` — anyone can flood the moderation queue

These are all *intended* public write paths, so the policies are not wrong. The gap is
that nothing limits **rate**. Protection today is a honeypot field and Postgres CHECK
constraints. `handoff.md` §12 already names edge rate limiting as required before
launch, and it is the single largest pre-launch risk.

Vercel covers this first-party: `checkRateLimit()` from `@vercel/firewall`, plus BotID
(`withBotId` / `checkBotId`) for invisible bot detection with no CAPTCHA friction and no
third-party script added to the CSP.

### Blocker — leaked password protection is off

`auth_leaked_password_protection` — Supabase Auth can check new passwords against
HaveIBeenPwned. Currently disabled, so a user can register with a known-breached
password. One dashboard toggle. Flagged in `handoff.md` §12 and still open.

### High — the newsletter is a promise the site does not keep

The footer form really does write to `subscribers`, and `/unsubscribe` exists and works.
Nothing has ever been sent. Every address collected is an unfulfilled commitment, and
that gap widens with every signup after launch. Either wire a provider (Resend/Postmark
+ `RESEND_API_KEY`) or stop collecting until you can.

### High — no end-to-end test coverage

`e2e/` exists and is **empty**; `test:e2e` is wired to Playwright but there are no specs,
and CI runs only `pnpm verify`. The 274 unit tests cover `lib` logic and server actions.
Nothing exercises signup → confirm → login, `/submit`, or the admin moderation flows in a
browser. Those are exactly the paths where a first public user meets the site.

### Medium — an unexplained 403 on production

For roughly twenty minutes, every URL returned `403 Vercel Security Checkpoint` with
`X-Vercel-Mitigated: challenge`, then recovered on its own. Attack Challenge Mode and bot
protection are both confirmed **off**, so the initial explanation was wrong and the cause
is unknown. It may have been automatic DDoS mitigation reacting to heavy automated
traffic from one IP during this session, but that is unconfirmed. Worth watching; if it
recurs with real user traffic it becomes a blocker.

### Medium — no backups

Supabase free tier: no daily backups, and the project auto-pauses after ~7 days idle
(mitigated by the keep-warm cron, now monitored). The moment there is real user data —
accounts, reviews, collections — an accident is unrecoverable. Pro's real value here is
backups, not uptime.

### Low — CSP still report-only

Now that violations report to Sentry, the data needed to write an enforcing nonce-based
policy will accumulate. Until then `script-src` carries `'unsafe-inline'` and the policy
is measurement rather than protection.

### Low — remaining payload

The three.js/R3F chunk is ~909 KB and unchanged; the hero model no longer waits on it but
it is still the largest single asset. `public/brand/logo.png` (1.1 MB) and
`inspiration.png` (500 KB) are not on the homepage critical path but are large.

### Low — thin-content risk on generated pages

~100 of the 111 sitemap URLs are generated `/best`, `/alternatives` and `/vs` pages. This
is the shape Google's doorway-page guidance targets. No penalty observed, and the site is
too new to have signal, but it is the largest structural SEO risk and warrants a pass
before pushing hard on acquisition.

### Housekeeping

- `handoff.md` §12 is stale — it still lists the fabricated ratings/reviewers as an open
  decision when the code shows it resolved
- Sentry alert rules unreviewed: errors now arrive, but nothing is configured to tell
  anyone
- One stale Sentry cron monitor environment (`vercel-production` vs `production`); the
  monitor is currently **disabled**, so the cron is not actually being watched

---

## 3. Checklist — moved

The actions from this audit now live in **`handoff.md` §12**, which is the single
pre-launch to-do list. This document keeps only the findings and the evidence behind
them; do not re-add a checklist here.

The `keep-warm` monitor item is closed — the monitor was deleted, and `withMonitor`
upserts it again on the next check-in.

---

## 4. Overall

The foundations are in better shape than most pre-launch sites: RLS is proven by a
command rather than asserted, the security-sensitive decisions are documented with their
reasoning, the SEO baseline is correct and machine-verified, and the project has already
removed the fabricated trust signals that would have been its most serious liability.

The gap is concentrated in one place: **the site is ready to be read, and not quite ready
to be written to.** Every remaining blocker is about accepting input from strangers —
unrestricted writes with no rate limit, weak passwords permitted, no browser test over
the signup path, and no backup if any of it goes wrong.

Items 1–7 close that gap. Nothing else on this list needs to happen before the first
visitor arrives.
