# Launch Readiness Design

**Date:** 2026-07-26 · **Baseline:** `b2ae721` · **Reviewer stance:** external project lead
**Goal:** make Enki fit to onboard real end users — a free audience, no paying customers yet.

Approach **A, "minimum honest launch"**, as agreed. Every item below is a hard blocker:
a legal obligation, a functional failure, or a misrepresentation. Everything else is
explicitly deferred in §6.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| Who is the first customer? | **End users, free audience.** No billing, vendor dashboard, or contracts in scope. |
| The fabricated ratings and reviewers | **Strip the unearned claims.** Keep only the editorial score, under an Enki byline. |
| Domain | **Stay on `enki-five.vercel.app`.** Legal contact becomes `enkidirectory@gmail.com`. |
| Supabase auto-pause | **Keep-warm cron on the free plan**, not a paid upgrade. Move to Pro when there is user data worth restoring — Pro's real value is daily backups. |

---

## 2. What is being removed, and why

The site's headline trust signals currently claim things that are not true:

- The homepage renders **"Community reviews"** and **"Average rating"** cells. The
  `reviews` table holds **0 rows**. The numbers are sums of invented per-tool figures.
- **"Tools vetted: 27"** — of 27 seeded tools, **0** carry a `lastVetted` date. Per the
  project's own convention, unset means never vetted.
- `reviewCount` renders as "N reviews" in five places: compare, leaderboards (×2),
  the tool detail page, and the homepage stat.
- `src/data/authors.ts` defines six named reviewers with job titles — "Mara Okafor,
  Principal Reviewer" and five others — who do not exist. The 27 seeded reviews carry
  their bylines.

None of this is currently earning money: `affiliateUrl`, `sponsored`, and `deal` are set
on **zero** tools. So the exposure is prospective. Fixing it before the first affiliate
link goes live means it never becomes a real problem.

### The replacement

`editorScore` (0–10) is an honest editorial judgement and survives. `rating` (1–5) and
`reviewCount` are removed from `toolSchema` **entirely**, not merely hidden — a field
that still exists will eventually get rendered again by someone. Ranking moves to
`editorScore` everywhere it currently uses `rating`/`reviewCount`.

`CommunityRatingSummary` stays exactly as it is: it already averages **real approved
reviews only**, so it shows nothing until real users write something. That is correct.

The six personas and the 27 seeded reviews are retired to empty arrays. The schemas and
plumbing stay, so genuine editorial reviews under a real byline can be added later.

---

## 3. Architecture of the changes

Five independent units. Each is separately shippable and separately verifiable.

### 3.1 Content truthfulness (`src/data`, `src/lib`, components)

- `toolSchema` loses `rating` and `reviewCount`.
- All 27 seed entries lose those two fields.
- `authors.ts` and `reviews.ts` export empty arrays.
- Every sort keyed on `rating`/`reviewCount` moves to `editorScore`:
  `content.ts` (5 sorts), `filters.ts` (sort options), `best/[category]`.
- `StarRating` display sites become an editor-score display: `tool-card`,
  `featured-tool-card`, `compare-view`, `leaderboards-view`, tool detail.
- The homepage trust block goes from four cells to three honest ones: **Tools listed**,
  **Categories**, **Paid placements** (computed from `sponsored`, so it stays true as
  that changes rather than being a hardcoded boast).

`StarRating` itself is kept — `review-list` still uses it for genuine per-review ratings.

### 3.2 Legal contact (`src/app/privacy`, `src/app/terms`)

`hello@enki.tools` → `enkidirectory@gmail.com` in both pages. That address is a mailbox
that actually exists, so a data-rights request or legal notice reaches someone.

### 3.3 Data rights (new routes + one migration)

Every foreign key already cascades from `auth.users` — verified against the live
database for `profiles`, `reviews`, `saved_tools`, `collections`, `collection_items`,
and `admins`. So deleting the auth row removes all of a user's data in one statement.

- **Account deletion:** a `SECURITY DEFINER` RPC `delete_own_account()` that deletes
  `auth.users where id = auth.uid()`, self-guarded so it can only ever delete the
  caller. Exposed through an account page with an explicit confirmation.
- **Data export:** an authenticated page that gathers the caller's profile, reviews,
  saved tools, and collections and offers them as a JSON download. Reads go through
  RLS, so a user can only ever export their own rows.
- **Newsletter unsubscribe:** a `/unsubscribe` page plus a `SECURITY DEFINER` RPC that
  sets `status = 'unsubscribed'` for a given email. Anon cannot update `subscribers`
  directly, so the RPC is the only path.

  *Known limitation, accepted:* email-only unsubscribe means anyone could unsubscribe
  someone else's address. That is standard for pre-send unsubscribe and strictly better
  than no mechanism. When email sending lands, this becomes a signed token in the link.

### 3.4 Availability (`vercel.json`, new route)

A Vercel Cron hitting `/api/keep-warm` daily, which runs one trivial Supabase query.
That is enough to stop the free tier pausing, which today would make **signup and login
fail outright** while the public pages carried on serving the static seed — the worst
kind of failure, because it looks fine from the outside.

Guarded with `CRON_SECRET` when that variable is set, so the endpoint cannot be used as
a free database-pinger by anyone who finds it.

### 3.5 Failure visibility (`src/app/error.tsx`, `global-error.tsx`)

There is currently no error boundary at all — only `not-found.tsx`. An unhandled
runtime error therefore shows Next's raw error page. Adding `error.tsx` and
`global-error.tsx` gives users a branded recovery path and logs the error server-side
where Vercel captures it.

Full error monitoring (Sentry) needs an account and DSN that only the operator can
create, so it is documented as the immediate next step rather than half-built here.

---

## 4. Testing

- **Unit:** the ranking helpers change signature-adjacent behaviour, so
  `content.test.ts` and `filters.test.ts` need their `rating`/`reviewCount` fixtures
  updated to `editorScore` and their sort assertions rewritten.
- **Guard test:** a new test asserting `toolSchema` rejects objects carrying `rating` or
  `reviewCount`, and that no component file references `tool.rating` or
  `tool.reviewCount`. This is the same "promote the rule into a test" pattern already
  used for the `.upsert()` trap — it is what stops the fabricated fields creeping back.
- **Visual:** `pnpm sweep` across `/`, `/tools`, `/tools/<slug>`, `/compare`,
  `/leaderboards`, `/best/<category>` — every card and table changes, so containment
  must be re-proved at both viewports.
- **Live:** `pnpm audit:rls` must stay green after the new RPCs, and the two new
  `SECURITY DEFINER` functions must be confirmed callable only for the caller's own data.

---

## 5. Sequencing

1. Content truthfulness — largest change, touches everything, so it goes first while
   the tree is otherwise clean.
2. Legal contact — trivial, independent.
3. Error boundaries — independent, improves every later manual check.
4. Keep-warm cron — independent.
5. Data-rights routes and migrations — last, because they add new surface rather than
   changing existing behaviour, and they are the easiest to verify in isolation.

---

## 6. Explicitly deferred

Recording these so nobody mistakes the omission for an oversight:

- **Rate limiting (audit F6).** The anon-insert bypass via direct PostgREST is still
  open. Low risk at launch traffic; revisit before any publicity push. Watch free-tier
  storage in the meantime.
- **CSP enforcement.** Report-only is live and reported zero violations; enforcing needs
  nonce propagation through `proxy.ts`.
- **Email sending.** No provider wired. Until then the newsletter captures addresses and
  sends nothing, which is why unsubscribe is still required but a signed-token link is not.
- **E2E expansion.** Only `directory` and `finder` are covered; signup, review, and
  submit are not.
- **Earning the trust stats back.** Genuine vetting with real `lastVetted` dates and
  real editorial reviews under a real byline. This is the path to putting numbers back
  on the homepage honestly.
- **Custom domain.** Deferred by choice; revisit when the project is worth a domain.

---

## 7. Operator actions — not implementable from here

These are dashboard-only and block launch just as hard as anything above.

| # | Action | Where | Why it blocks |
|---|---|---|---|
| 1 | Set Site URL to `https://enki-five.vercel.app` and add `https://enki-five.vercel.app/auth/callback` to Redirect URLs | Supabase → Auth → URL Configuration | **Confirmation emails point at the wrong origin, so signup does not complete.** The cheapest fix with the largest consequence. |
| 2 | Enable leaked-password protection | Supabase → Auth → Policies | Flagged by the security advisor; an admin-capable account with no breach check. |
| 3 | Raise the server-side password minimum to 10 | Supabase → Auth → Policies | The client minimum is advisory only; a client can post straight to GoTrue. |
| 4 | Create a Sentry project and add the DSN | Sentry + Vercel env | Error boundaries catch and log, but nothing alerts you. |

Item 1 should be done **before** any real user is invited. The others can follow within
the first week.
