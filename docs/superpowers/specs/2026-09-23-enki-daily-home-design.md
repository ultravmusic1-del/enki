# Enki Daily home: design

**Date:** 2026-09-23 · **Status:** approved in conversation, awaiting written review
**Builds on:** `2026-09-22-full-stories-design.md` (full stories with a founder
section are what the newsletter sells). Where the two disagree, this one wins.

## 0. Why

Enki's `/` is a news front page. The owner wants `/` to be a funnel whose one
job is to turn visitors into subscribers of a daily newsletter for founders,
taking heavy inspiration from therundown.ai while staying in Enki's design
language. News, Tools, Finder and Deals stay as they are.

**Success:** a first-time visitor understands the promise and can subscribe
without scrolling, at 390px and 1440px; every section below the hero either
builds trust or leads back to a signup; nothing on the page claims proof Enki
does not have.

**Constraint that shapes everything:** Enki has not sent a newsletter yet. There
is no reader count, no company logos and no issue archive, so none may be
shown or implied. Proof comes from the product itself: today's real stories,
their sources and their founder takeaways.

## 1. Decisions taken

| Question | Decision |
|---|---|
| The newsletter | **Enki Daily**: a free email every weekday morning with the day's key stories and what each means for founders. Replaces "The Tablet" (monthly tools) everywhere. |
| Scope | **Funnel now, sending later.** Building and sending the daily email, and an issue archive, are a separate project. |
| Provider | **beehiiv, free plan**, via its **embedded subscribe form** (iframe + script). No beehiiv API, no API keys. |
| Current front page | **Moves to `/news`**, unchanged in content. |
| Hero | **Direction A, "The Promise"**: one big line, one form, trust ticks, three benefits. |
| Story showcase | **"The Issue"**: today's brief as one framed object with numbered stories and founder takeaways. |
| Sections | Core funnel plus **Trending tools** and a **sticky mobile subscribe bar**. No popups. |
| Placements | **Home, end of full-story pages, footer.** |
| After signup | beehiiv redirects to **`/welcome`** ("You're in"). **No survey** (no API to store answers). |

Mockups approved in the visual companion: `hero-a-v2.html` (hero and "1 · The
Issue"), `page-flow.html` (section order).

## 2. Routes

| Route | Change |
|---|---|
| `/` | New Enki Daily funnel. Server rendered, `revalidate = 300`. |
| `/news` | Renders today's `/` front page as is (beat row, ticker, lead + rail + sidebar, beat sections, latest list, directory band). Adds an "Older stories" link to `/news/page/2`. The plain list's page 1 stops existing as its own page; the front page's lead, rail, beat sections and latest list cover those stories. |
| `/news/page/[page]`, `/news/beat/[beat]`, `/news/[slug]`, `/news/about` | Unchanged, except the story-end signup card (§5.2). |
| `/welcome` | New. `robots: noindex, nofollow`. |
| `/unsubscribe` | Copy rewritten (§5.4); its server action is removed. |

**Nav:** items unchanged. The header's right-hand button becomes **Subscribe**:
on `/` it scrolls to `#subscribe` (the hero form); elsewhere it links to
`/#subscribe`. The existing "Explore" button's destination (`/tools`) remains
reachable through the nav's Tools item.

## 3. The home page, top to bottom

Components live in `src/components/home/`, one job each. All copy below is
final unless marked otherwise, and contains no en or em dashes.

### 3.1 `HomeHero` (`id="subscribe"`)
- Eyebrow pill with a live dot: `Enki Daily · every weekday morning`.
- `h1` (Cardot, uppercase): `AI news for founders.` / `Five minutes a day.`,
  with "Five minutes" in the teal gradient (`#35e4ec → #00adb5 → #6fd3d8`).
- Sub-copy: "The AI stories that matter to your company, written in full from
  the best reporting and distilled into what to do next. Sharper decisions, the
  tools worth adopting, and fewer subscriptions you don't need."
- `BeehiivEmbed form="home"` (§4).
- Trust ticks: `Free` · `One email, weekday mornings` · `Unsubscribe in one click`.
- Benefits row, three columns separated by hairlines (stacked on mobile):
  1. `01 · Build better` / **Insight you can act on** / "Every story ends with
     what it means for your company: costs, risks and openings."
  2. `02 · Stay current` / **The tools worth knowing** / "New models and
     products, judged on whether they deserve a place in your stack."
  3. `03 · Spend less` / **Cut the tools that don't earn it** / "Know when a
     cheaper model or a feature you already pay for does the job."
- Atmosphere: a centred teal bloom, a faint grid masked to the headline area,
  and the site's grain. All absolutely positioned and clipped by design.

### 3.2 `TodaysIssue`
One framed object with a 1px gradient edge (teal to border to teal):
- Masthead row: `Enki Daily` (Cardot) · `Today's brief` (mono, teal) on the
  left; `{weekday} {d} {Mon} · {n} stories · {m} min` (mono) on the right.
- Up to 3 rows, each a link to the story: an outlined numeral (`01`), a beat
  label with a colour chip (a map local to the component: `models-labs`
  `#7c9cff`, `products-launches` `#b58cff`, `funding-business` `#6ed39a`,
  `policy-safety` `#f0a35e`, `research` `#35e4ec`), the headline, the takeaway line
  `For founders → {takeaway}`, and the outlet names stacked on the right
  (under the headline on mobile).
- Footer strip: `And {k} more stories in today's brief.` (omitted when k is 0)
  and `Read today's stories →` linking to `/news`.
- Data: §6.1. Hidden entirely when there are no full stories.

### 3.3 `HowItsMade`
Heading: **Every story, read across the outlets.** Three steps:
1. **Read in full.** "We read every outlet's coverage of an event, not just
   the headline."
2. **Merged and checked.** "The reporting becomes one story, checked against
   its sources, with every outlet credited."
3. **What it means for you.** "Each story ends with what it means for founders:
   costs, platform risk, openings and what to watch."

Live figures line (§6.2): `{s} stories · {o} outlets · {n} sources in
the last 7 days`. Omitted when `s < 3`. Copy never says who or what writes.

### 3.4 `TakeawayAnatomy`
Heading: **What "for founders" looks like.** Renders the lead story's founder
section in full with the existing `ArticleBody` renderer, inside a framed card
with the story's headline and a link to it. Beside or above it (on mobile,
above), a legend of four labels: `Costs` · `Platform risk` · `Openings` ·
`What to watch`. The labels explain the kinds of points a section contains;
they are not attached to individual bullets.

### 3.5 `SubscribeBand` (variant `compact`)
"Get tomorrow's brief before your first meeting." with `BeehiivEmbed form="home"`
(lazy).

### 3.6 `TrendingTools`
Heading: **Tools worth knowing.** Sub: "Featured picks from the Enki
directory, each one vetted." Six tools from `getFeaturedTools()`, reusing the
directory card component. Link: `Browse all tools →` to `/tools`. No sponsored
or affiliate labels in this section.

### 3.7 `HomeFaq`
Native `<details>` items:
- **Is Enki Daily free?** Yes, Enki Daily is free.
- **When does it arrive?** Every weekday morning.
- **How long is it?** About five minutes. Each story is short, and the full
  article is one click away on Enki.
- **Will you share my email?** No. Your address is used only to send Enki Daily.
  The list is managed by our email provider, beehiiv, and is never sold.
- **How do I unsubscribe?** Every email has a one-click unsubscribe link at the
  bottom.

### 3.8 `SubscribeBand` (variant `large`)
Closing band with a strong bloom: `h2` **The brief to read before the day
starts.** Sub: "Free, every weekday morning." `BeehiivEmbed form="home"`
(lazy).

### 3.9 `StickySubscribeBar` (mobile only, below 768px)
A slim bar: `Enki Daily · free, every weekday` and a **Get it** button that
smooth-scrolls to `#subscribe` (instant under reduced motion). It shows when
the hero form has left the viewport and hides while either `SubscribeBand` is
visible (IntersectionObserver). A close button hides it for the session
(`sessionStorage`, every access in try/catch). The page reserves bottom padding
while the bar is visible so it never covers content.

## 4. beehiiv embeds

**Forms (owner creates in beehiiv):**

| Key | beehiiv form name | Redirect after subscribe |
|---|---|---|
| `home` | Enki Daily: Home | `https://enkitools.com/welcome?from=home` |
| `story` | Enki Daily: Story end | `https://enkitools.com/welcome?from=story` |
| `footer` | Enki Daily: Footer | `https://enkitools.com/welcome?from=footer` |

**Form style (set in beehiiv's builder, all three):** transparent or `#16191d`
background; input background `rgba(255,255,255,0.035)`, border `#333b46`,
text `#eeeeee`, placeholder `you@company.com`; button background `#00adb5`,
text `#04171a`, label `Get Enki Daily`; fully rounded corners; the closest
available sans font to Hanken Grotesk. The owner pastes each form's embed code
into the conversation; the spec's plan records the IDs.

**`src/lib/newsletter.ts`:** a typed config `{ home, story, footer }` of embed
IDs (public values, committed), the beehiiv hosted subscribe URL for fallbacks,
and the iframe heights per breakpoint.

**`BeehiivEmbed` (client component):**
- Props: `form: "home" | "story" | "footer"`, `lazy?: boolean`.
- Renders the iframe with `title="Subscribe to Enki Daily"`, fixed height from
  config, full width up to its container, `loading="lazy"` when `lazy`.
- Before load: a skeleton shaped like the pill form (same height), so the
  layout never shifts.
- If the iframe has not fired `load` within 8 seconds, or JS is off
  (`<noscript>`), shows a plain link: `Subscribe to Enki Daily →` to the
  hosted subscribe page.
- When an embed ID is empty (forms not created yet), renders the fallback link
  only. This is the state until the owner provides the IDs.

**beehiiv script:** the embed's loader script and beehiiv's attribution
tracking script are loaded once per page that has an embed, via `next/script`
with `strategy="afterInteractive"`.

**CSP (`next.config.ts`):** add beehiiv's embed and script origins (taken from
the actual embed code) to `script-src` and a new `frame-src`. The policy is
report-only today; this keeps it from reporting every form view.

## 5. Other surfaces

### 5.1 `/welcome`
- `h1`: **You're in.** Sub: "Enki Daily arrives every weekday morning."
- Three short steps: `Check your inbox` (only meaningful if double opt-in is on;
  copy: "If you don't see a confirmation email, check Promotions or Spam.") ·
  `Add us to your contacts` · `Read today's stories` (link to `/news`).
- Below: the `TodaysIssue` frame, reused.
- `from` query param is not displayed; it exists for analytics page views.

### 5.2 Story-end card (`src/app/news/[slug]/page.tsx`)
After the Sources list, on full-story pages only (legacy summary pages keep
their current layout): a framed card, `h2` **Get stories like this every
weekday morning.** Sub: "The day's AI stories for founders, each with what it
means for your company. Free." `BeehiivEmbed form="story" lazy`.

### 5.3 Footer (`site-footer.tsx`)
The newsletter block is renamed to **Enki Daily** with sub "The day's AI stories
for founders, every weekday morning." and `BeehiivEmbed form="footer" lazy`.
The react-hook-form form, `Honeypot` usage there, and the toast are removed.

### 5.4 `/unsubscribe`
Copy: **Unsubscribing from Enki Daily.** "Every Enki Daily email has a one-click
unsubscribe link at the bottom. Use it and you'll stop receiving emails right
away." The form and `src/app/actions/unsubscribe.ts` are removed.

### 5.5 Retired code
`src/app/actions/newsletter.ts` (`subscribe()`), its schema if unused elsewhere,
the unsubscribe form component and action, and their tests. `Honeypot` stays if
any other form still uses it. The `subscribers` table (0 rows) is left in place
for a future API integration; no migration.

### 5.6 Metadata
- `/`: title `Enki Daily: AI news for founders, five minutes a day`;
  description from the hero sub-copy (40 to 160 characters version:
  "The AI stories that matter to your company, with what to do next. Free,
  every weekday morning."). Keeps the Organization/WebSite JSON-LD.
- `/news`: takes today's home title and description.
- Canonicals on both. Sitemap includes `/news`; `/welcome` excluded.
- `siteConfig.description` is unchanged (approved 2026-09-22).

## 6. Data

### 6.1 `getTodaysIssue()` (`src/lib/news/issue.ts`)
- Input: published stories that have a body, newest first, plus their sources.
- Order: the featured story first if it has a body, then by `published_at`
  descending. Take 3.
- `leadDate`: the first story's `published_at`, formatted `Wed 23 Sep` in the
  site's time zone.
- `totalCount`: full stories published on `leadDate`'s calendar day (drives
  "{k} more").
- `minutes`: `max(1, round(sum(body_words of the shown stories) / 230))`.
- Per story: `slug, headline, beat, outlets: string[]` (distinct source names,
  primary first) and `takeaway`.
- `takeaway`: from the body's founder section (existing parser), the first list
  item; its bold lead if present plus the first sentence of the rest, capped at
  160 characters on a word boundary. If there is no founder section, the
  story's summary capped the same way.
- Returns `null` when there are no full stories.

### 6.2 `getMakingStats()` (same file)
Over the last 7 days of published full stories: `stories`, `outlets` (distinct
source names across primaries and merged sources), `sources` (total source
rows). `HowItsMade` hides the figures line when `stories < 3`.

Both functions read through the existing server Supabase client and RLS-safe
paths (`stories` published rows and the anon-callable `story_sources` RPC). No
new tables, columns or RPCs.

## 7. Behaviour and quality

- **Motion:** fade-and-rise section reveals with the existing animation
  tokens; none under `prefers-reduced-motion`.
- **Semantics:** one `h1` (hero), `h2` per section, native `<details>` FAQ,
  visible focus rings, iframe `title`s, contrast at the site's existing levels.
- **Performance:** the page stays a server component; only `BeehiivEmbed` and
  `StickySubscribeBar` are client components. Below-the-fold embeds are lazy.
- **Layout:** no horizontal overflow at 390px; the Issue's outlets move under
  the headline on mobile; benefits and How-it's-made steps stack.

## 8. Testing

- **Unit (Vitest):** `getTodaysIssue` ordering (featured first), full-stories
  filter, fewer than 3, none (`null`), `totalCount` by day, minutes rounding;
  takeaway extraction (bold lead, sentence cut, 160 cap, summary fallback);
  `getMakingStats` counting and the `< 3` rule.
- **Component (Testing Library):** `TodaysIssue` rows, outlets, takeaways and
  "{k} more"; hidden on `null`. `BeehiivEmbed` skeleton, `title`, lazy
  attribute, fallback link on empty ID and after the timeout (fake timers).
  `StickySubscribeBar` visibility from mocked observer entries and the session
  dismissal.
- **Copy guard:** extend `src/lib/brand-copy.test.ts`: the home, welcome and
  story-card copy has no en or em dash, and no reader-count phrasing
  (`/\b\d[\d,.]*\+?\s*(readers|subscribers)\b/i`).
- **E2E (Playwright, local):** `/` shows the hero `h1`, the Issue (when data
  exists) and a subscribe form or its fallback; `/news` shows the lead story;
  `/welcome` renders. CI's e2e job needs its Supabase env first (tracked in
  HANDOFF).
- **Visual sweep:** `pnpm sweep` over `/`, `/news`, `/welcome`, `/unsubscribe`,
  `/tools`, one full story at 390px and 1440px; screenshots of the hero, the
  Issue and the sticky bar on mobile.
- **Honest limit:** until the owner creates the three forms, embeds render the
  fallback link. Real iframe rendering, heights and redirects are verified
  after the embed codes arrive.

## 9. Owner prerequisites

1. Create the beehiiv publication "Enki Daily" (free plan).
2. Create the three forms (§4) with the style and redirects above; paste the
   embed codes into the conversation.
3. Write the welcome email in beehiiv.
4. Decide on double opt-in (the `/welcome` copy works either way).

## 10. Out of scope

Building or sending the daily email; an issue archive; the beehiiv API, the
survey and custom fields; subscriber counts or logos; changes to Tools, Finder
and Deals; a desktop slide-in or any popup.
