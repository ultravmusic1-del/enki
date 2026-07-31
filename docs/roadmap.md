# Enki — Development Roadmap

**This is the single to-do list for Enki.** It supersedes the list that used to
live in `handoff.md` §12, which now points here. Earlier lists in
`docs/launch-readiness-audit-2026-07-29.md`, `docs/stack-evaluation-2026-07-29.md`
and the Operator Checklists inside `docs/superpowers/plans/*` are superseded and
point here too. **Do not start a second one.**

Owner: **You** = dashboard/account access only you have. **Claude** = in-repo work.
Size: **S** ≈ under an hour · **M** ≈ a focused session · **L** ≈ multi-session.

Written 2026-07-31, merging the existing pre-launch list with an external review
of the live site. Every external claim was checked against the source before it
earned a place here; §7 lists the ones that did not survive that check.

---

## The one-paragraph version

Enki's problem is not build quality. It is that the site makes a specific promise
— "human-vetted AI tool intelligence" — and currently cannot show the work behind
it. Three defects actively contradict the promise: the alternatives pages
recommend unrelated tools, the directory and compare pages serve crawlers an
empty skeleton, and the copy credits "our editors" when `src/data/authors.ts` is
deliberately empty. Those are Phase 0. Everything after is about earning the
claim rather than repeating it.

---

## Phase 0 — Blockers (before the first public visitor)

Anything here either breaks a promise the site makes out loud or exposes an
unmetered write path.

### 0.1 — Alternatives pages recommend unrelated tools · Claude · M

**The single most damaging defect on the site.** `/alternatives/cursor` lists
Midjourney, ElevenLabs and Perplexity as Cursor alternatives. The same happens
for every tool whose category holds fewer than six entries.

**Root cause, located:** `getRelatedTools()` in [src/lib/content.ts:179](../src/lib/content.ts#L179)
sorts same-category tools by score, then **appends cross-category "fillers"**
sorted by score and slices to `n`:

```
const fillers = all.filter((t) => t.categorySlug !== tool.categorySlug && ...)
return [...sameCategory, ...fillers].slice(0, n);
```

[src/app/alternatives/[slug]/page.tsx:48](../src/app/alternatives/%5Bslug%5D/page.tsx#L48)
calls it with `n = 6`. The page even knows the padding is happening — line 104
branches on `t.categorySlug === tool.categorySlug` to decide whether to call the
entry "a direct alternative".

A visitor arriving from "best Cursor alternatives" concludes in one glance that
nothing was reviewed by a human. It is worth more than every SEO item below.

**Do:** split the function. `getRelatedTools()` may keep padding for the "you
might also like" rail on a detail page, where cross-category discovery is a
feature. Add `getAlternatives()` that returns same-category only, with **no
minimum**. If three exist, show three.

**Acceptance:** a unit test in `src/lib/content.test.ts` asserting
`getAlternatives(tool)` returns only `categorySlug === tool.categorySlug`, and a
second asserting a sparse category returns fewer than `n` rather than padding.
Page copy and the `<title>` (`${alts.length} best ... alternatives`) must read
correctly at counts of 1, 2 and 3.

**Then reconsider publishing at all:** an alternatives page with one legitimate
entry is a thin page. Gate `generateStaticParams` on a minimum of 3 real
same-category alternatives and let the rest 404. This overlaps 4.1.

### 0.2 — Crawlers get an empty skeleton on `/tools`, `/compare`, `/finder` · Claude · M

The external review noticed these pages expose "the page headings and footer, but
little or none of the actual interactive content" and guessed client-side
rendering. The real mechanism is sharper and entirely fixable.

Each page wraps a client component that calls `useSearchParams()` in a Suspense
boundary, which forces Next to bail that subtree out of the prerender:

| Route | Boundary | What ships in the static HTML |
|---|---|---|
| `/tools` | [tools/page.tsx:37](../src/app/tools/page.tsx#L37) | `<DirectorySkeleton>` — six empty grey boxes. Zero tool names, zero links |
| `/compare` | [compare/page.tsx:37](../src/app/compare/page.tsx#L37) | `fallback={null}` — nothing at all |
| `/finder` | [finder/page.tsx:27](../src/app/finder/page.tsx#L27) | no fallback — nothing at all |

So `/tools`, the page the whole directory hangs off, ships **no crawlable link to
any tool**. The internal-linking structure the SEO architecture depends on is
invisible to any crawler that does not execute JavaScript, and slower to reach
for the ones that do.

**Do:** read filter state from the **server** `searchParams` prop on the page and
render the initial, unfiltered list server-side, passing it to the client
component as `initialTools` for hydration. The client keeps ownership of
interaction; the server owns first paint. Where a full port is too large, the
minimum viable fix is to render the real tool grid (plus category and filter
links) as the Suspense *fallback* instead of a skeleton, so the static HTML
carries genuine content and links.

**Acceptance:** `pnpm build` then `curl -s localhost:3000/tools | grep -c "/tools/"`
returns one link per tool. Same check for `/compare` options and `/finder` intro
content. Verify with JavaScript disabled, not in the dev console.

**Note:** `oracle-model.tsx` is correctly `ssr: false` — a 3D hero has no business
in the prerender. Leave it.

### 0.3 — "Our editors" credits people who do not exist · You (decision) + Claude · S

`src/data/authors.ts` is **deliberately empty** — the six invented reviewer
personas were removed on purpose (a good call, recorded in the handoff). But the
copy that referenced them was never updated. "Our editors" still appears in at
least ten places:

[page.tsx:26](../src/app/page.tsx#L26) · [page.tsx:76](../src/app/page.tsx#L76) ·
[alternatives:31,77](../src/app/alternatives/%5Bslug%5D/page.tsx#L77) ·
[best:44,88,117](../src/app/best/%5Bcategory%5D/page.tsx#L88) ·
[vs:57](../src/app/vs/%5Bversus%5D/page.tsx#L57) ·
[deals:42](../src/app/deals/page.tsx#L42) ·
[leaderboards:9,35](../src/app/leaderboards/page.tsx#L35) ·
[submit:9,28](../src/app/submit/page.tsx#L28) ·
[submit-form:51](../src/components/submit/submit-form.tsx#L51)

Plus the load-bearing claim itself: "Human-vetted AI tool intelligence"
([oracle-hero.tsx:101](../src/components/home/oracle-hero.tsx#L101)), repeated in
both OG images, `/tools`'s meta description, the footer, and `siteConfig`.

The homepage goes further: "Every tool is used in real workflows by our editors,
not judged from a landing page. We probe strengths, limits, and edge cases."
That is a testable factual claim about a process, attributed to a group that is
empty in the data.

**Do — your decision, one of two:**

1. **Name yourself.** One real, named reviewer with a face and a method beats an
   imaginary department, and it is what the reviewer-profile advice actually
   wants. Replace "our editors" with first-person singular, add the byline to
   `authors.ts` as the single real entry, and keep "human-vetted" honest.
2. **Soften the claim** to "independently curated and reviewed" until 1.2 lands,
   then upgrade the wording back.

Do **not** re-add invented personas — that is the guardrail the handoff already
set, and it is right.

### 0.4 — The hero hard-codes "Search 27 tools…" · Claude · S

[oracle-hero.tsx:123](../src/components/home/oracle-hero.tsx#L123) is a string
literal, not a count. The admin CMS can publish a 28th tool at runtime and this
number will not move — it is wrong the moment the catalogue changes, and nobody
will notice.

This also breaks the project's own stated rule, three files away: the homepage
stat cells carry a comment insisting "Every cell here must be checkable"
([page.tsx:182](../src/app/page.tsx#L182)).

**Do:** drive it from `getAllTools()` like the stat cells, **or** remove the
number entirely — see 3.1, where advertising a small catalogue is the deeper
problem. Removing it fixes both at once and is the recommendation.

### 0.5 — Windows users are shown a Mac shortcut · Claude · S

The handler correctly accepts both (`e.metaKey || e.ctrlKey`,
[command-menu.tsx:107](../src/components/layout/command-menu.tsx#L107)) but the
badge hard-codes `⌘K` in two places:
[site-header.tsx:164](../src/components/layout/site-header.tsx#L164) and
[oracle-hero.tsx:125](../src/components/home/oracle-hero.tsx#L125).

**Do:** detect platform after mount and render `Ctrl K` off-Mac. Render the
neutral form during SSR so the markup does not mismatch on hydration.

### 0.6 — Rate-limit the public write paths · Claude · M

*(carried from the previous list, unchanged in priority)* `outbound_clicks`,
`subscribers` and `tool_submissions` all accept unauthenticated `INSERT` with
`WITH CHECK (true)`. Today's protection is a honeypot and CHECK constraints — no
rate ceiling. Anyone can inflate affiliate click counts, subscribe third-party
addresses, or flood the moderation queue. Use `@vercel/firewall`
`checkRateLimit()` + BotID (`withBotId` / `checkBotId`): first-party, no CAPTCHA,
no new CSP origin.

### 0.7 — Remaining launch blockers *(carried, unchanged)*

| # | Item | Owner |
|---|---|---|
| 0.7a | **Enable leaked-password protection** in Supabase → Auth. One toggle. | You |
| 0.7b | **Configure a Sentry alert rule** so the first real error reaches a human. Scope it to `environment:[production, preview]`: a preview is a production build, so it is where the rate limiter's Deployment-Protection failure fires, and a production-only rule would capture that report while notifying nobody. | You |
| 0.7c | **Decide the newsletter** — addresses are being collected and nothing has ever been sent. Build sending (5.1) or stop collecting. See 2.3 for the cadence contradiction. | You |
| 0.7d | **Wire Playwright into CI**, and cover `/submit` and the admin gate. Specs live in `tests/e2e/` (the "`e2e/` is empty" note here was wrong; that directory does not exist). The real gap is that CI runs only `pnpm verify`, so a spec stayed red for two and a half weeks unnoticed. Signed-in coverage needs a seeded Supabase user plus a Playwright `storageState`, which is a separate decision. | Claude |
| 0.7e | **Verify a real signup end to end** on `enkitools.com` (needs a mailbox). | You |
| 0.7f | **Add a real favicon** — `/favicon.ico` 404s, so the SERP favicon is likely blank. Delete Next's leftover `next.svg`/`vercel.svg`/`globe.svg`/`file.svg`/`window.svg`. | Claude |
| 0.7g | **Final pre-launch sweep** — visual (`pnpm sweep`, every route, both viewports), functional (auth, submit, moderation, saved, collections, compare, finder, `/go/*`), security (`pnpm audit:rls`, `pnpm audit --prod`, Supabase advisors, headers). | Claude + You |

---

## Phase 1 — Earn the claim

Phase 0 stops the site contradicting itself. Phase 1 gives it something to stand on.

### 1.1 — A published scoring rubric · You (method) + Claude (build) · M

Every `editorScore` in the seed sits between **7.5 and 9.1**
([src/data/tools.ts](../src/data/tools.ts)) with no published formula. Combined
with "we only publish tools that earn it", the scale is circular: only good tools
are listed, every listed tool scores well, so the score separates nothing. The
decimal implies a precision that nothing on the site supports — and `/vs/[versus]`
[stakes a verdict on it](../src/app/vs/%5Bversus%5D/page.tsx#L57), telling readers
one tool "edges ahead" on a 0.2 gap.

**Do — pick one:**

1. **Weighted sub-scores.** Capability, usability, value, reliability, privacy,
   each 1–10 with a stated weight; the total is computed, not asserted. Show the
   breakdown on the tool page. Requires a schema change plus a re-score of all 27.
2. **Drop the decimals.** Replace with verdict bands — "Best overall", "Excellent
   for teams", "Good but overpriced", "Only for advanced users". Cheaper, more
   useful, and honest about what a solo reviewer can actually measure.

Option 2 is the better fit for the site's current size; option 1 is the better
destination once 1.2 has produced real testing data. Whichever you choose,
`/vs/[versus]` must stop declaring winners on sub-point differences.

### 1.2 — Evidence-based reviews for the top ten tools · You (testing) + Claude (schema/UI) · L

The reviews are competent editorial summaries — overview, verdict, three
features, two pros, two cons, pricing, marketing screenshots, a score. That
supports "curated". It does not support "vetted", and Google's reviews guidance
explicitly rewards original testing over summary.

**Add to the tool schema and the detail page:**

- Tested by (real name) · Last tested (exact date) · Version or model tested
- What we tested: 3–5 actual workflows
- Results: concrete outputs, time taken, where it failed
- Best for / Avoid if
- Head-to-head against two direct competitors
- Score breakdown (from 1.1)
- Update history
- **Original screenshots from inside the product**, replacing marketing art

`lastVetted` already exists and drives a "Last vetted" trust line plus the admin
re-vet queue — no tool currently sets it. Populating it is step one and is nearly
free.

Ten tools done properly beats twenty-seven done thinly. Do them in traffic order.

### 1.3 — About, editorial policy, and a real contact address · You + Claude · M

There is **no `/about` and no `/contact` route** (confirmed: neither directory
exists). For a site whose product is trust, that is the missing page.

**Ship `/about` covering:** who operates Enki (a named person), how tools are
selected, how scores are calculated (links to 1.1), the affiliate policy, a
corrections process, and how to reach a human.

**Contact address:** `/privacy`, `/terms` and both error boundaries name a
personal Gmail. Vercel has no mailbox product — add MX records pointing at a
forwarder, then swap every reference to `hello@enkitools.com`. Keep **one** SPF
TXT record covering every sender. *(Was D5; promoted, because the legal pages are
part of the trust layer, not a post-launch nicety.)*

`/about` also does double duty for 4.3 — it is the natural home for the two-word
"Enki Tools" phrasing.

---

## Phase 2 — Remove the empty theatre

Unpopulated features do not make a site look bigger. They make it look abandoned.

### 2.1 — Hide community surfaces until they have data · Claude · M

[review-list.tsx:17](../src/components/detail/review-list.tsx#L17) renders "No
written reviews yet — be the first to share your experience" on **every** tool
page, because there are no user reviews at all. Meanwhile `/leaderboards` sits in
the primary nav promising a community ranking, and its copy
([leaderboards/page.tsx:35](../src/app/leaderboards/page.tsx#L35)) describes
"where the experts and the crowd agree, and where they don't" with no crowd.

**Do:** gate on a real threshold. Hide the community tab, the community rating
summary, and the empty review block until a tool has a meaningful number of
approved reviews; hide the community leaderboard until the corpus supports one.
Keep the editor leaderboard — that one has data. `hasVerifiedRatings` already
exists as the flag to hang this on.

Leave the review **submission** entry point visible. Asking for the first review
is fine; advertising a verdict that does not exist is not.

### 2.2 — `/deals` · Claude · S

The page is honest about having no active offers, and it is **not** in the
primary nav (confirmed: `siteConfig.nav` is Directory, Finder, Categories,
Compare, Leaderboards — the external review was wrong about this). Lower stakes
than reported. Still: keep it out of the nav and out of the sitemap until an
offer exists.

### 2.3 — Fix the newsletter cadence contradiction · You · S

[site-footer.tsx:113](../src/components/layout/site-footer.tsx#L113) promises "A
monthly dispatch of the most worthwhile new AI tools", while the broader Enki
plan has been a **weekly** newsletter. Pick one and make the copy match before
another address is collected. Ties into 0.7c.

---

## Phase 3 — Positioning and audience

Everything here is a brand decision — proposals, not prescriptions.

### 3.1 — Stop advertising the catalogue size, start advertising the filter · You · M

"Search 27 tools…" leads with the weakest number on the site. Futurepedia claims
4,000+ and Future Tools 4,200+; breadth is unwinnable and not worth wanting.
Selectivity is the product, so say so:

> **Find the right AI tool without testing ten of them**
> Independent, hands-on reviews for founders, students and operators.
> `[Find my tool]` `[Browse tested tools]`

The scarcity is the pitch: *we tested them so you can skip the trial and error.*
Pairs with 0.4, which removes the hard-coded count anyway.

### 3.2 — Rebuild the taxonomy around intent · Claude · M

The eight categories in [src/data/categories.ts](../src/data/categories.ts) mix
four different classification axes: output type (Image Generation, Video), activity
(Writing & Content, Coding & Dev), benefit (Productivity), and department crossed
with architecture (**Marketing & Agents** — an agent is a product architecture,
not a marketing use case, and the coding, research and productivity tools are
agents too).

**Do:** organise around "what am I trying to accomplish?" — build software, create
images, make videos, research a topic, write and edit, automate repetitive work,
run marketing, study and learn, manage meetings, analyse data. Move platform, AI
type, pricing, audience and integrations to **tags**, which the filter layer
already supports via `getAllTags()`.

**Caution:** category slugs are in the sitemap and in `/best/[category]` URLs.
Any rename needs 301s and an IndexNow push. Do this before traffic accumulates,
or not for a long time.

### 3.3 — Audience entry points · Claude · M

The stated early audience is students, founders and entrepreneurs; the site reads
as a general directory. Curated collections are more useful and more commercially
valuable than "best writing tools", and the `collections` table plus `/lists/[id]`
already exist to build them on:

Best AI tools for students · The solo founder AI stack · AI tools for validating a
business idea · AI tools for studying research papers · AI tools for creating
social content · AI tools for building an MVP · Best free AI tools for new businesses

These are also the natural bridge to the Instagram account and the newsletter.

### 3.4 — Trim the trust vocabulary · You · S

"Trust", "vetted", "oracle", "worth your attention", "worth your trust",
"human-vetted", "skip the hype" recur constantly. Repeating a trust claim without
showing evidence reads as manufacturing authority rather than having it. Once 1.2
ships evidence, the adjectives can come down — show the testing, drop the
telling.

Some taglines are atmosphere where a task label would serve the user better:
"Reclaim the hours the day steals" (Productivity), "Conjure visuals from a
sentence" (Image Generation). Keep the voice on the homepage; prefer plain labels
in the directory, where people are scanning.

---

## Phase 4 — SEO durability

### 4.1 — Thin-content pass on the generated pages · Claude · L

Roughly 100 generated `/best`, `/alternatives` and `/vs` pages make up ~90% of the
sitemap. That is the shape Google's scaled-content and doorway-page guidance
targets. 0.1 fixes the worst symptom (wrong recommendations); this decides which
pages deserve to exist at all.

**Rule:** publish a page only when it can give a genuinely useful answer. Gate
`generateStaticParams` on a real minimum — enough same-category tools, a real
verdict, no padding. Ten excellent comparison pages beat a hundred templated ones.

### 4.2 — Server-rendered content *(delivered by 0.2)*

Kept here as the SEO rationale: it is what makes the internal-link graph real.

### 4.3 — Rank for "Enki tools", two words · Claude · S

*(carried)* The domain and wordmark are one word; people type two. Cheapest first:
add `alternateName: ["Enki Tools", "EnkiTools"]` to the Organization JSON-LD; use
the two-word form naturally in the title tag, the new `/about` page (1.3) and
footer copy, where the exact phrase currently barely appears; add `sameAs`
profiles as they exist; use "Enki Tools" as anchor text in directory submissions.
"Enki" alone is a Sumerian deity — high competition, wrong intent. Target the
qualified phrase.

### 4.4 — Newsletter capture above the footer · Claude · S

Signup lives only in the footer. If the newsletter survives 0.7c, give it a real
homepage placement.

---

## Phase 5 — Internal tools

*(carried, unchanged — these are the "own your stack" projects)*

| # | Item | Owner |
|---|---|---|
| 5.1 | **Self-hosted newsletter, managed from the admin panel** — own sending, list management, composition and delivery reporting. Depends on 5.2. *Reference repo to be supplied.* | Claude |
| 5.2 | **Full admin panel** — a real field-by-field CMS (array editors for `keyFeatures`/`screenshots`/`pros`/`cons`, Supabase Storage uploads for logos and screenshots), replacing today's JSON editor. 1.2's schema additions land here. | Claude |
| 5.3 | **Analytics board inside the admin panel** — `outbound_clicks` already records the money event. *Reference repo to be supplied.* | Claude |

---

## Phase 6 — Post-launch operations and backlog

| # | Item | Owner |
|---|---|---|
| 6.1 | **Supabase Pro for daily backups**, the moment real user data exists. Free tier has none. | You |
| 6.2 | **Watch for the 403 `Vercel Security Checkpoint`** recurring (every URL returned it for ~20 min on 2026-07-29, then self-recovered; cause unconfirmed). A blocker if it hits real users. | Both |
| 6.3 | **Bing Webmaster Tools** — "Import from Google Search Console" carries verification and the sitemap in one step. | You |
| 6.4 | **Remove the transitional `enki-five.vercel.app/auth/callback`** from Supabase redirect URLs. | You |
| 6.5 | **Link-health cron** — ping each tool's site, flag dead links into the re-vet queue. | Claude |
| 6.6 | **Grow to 40–60 genuinely reviewed tools**, not hundreds of listings. Selectivity is the product (3.1). | You |
| 6.7 | **Enforcing nonce-based CSP** — violations now report to Sentry; `script-src` still carries `'unsafe-inline'`. | Claude |
| 6.8 | **Shrink or split the ~909 KB three.js/R3F chunk** — still the largest asset. | Claude |
| 6.9 | **Optimise `public/brand/logo.png` (1.1 MB) and `inspiration.png` (500 KB)**. | Claude |
| 6.10 | **Component-level tests** — React components remain largely untested. | Claude |
| 6.11 | **Real `createdAt`/`updatedAt` on tools** to power an honest RSS feed and "recently added" digest. | Claude |

---

## 7. External review claims that did not survive verification

Checked against the source and **not** carried into the roadmap. Recorded so
nobody spends a session on them.

| Claim | Verdict |
|---|---|
| "'Leave this field empty' is exposed to screen readers; the honeypot needs hiding" | **Already fixed.** [honeypot.tsx](../src/components/shared/honeypot.tsx) carries `aria-hidden`, `tabIndex={-1}`, `pointer-events-none` and off-screen positioning, with a comment explaining the choice. The reviewer was reading raw crawl text, which shows DOM content regardless of the accessibility tree. |
| "Deals occupies prominent navigation space" | **Wrong.** `siteConfig.nav` ([site.ts:76](../src/lib/site.ts#L76)) is Directory, Finder, Categories, Compare, Leaderboards. `/deals` is not in it. Kept as the much smaller 2.2. |
| "'None Paid placements' should read 'No paid placements'" | **Misread.** It is a stat tile — value `None` above label `Paid placements` ([page.tsx:190](../src/app/page.tsx#L190)) — not a sentence. The suggested rewrite would break the value/label pattern the other two cells use. Optionally give the cell an `aria-label` so it reads as a sentence to assistive tech; not worth more. |
| "Templating errors: 'image generationtool', 'audio & voicetool'" | **Not reproducible in the current source.** Every category interpolation checked carries a proper space ([alternatives:75,105](../src/app/alternatives/%5Bslug%5D/page.tsx#L75), [best:44,69,75](../src/app/best/%5Bcategory%5D/page.tsx#L69), [vs:87](../src/app/vs/%5Bversus%5D/page.tsx#L87)). Either already fixed, or the live deployment is behind `main`. **Re-check on enkitools.com after the next deploy** — if it persists, it is a real bug in a spot not yet found. |
| "Add named reviewer profiles" | **Right instinct, wrong implementation for this project.** Six invented personas were deliberately deleted. The fix is to name the one real reviewer (0.3), not to rebuild a fictional department. The reviewer's own follow-up — "a named solo reviewer is more credible than an imaginary editorial department" — is the correct version and is what 0.3 does. |
| "Fabricated per-tool ratings / unexplained scores" | **Half stale.** Fabricated *community* ratings are gone (`hasVerifiedRatings` is `false`, no `rating:` fields in the seed). `editorScore` does still exist and is unexplained — that half is real and is 1.1. |

---

## Sequencing

```
0.1 alternatives ─┐
0.2 prerender    ─┼─► ship together: the credibility floor
0.3 our editors  ─┘
0.4 0.5 0.6 0.7  ─► launch gate
        │
        ▼
1.1 rubric ─► 1.2 evidence reviews ─► 1.3 about/policy   (the actual moat)
        │
        ▼
2.x remove empty theatre ─► 3.x positioning ─► 4.x SEO durability
        │
        ▼
5.x internal tools ─► 6.x operations
```

Phases 0 and 1 are the whole game. Everything after compounds only once the site
can substantiate its own headline.
