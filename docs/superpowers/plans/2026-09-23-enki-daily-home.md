# Enki Daily Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` with a newsletter funnel for Enki Daily (beehiiv embed), move today's front page to `/news`, and add signup placements on story pages, the footer and a `/welcome` page.

**Architecture:** Pure selectors in `src/lib/news/issue.ts` turn recent full stories into "today's issue" and "how it's made" figures; a thin fetch layer in `src/lib/news/issue-data.ts` feeds them. Home sections are server components in `src/components/home/`; only `BeehiivEmbed` and `StickySubscribeBar` are client components. beehiiv owns the list; the old `subscribe()`/unsubscribe actions are retired.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (anon reads), Vitest + Testing Library, Playwright, beehiiv embed (iframe + script).

**Spec:** `docs/superpowers/specs/2026-09-23-enki-daily-home-design.md`

## Global Constraints

- **No en dash (U+2013) or em dash (U+2014)** in any file this plan adds or edits. Never type either character or a backslash-u escape for one; the editing tools decode escapes into real characters. Check touched files with Node, building the pattern with `new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']')`.
- **No reader or subscriber counts**, logos or archive claims anywhere. Copy never says who or what writes Enki.
- Newsletter name is exactly **Enki Daily**. Cadence copy is exactly **every weekday morning**.
- **No new npm dependency.** No beehiiv API, no API keys, no migration.
- Server components by default; `"use client"` only in `beehiiv-embed.tsx` and `sticky-subscribe-bar.tsx`.
- Every `sessionStorage`/`localStorage` access is inside try/catch.
- Visual changes require `pnpm sweep` PASS at 390px and 1440px (CLAUDE.md). In Git Bash prefix sweep with `MSYS_NO_PATHCONV=1` and pass `--base http://localhost:3000`.
- **Git:** work on `main`, no branches, never push. Stage only the files each task names. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook runs `pnpm verify`; never use `--no-verify`.
- Dev server: `preview_start { name: "enki-dev" }`, never started from Bash. Stop it when done.

## Review Focus

1. **Takeaway extraction from real bodies:** a founder bullet with a bold lead ending in ":" or ".", one with a link inside, one with no bold, and a body with no founder section must each produce a clean single line of at most 160 characters with no Markdown syntax left in it. Pinned in Task 1.
2. **Quiet days:** zero full stories must hide The Issue and the anatomy section without errors, and fewer than 3 stories must render only what exists. Pinned in Tasks 1 and 3.
3. **Embed not configured or blocked:** an empty form URL, or an iframe that never loads, must still show a usable path (fallback link, or "Signups open soon." when there is no hosted URL either), never an empty box. Pinned in Task 2.
4. **Sticky bar on phones:** it must never cover the hero form or the bands, must stay hidden after being closed for the session, and must not crash when `sessionStorage` throws. Pinned in Task 4.
5. **Route move:** `/news` must render the old front page (lead story present) and `/` must render the funnel `h1`; `/news/page/2` and story pages keep working. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/news/issue.ts` (create) | Pure: `extractTakeaway`, `founderMarkdown`, `buildIssue`, `makingStats`, types. |
| `src/lib/news/issue.test.ts` (create) | Unit tests for the above. |
| `src/lib/news/issue-data.ts` (create) | Fetch: `getHomeIssueData(now)` via stories helpers. |
| `src/lib/news/stories.ts` (modify) | Add `listRecentFullStories(limit)`. |
| `src/lib/newsletter.ts` (create) | beehiiv form config, script URLs, heights, hosted URL. |
| `src/components/newsletter/beehiiv-embed.tsx` (create) | Client iframe wrapper with skeleton and fallback. |
| `src/components/newsletter/beehiiv-scripts.tsx` (create) | Loads beehiiv embed + attribution scripts once. |
| `src/components/newsletter/beehiiv-embed.test.tsx` (create) | Component tests. |
| `next.config.ts` (modify) | CSP: beehiiv origins in `script-src`, new `frame-src`. |
| `src/components/home/*.tsx` (create) | Hero, Issue, HowItsMade, Anatomy, SubscribeBand, TrendingTools, Faq, StickySubscribeBar. |
| `src/components/home/todays-issue.test.tsx`, `sticky-subscribe-bar.test.tsx` (create) | Component tests. |
| `src/app/page.tsx` (rewrite) | The funnel. |
| `src/app/news/page.tsx` (rewrite) | Today's front page. |
| `src/app/welcome/page.tsx` (create) | Post-signup page. |
| `src/app/news/[slug]/page.tsx` (modify) | Story-end signup card. |
| `src/components/layout/site-footer.tsx`, `site-header.tsx` (modify) | Enki Daily block; Subscribe button. |
| `src/app/unsubscribe/page.tsx` (rewrite) | Explains beehiiv unsubscribe. |
| Retire: `src/app/actions/newsletter.ts`, `src/app/actions/unsubscribe.ts`, `src/components/account/unsubscribe-form.tsx`, `newsletterSchema` | beehiiv owns the list. |
| `tests/e2e/home.spec.ts` (create) | Route smoke tests. |

---

### Task 1: Issue selectors and data

**Files:**
- Create: `src/lib/news/issue.ts`, `src/lib/news/issue.test.ts`, `src/lib/news/issue-data.ts`
- Modify: `src/lib/news/stories.ts` (add one export after `listRecentStories`)

**Interfaces:**
- Consumes: `parseArticleBody`, `splitFounderSection`, `Block`, `Inline` from `@/lib/news/article-body`; `FOUNDER_HEADING` from `@/lib/news/schemas`; `PublicStory`, `getStorySources` from `@/lib/news/stories`; `BeatSlug` from `@/data/beats`.
- Produces:
  - `type IssueStoryInput = { slug: string; headline: string; summary: string; beat: BeatSlug; beatName: string; body: string; bodyWords: number; publishedAt: string; featured: boolean; sources: string[] }`
  - `type IssueStory = { slug: string; headline: string; beat: BeatSlug; beatName: string; outlets: string[]; takeaway: string }`
  - `type Issue = { dateLabel: string; totalCount: number; minutes: number; stories: IssueStory[]; lead: { slug: string; headline: string; founderMarkdown: string | null } }`
  - `type MakingStats = { stories: number; outlets: number; sources: number }`
  - `extractTakeaway(body: string, summary: string): string`
  - `founderMarkdown(body: string): string | null`
  - `buildIssue(inputs: IssueStoryInput[]): Issue | null`
  - `makingStats(inputs: IssueStoryInput[], now: Date): MakingStats`
  - `listRecentFullStories(limit?: number): Promise<(PublicStory & { body: string; bodyWords: number })[]>`
  - `getHomeIssueData(now: Date): Promise<{ issue: Issue | null; stats: MakingStats }>`

- [ ] **Step 1: Write the failing tests** in `src/lib/news/issue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildIssue, extractTakeaway, founderMarkdown, makingStats, type IssueStoryInput } from "@/lib/news/issue";

const FOUNDERS = "## What it means for founders";

function body(bullets: string[]): string {
  return ["Lede paragraph with a [link](https://example.com/a).", "", FOUNDERS, "", ...bullets.map((b) => `- ${b}`)].join("\n");
}

function story(over: Partial<IssueStoryInput> = {}): IssueStoryInput {
  return {
    slug: "s",
    headline: "Headline",
    summary: "A summary that is long enough to be a real standfirst for the story.",
    beat: "policy-safety",
    beatName: "Policy & Safety",
    body: body(["**Weak credentials are exposed:** Two of three used leaked keys. Scan your repos."]),
    bodyWords: 600,
    publishedAt: "2026-09-23T08:00:00Z",
    featured: false,
    sources: ["The Verge"],
    ...over,
  };
}

describe("extractTakeaway", () => {
  it("joins the bold lead and the first sentence", () => {
    expect(extractTakeaway(body(["**Weak credentials are exposed:** Two of three used leaked keys. Scan your repos."]), "x"))
      .toBe("Weak credentials are exposed: Two of three used leaked keys.");
  });

  it("adds a colon when the bold lead has no closing punctuation", () => {
    expect(extractTakeaway(body(["**Verification matters** Budget for review. More text."]), "x"))
      .toBe("Verification matters: Budget for review.");
  });

  it("keeps link text and drops Markdown syntax", () => {
    expect(extractTakeaway(body(["**Watch it.** Read [the filing](https://example.com/f) first. Then act."]), "x"))
      .toBe("Watch it. Read the filing first.");
  });

  it("uses the first sentence when there is no bold lead", () => {
    expect(extractTakeaway(body(["Plan for platforms saying no. They can."]), "x")).toBe("Plan for platforms saying no.");
  });

  it("falls back to the summary when there is no founder section", () => {
    expect(extractTakeaway("Just a paragraph.", "The summary. Second sentence.")).toBe("The summary. Second sentence.");
  });

  it("caps at 160 characters on a word boundary with an ellipsis", () => {
    const long = `**Lead:** ${"word ".repeat(60)}end.`;
    const out = extractTakeaway(body([long]), "x");
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith(String.fromCharCode(0x2026))).toBe(true);
    expect(out.at(-2)).not.toBe(" ");
  });
});

describe("founderMarkdown", () => {
  it("returns the founder heading and everything after it", () => {
    expect(founderMarkdown(body(["**A:** b."]))).toBe(`${FOUNDERS}\n\n- **A:** b.`);
  });
  it("returns null without a founder section", () => {
    expect(founderMarkdown("No section here.")).toBeNull();
  });
});

describe("buildIssue", () => {
  it("returns null with no stories", () => {
    expect(buildIssue([])).toBeNull();
  });

  it("puts the featured story first, then newest first, and takes 3", () => {
    const issue = buildIssue([
      story({ slug: "a", publishedAt: "2026-09-23T09:00:00Z" }),
      story({ slug: "b", publishedAt: "2026-09-23T08:00:00Z", featured: true }),
      story({ slug: "c", publishedAt: "2026-09-22T08:00:00Z" }),
      story({ slug: "d", publishedAt: "2026-09-21T08:00:00Z" }),
    ])!;
    expect(issue.stories.map((s) => s.slug)).toEqual(["b", "a", "c"]);
    expect(issue.lead.slug).toBe("b");
  });

  it("renders what exists when there are fewer than 3", () => {
    expect(buildIssue([story({ slug: "only" })])!.stories).toHaveLength(1);
  });

  it("dedupes outlets in order and labels the lead's date", () => {
    const issue = buildIssue([story({ sources: ["The Verge", "TechCrunch", "The Verge"] })])!;
    expect(issue.stories[0].outlets).toEqual(["The Verge", "TechCrunch"]);
    expect(issue.dateLabel).toBe("Wed 23 Sep");
  });

  it("counts full stories on the lead's day and rounds minutes at 230 wpm", () => {
    const issue = buildIssue([
      story({ slug: "a", publishedAt: "2026-09-23T09:00:00Z", bodyWords: 600 }),
      story({ slug: "b", publishedAt: "2026-09-23T07:00:00Z", bodyWords: 600 }),
      story({ slug: "c", publishedAt: "2026-09-23T06:00:00Z", bodyWords: 600 }),
      story({ slug: "d", publishedAt: "2026-09-23T05:00:00Z", bodyWords: 600 }),
      story({ slug: "e", publishedAt: "2026-09-22T05:00:00Z", bodyWords: 600 }),
    ])!;
    expect(issue.totalCount).toBe(4);
    expect(issue.minutes).toBe(8); // 1800 / 230 = 7.8
  });

  it("gives the lead's founder markdown for the anatomy section", () => {
    expect(buildIssue([story()])!.lead.founderMarkdown).toContain("## What it means for founders");
  });
});

describe("makingStats", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  it("counts stories, distinct outlets and source rows in the last 7 days", () => {
    expect(
      makingStats(
        [
          story({ sources: ["The Verge", "TechCrunch"] }),
          story({ sources: ["The Verge", "Ars Technica", "TechCrunch"] }),
          story({ publishedAt: "2026-09-10T00:00:00Z", sources: ["Old Outlet"] }),
        ],
        now,
      ),
    ).toEqual({ stories: 2, outlets: 3, sources: 5 });
  });
});
```

(The tests build the ellipsis with `String.fromCharCode(0x2026)` so no escape sequence is ever typed.)

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/lib/news/issue.test.ts`
Expected: FAIL, cannot resolve `@/lib/news/issue`.

- [ ] **Step 3: Implement `src/lib/news/issue.ts`**

```ts
import type { BeatSlug } from "@/data/beats";
import { parseArticleBody, splitFounderSection, type Inline } from "@/lib/news/article-body";
import { FOUNDER_HEADING } from "@/lib/news/schemas";

export type IssueStoryInput = {
  slug: string;
  headline: string;
  summary: string;
  beat: BeatSlug;
  beatName: string;
  body: string;
  bodyWords: number;
  publishedAt: string;
  featured: boolean;
  /** Source names, one per source row, the story's own first. */
  sources: string[];
};

export type IssueStory = {
  slug: string;
  headline: string;
  beat: BeatSlug;
  beatName: string;
  outlets: string[];
  takeaway: string;
};

export type Issue = {
  dateLabel: string;
  totalCount: number;
  minutes: number;
  stories: IssueStory[];
  lead: { slug: string; headline: string; founderMarkdown: string | null };
};

export type MakingStats = { stories: number; outlets: number; sources: number };

const ISSUE_SIZE = 3;
const WORDS_PER_MINUTE = 230;
const TAKEAWAY_MAX = 160;
const ELLIPSIS = String.fromCharCode(0x2026);
const DAY_MS = 24 * 60 * 60 * 1000;

function plain(inlines: Inline[]): string {
  return inlines.map((p) => p.text).join("").replace(/\s+/g, " ").trim();
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

function cap(text: string): string {
  if (text.length <= TAKEAWAY_MAX) return text;
  const cut = text.slice(0, TAKEAWAY_MAX - 1);
  const atSpace = cut.lastIndexOf(" ");
  return `${(atSpace > 0 ? cut.slice(0, atSpace) : cut).replace(/[\s,;:]+$/, "")}${ELLIPSIS}`;
}

/** One line for "For founders": the first founder bullet's bold lead plus its first sentence. */
export function extractTakeaway(body: string, summary: string): string {
  const { founders } = splitFounderSection(parseArticleBody(body));
  const list = founders?.find((b) => b.type === "list");
  const item = list && list.type === "list" ? list.items[0] : undefined;
  if (!item) return cap(summary.trim());

  if (item[0]?.type === "bold") {
    const lead = item[0].text.trim();
    const rest = firstSentence(plain(item.slice(1)));
    const joined = /[.:!?]$/.test(lead) ? `${lead} ${rest}` : `${lead}: ${rest}`;
    return cap(joined.trim());
  }
  return cap(firstSentence(plain(item)));
}

/** The founder section as Markdown (heading and everything after), or null. */
export function founderMarkdown(body: string): string | null {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const at = lines.findIndex((l) => l.trimEnd() === `## ${FOUNDER_HEADING}`);
  if (at === -1) return null;
  return lines.slice(at).join("\n").trim();
}

const dayKey = (iso: string) => iso.slice(0, 10);

function dateLabel(iso: string): string {
  const d = new Date(iso);
  // en-US on purpose: en-GB abbreviates September as "Sept" in current ICU.
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month}`;
}

export function buildIssue(inputs: IssueStoryInput[]): Issue | null {
  if (inputs.length === 0) return null;
  const newest = [...inputs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const featured = newest.find((s) => s.featured);
  const ordered = featured ? [featured, ...newest.filter((s) => s !== featured)] : newest;
  const shown = ordered.slice(0, ISSUE_SIZE);
  const lead = shown[0];
  const words = shown.reduce((sum, s) => sum + s.bodyWords, 0);

  return {
    dateLabel: dateLabel(lead.publishedAt),
    totalCount: inputs.filter((s) => dayKey(s.publishedAt) === dayKey(lead.publishedAt)).length,
    minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    stories: shown.map((s) => ({
      slug: s.slug,
      headline: s.headline,
      beat: s.beat,
      beatName: s.beatName,
      outlets: [...new Set(s.sources)],
      takeaway: extractTakeaway(s.body, s.summary),
    })),
    lead: { slug: lead.slug, headline: lead.headline, founderMarkdown: founderMarkdown(lead.body) },
  };
}

export function makingStats(inputs: IssueStoryInput[], now: Date): MakingStats {
  const since = now.getTime() - 7 * DAY_MS;
  const recent = inputs.filter((s) => new Date(s.publishedAt).getTime() >= since);
  const outlets = new Set(recent.flatMap((s) => s.sources));
  return {
    stories: recent.length,
    outlets: outlets.size,
    sources: recent.reduce((sum, s) => sum + s.sources.length, 0),
  };
}
```

- [ ] **Step 4: Run the tests to pass**

Run: `pnpm vitest run src/lib/news/issue.test.ts`
Expected: PASS (all). If the ellipsis assertion fails on the trailing-space check, fix `cap`, not the test.

- [ ] **Step 5: Add `listRecentFullStories` to `src/lib/news/stories.ts`** (after `listRecentStories`, reusing that file's private `withTimeout`, `toPublicStory`, `PUBLIC_STORY_COLUMNS`, `createAnonClient`):

```ts
export type FullStory = PublicStory & { body: string; bodyWords: number };

/** Newest published stories that have a full body. Empty on failure. */
export async function listRecentFullStories(limit: number = 30): Promise<FullStory[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(`${PUBLIC_STORY_COLUMNS}, body, body_words`)
      .eq("status", "published")
      .not("body", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit),
    "listRecentFullStories",
  );
  const rows = (result?.data ?? []) as unknown as (PublicStoryRow & { body: string | null; body_words: number | null })[];
  return rows.flatMap((row) => {
    const story = toPublicStory(row);
    return story && row.body ? [{ ...story, body: row.body, bodyWords: row.body_words ?? 0 }] : [];
  });
}
```

- [ ] **Step 6: Create `src/lib/news/issue-data.ts`**

```ts
import { buildIssue, makingStats, type Issue, type IssueStoryInput, type MakingStats } from "@/lib/news/issue";
import { getStorySources, listRecentFullStories } from "@/lib/news/stories";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's issue and the last 7 days' figures, from published full stories. Never throws. */
export async function getHomeIssueData(now: Date): Promise<{ issue: Issue | null; stats: MakingStats }> {
  const stories = await listRecentFullStories(30);
  const since = now.getTime() - 7 * DAY_MS;
  const needed = stories.filter((s, i) => i < 3 || s.featured || new Date(s.publishedAt).getTime() >= since);
  const inputs: IssueStoryInput[] = await Promise.all(
    needed.map(async (s) => {
      const sources = await getStorySources(s.id);
      return {
        slug: s.slug,
        headline: s.headline,
        summary: s.summary,
        beat: s.beat,
        beatName: s.beatName,
        body: s.body,
        bodyWords: s.bodyWords,
        publishedAt: s.publishedAt,
        featured: s.featured,
        sources: sources.length > 0 ? sources.map((x) => x.name) : [s.sourceName],
      };
    }),
  );
  return { issue: buildIssue(inputs), stats: makingStats(inputs, now) };
}
```

- [ ] **Step 7: Verify**

Run: `pnpm vitest run src/lib/news` then `pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/news/issue.ts src/lib/news/issue.test.ts src/lib/news/issue-data.ts src/lib/news/stories.ts
git commit -m "feat(news): today's issue and how-it's-made figures from full stories"
```

---

### Task 2: beehiiv embed, config and CSP

**Files:**
- Create: `src/lib/newsletter.ts`, `src/components/newsletter/beehiiv-embed.tsx`, `src/components/newsletter/beehiiv-scripts.tsx`, `src/components/newsletter/beehiiv-embed.test.tsx`
- Modify: `next.config.ts` (the `csp` array)

**Interfaces:**
- Produces:
  - `type NewsletterForm = "home" | "story" | "footer"`
  - `NEWSLETTER: { name: "Enki Daily"; forms: Record<NewsletterForm, { src: string; height: number; mobileHeight: number }>; hostedUrl: string }`
  - `BEEHIIV_EMBED_SCRIPT`, `BEEHIIV_ATTRIBUTION_SCRIPT` (string URLs)
  - `<BeehiivEmbed form={NewsletterForm} lazy?={boolean} className?={string} />` (client)
  - `<BeehiivScripts />` (client, renders two `next/script` tags; render once per page that has an embed)

- [ ] **Step 1: Write the failing tests** in `src/components/newsletter/beehiiv-embed.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const config = vi.hoisted(() => ({
  NEWSLETTER: {
    name: "Enki Daily",
    hostedUrl: "",
    forms: {
      home: { src: "", height: 56, mobileHeight: 112 },
      story: { src: "", height: 56, mobileHeight: 112 },
      footer: { src: "", height: 56, mobileHeight: 112 },
    },
  },
}));
vi.mock("@/lib/newsletter", () => config);

const { BeehiivEmbed } = await import("@/components/newsletter/beehiiv-embed");

describe("BeehiivEmbed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    config.NEWSLETTER.forms.home.src = "";
    config.NEWSLETTER.hostedUrl = "";
  });

  it("says signups open soon when neither the form nor the hosted page exists", () => {
    render(<BeehiivEmbed form="home" />);
    expect(screen.getByText("Signups open soon.")).toBeTruthy();
    expect(screen.queryByTitle("Subscribe to Enki Daily")).toBeNull();
  });

  it("links to the hosted page when the form is not configured", () => {
    config.NEWSLETTER.hostedUrl = "https://enkidaily.beehiiv.com/subscribe";
    render(<BeehiivEmbed form="home" />);
    expect(screen.getByRole("link", { name: /Subscribe to Enki Daily/ }).getAttribute("href")).toBe(
      "https://enkidaily.beehiiv.com/subscribe",
    );
  });

  it("renders a titled iframe with a skeleton, lazily when asked", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    render(<BeehiivEmbed form="home" lazy />);
    const frame = screen.getByTitle("Subscribe to Enki Daily");
    expect(frame.getAttribute("src")).toBe("https://subscribe-forms.beehiiv.com/abc");
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(screen.getByTestId("embed-skeleton")).toBeTruthy();
  });

  it("hides the skeleton once the iframe loads", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    render(<BeehiivEmbed form="home" />);
    act(() => {
      screen.getByTitle("Subscribe to Enki Daily").dispatchEvent(new Event("load"));
    });
    expect(screen.queryByTestId("embed-skeleton")).toBeNull();
  });

  it("shows the fallback if the iframe has not loaded after 8 seconds", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    config.NEWSLETTER.hostedUrl = "https://enkidaily.beehiiv.com/subscribe";
    render(<BeehiivEmbed form="home" />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByRole("link", { name: /Subscribe to Enki Daily/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/components/newsletter/beehiiv-embed.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/lib/newsletter.ts`**

```ts
/**
 * Enki Daily signup, via beehiiv's embedded subscribe forms (free plan, no API).
 *
 * The `src` values are the iframe URLs from each form's embed code in beehiiv
 * (Subscribe forms > form > Embed). They are public. Empty until the owner
 * creates the forms; BeehiivEmbed then renders its fallback.
 *
 * Each form redirects to /welcome?from=<key> after signup (set in beehiiv),
 * which is how Vercel Analytics attributes signups to a placement.
 */
export type NewsletterForm = "home" | "story" | "footer";

type FormConfig = { src: string; height: number; mobileHeight: number };

export const NEWSLETTER: { name: "Enki Daily"; hostedUrl: string; forms: Record<NewsletterForm, FormConfig> } = {
  name: "Enki Daily",
  /** beehiiv's hosted subscribe page, e.g. https://<publication>.beehiiv.com/subscribe. */
  hostedUrl: "",
  forms: {
    home: { src: "", height: 56, mobileHeight: 112 },
    story: { src: "", height: 56, mobileHeight: 112 },
    footer: { src: "", height: 56, mobileHeight: 112 },
  },
};

export const BEEHIIV_EMBED_SCRIPT = "https://subscribe-forms.beehiiv.com/embed.js";
export const BEEHIIV_ATTRIBUTION_SCRIPT = "https://subscribe-forms.beehiiv.com/attribution.js";
```

- [ ] **Step 4: Create `src/components/newsletter/beehiiv-embed.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { NEWSLETTER, type NewsletterForm } from "@/lib/newsletter";
import { cn } from "@/lib/utils";

const LOAD_TIMEOUT_MS = 8000;

function Fallback() {
  if (!NEWSLETTER.hostedUrl) {
    return <p className="text-sm text-muted-foreground">Signups open soon.</p>;
  }
  return (
    <a
      href={NEWSLETTER.hostedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] shadow-glow-sm hover:bg-teal-bright"
    >
      Subscribe to Enki Daily
      <span aria-hidden="true">&rarr;</span>
    </a>
  );
}

/** A beehiiv subscribe form. Reserves its height so the page never shifts. */
export function BeehiivEmbed({ form, lazy = false, className }: { form: NewsletterForm; lazy?: boolean; className?: string }) {
  const config = NEWSLETTER.forms[form];
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!config.src || loaded) return;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [config.src, loaded]);

  if (!config.src || (timedOut && !loaded)) {
    return (
      <div className={cn("flex min-h-11 items-center", className)}>
        <Fallback />
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ ["--embed-h" as string]: `${config.mobileHeight}px`, ["--embed-h-sm" as string]: `${config.height}px` }}
    >
      {!loaded ? (
        <div
          data-testid="embed-skeleton"
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-full border border-border bg-white/[0.035]"
        />
      ) : null}
      <iframe
        src={config.src}
        title="Subscribe to Enki Daily"
        loading={lazy ? "lazy" : "eager"}
        onLoad={() => setLoaded(true)}
        className={cn(
          "relative block h-[var(--embed-h)] w-full border-0 bg-transparent sm:h-[var(--embed-h-sm)]",
          !loaded && "opacity-0",
        )}
        scrolling="no"
      />
      <noscript>
        <a href={NEWSLETTER.hostedUrl || "/"}>Subscribe to Enki Daily</a>
      </noscript>
    </div>
  );
}
```

`onLoad` via React covers the test's dispatched `load` event because React attaches the listener to the iframe element; if the test's `dispatchEvent` does not reach React's handler in jsdom, switch the test to `fireEvent.load(frame)` from Testing Library (same intent).

- [ ] **Step 5: Create `src/components/newsletter/beehiiv-scripts.tsx`**

```tsx
"use client";

import Script from "next/script";
import { BEEHIIV_ATTRIBUTION_SCRIPT, BEEHIIV_EMBED_SCRIPT, NEWSLETTER } from "@/lib/newsletter";

/** beehiiv's loader and UTM attribution scripts. Render once on a page with an embed. */
export function BeehiivScripts() {
  const any = Object.values(NEWSLETTER.forms).some((f) => f.src);
  if (!any) return null;
  return (
    <>
      <Script src={BEEHIIV_EMBED_SCRIPT} strategy="afterInteractive" />
      <Script src={BEEHIIV_ATTRIBUTION_SCRIPT} strategy="afterInteractive" />
    </>
  );
}
```

- [ ] **Step 6: Update the CSP in `next.config.ts`.** In the `csp` array, change the `script-src` line and add a `frame-src` line directly after it:

```ts
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://subscribe-forms.beehiiv.com https://embeds.beehiiv.com",
  // beehiiv's embedded subscribe forms (Enki Daily). Both hosts appear in
  // beehiiv's embed codes; keep them in sync with src/lib/newsletter.ts.
  "frame-src 'self' https://subscribe-forms.beehiiv.com https://embeds.beehiiv.com",
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm vitest run src/components/newsletter` then `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/newsletter.ts src/components/newsletter/beehiiv-embed.tsx src/components/newsletter/beehiiv-scripts.tsx src/components/newsletter/beehiiv-embed.test.tsx next.config.ts
git commit -m "feat(newsletter): beehiiv embed with skeleton and fallback, CSP for beehiiv"
```

---

### Task 3: Home sections

**Files:**
- Create in `src/components/home/`: `home-hero.tsx`, `todays-issue.tsx`, `how-its-made.tsx`, `takeaway-anatomy.tsx`, `subscribe-band.tsx`, `trending-tools.tsx`, `home-faq.tsx`, `todays-issue.test.tsx`

**Interfaces:**
- Consumes: `Issue`, `MakingStats` (Task 1); `BeehiivEmbed` (Task 2); `ArticleBody` from `@/components/news/article-body` (`<ArticleBody body={string} />`); `ToolCard` from `@/components/shared/tool-card` (`{ tool, categoryName?, className? }`); `Container` from `@/components/shared/container`; `Tool` from `@/lib/schemas`.
- Produces (all server components):
  - `<HomeHero />` (root element has `id="subscribe"`)
  - `<TodaysIssue issue={Issue | null} />` (renders `null` when issue is null)
  - `<HowItsMade stats={MakingStats} />`
  - `<TakeawayAnatomy issue={Issue | null} />` (null when no issue or no founder markdown)
  - `<SubscribeBand variant="compact" | "large" id?={string} />`
  - `<TrendingTools tools={Tool[]} />` (renders null when empty)
  - `<HomeFaq />`

Design language (from the approved mockup `hero-a-v2.html`): Cardot for display (`font-display`, uppercase via the headings' existing style), `font-mono` uppercase tracking for eyebrows, `bg-card/60 ring-hairline border-border` surfaces, teal `#00adb5` / bright `#35e4ec`, absolute-positioned blooms clipped by `overflow-hidden` on the section (the sweep skips absolute children by design).

- [ ] **Step 1: Write the failing test** `src/components/home/todays-issue.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TodaysIssue } from "@/components/home/todays-issue";
import type { Issue } from "@/lib/news/issue";

const ISSUE: Issue = {
  dateLabel: "Wed 23 Sep",
  totalCount: 4,
  minutes: 8,
  lead: { slug: "gemini", headline: "Gemini", founderMarkdown: null },
  stories: [
    { slug: "gemini", headline: "Gemini hacked three companies", beat: "policy-safety", beatName: "Policy & Safety", outlets: ["The Verge", "Ars Technica"], takeaway: "Scan your repos." },
    { slug: "muse", headline: "Amazon blocks Muse", beat: "products-launches", beatName: "Products & Launches", outlets: ["TechCrunch"], takeaway: "Plan for platforms saying no." },
  ],
};

describe("TodaysIssue", () => {
  afterEach(cleanup);

  it("renders nothing without an issue", () => {
    const { container } = render(<TodaysIssue issue={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("numbers the stories and links each one", () => {
    render(<TodaysIssue issue={ISSUE} />);
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("02")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gemini hacked three companies/ }).getAttribute("href")).toBe("/news/gemini");
  });

  it("shows takeaways, outlets, the masthead and the remaining count", () => {
    render(<TodaysIssue issue={ISSUE} />);
    expect(screen.getByText("Scan your repos.")).toBeTruthy();
    // Outlets render twice by design (a row on mobile, a column on desktop).
    expect(screen.getAllByText("Ars Technica").length).toBeGreaterThan(0);
    expect(screen.getByText("Wed 23 Sep · 4 stories · 8 min")).toBeTruthy();
    expect(screen.getByText("And 2 more stories in today's brief.")).toBeTruthy();
  });

  it("omits the remaining count when every story is shown", () => {
    render(<TodaysIssue issue={{ ...ISSUE, totalCount: 2 }} />);
    expect(screen.queryByText(/more stor/)).toBeNull();
  });
});
```

Note: `totalCount` 4 with 2 shown gives "And 2 more stories"; with exactly 1 remaining the copy is "And 1 more story in today's brief."

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/components/home/todays-issue.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `todays-issue.tsx`**

```tsx
import Link from "next/link";
import type { BeatSlug } from "@/data/beats";
import type { Issue } from "@/lib/news/issue";

const BEAT_COLOUR: Record<BeatSlug, string> = {
  "models-labs": "#7c9cff",
  "products-launches": "#b58cff",
  "funding-business": "#6ed39a",
  "policy-safety": "#f0a35e",
  research: "#35e4ec",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function TodaysIssue({ issue }: { issue: Issue | null }) {
  if (!issue) return null;
  const remaining = issue.totalCount - issue.stories.length;

  return (
    <section aria-labelledby="todays-issue" className="relative">
      <h2 id="todays-issue" className="sr-only">Today&apos;s brief</h2>
      <div className="mx-auto max-w-4xl rounded-[1.1rem] bg-[linear-gradient(135deg,rgba(53,228,236,0.45),rgba(42,49,59,0.6)_35%,rgba(42,49,59,0.6)_70%,rgba(0,173,181,0.35))] p-px shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
        <div className="overflow-hidden rounded-[calc(1.1rem-1px)] bg-[linear-gradient(180deg,#1d232c,#191e25)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="font-display text-base font-semibold uppercase">Enki Daily</span>
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-teal uppercase">Today&apos;s brief</span>
            </div>
            <span className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
              {`${issue.dateLabel} · ${issue.totalCount} stories · ${issue.minutes} min`}
            </span>
          </div>

          <ol>
            {issue.stories.map((story, i) => (
              <li key={story.slug} className="border-b border-border last:border-b-0">
                <Link
                  href={`/news/${story.slug}`}
                  className="group grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 px-5 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-6"
                >
                  <span aria-hidden="true" className="font-display text-2xl font-semibold text-transparent [-webkit-text-stroke:1px_#3b4552] group-hover:[-webkit-text-stroke:1px_#35e4ec]">
                    {pad(i + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                      <i aria-hidden="true" className="inline-block size-1.5 rounded-[2px]" style={{ background: BEAT_COLOUR[story.beat] }} />
                      {story.beatName}
                    </span>
                    <span className="mt-1.5 block text-base font-semibold text-pretty break-words text-foreground group-hover:text-teal-bright">
                      {story.headline}
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-pretty text-[#d3dae1]">
                      <b className="font-semibold text-teal-bright">For founders &rarr; </b>
                      <span>{story.takeaway}</span>
                    </span>
                    <span className="mt-3 flex flex-wrap gap-1.5 sm:hidden">
                      {story.outlets.map((o) => (
                        <span key={o} className="rounded-md border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{o}</span>
                      ))}
                    </span>
                  </span>
                  <span className="hidden flex-col items-end gap-1 sm:flex">
                    {story.outlets.map((o) => (
                      <span key={o} className="rounded-md border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{o}</span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-teal/[0.06] px-5 py-3 sm:px-6">
            <span className="text-sm text-muted-foreground">
              {remaining > 0 ? `And ${remaining} more ${remaining === 1 ? "story" : "stories"} in today's brief.` : ""}
            </span>
            <Link href="/news" className="text-sm font-semibold text-teal-bright hover:underline">
              Read today&apos;s stories &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Outlets render twice (a row under the headline on mobile, a column on desktop), which is why the test uses `getAllByText`.

- [ ] **Step 4: Run the test to pass**

Run: `pnpm vitest run src/components/home/todays-issue.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create `home-hero.tsx`**

```tsx
import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";

const BENEFITS = [
  { k: "01 · Build better", t: "Insight you can act on", d: "Every story ends with what it means for your company: costs, risks and openings." },
  { k: "02 · Stay current", t: "The tools worth knowing", d: "New models and products, judged on whether they deserve a place in your stack." },
  { k: "03 · Spend less", t: "Cut the tools that don't earn it", d: "Know when a cheaper model or a feature you already pay for does the job." },
];

const TRUST = ["Free", "One email, weekday mornings", "Unsubscribe in one click"];

export function HomeHero() {
  return (
    <section id="subscribe" className="relative scroll-mt-28 overflow-hidden rounded-[1.75rem] border border-border px-5 pt-16 pb-12 text-center sm:px-10 sm:pt-20">
      <div aria-hidden="true" className="pointer-events-none absolute top-16 left-1/2 h-[360px] w-[640px] max-w-[140%] -translate-x-1/2 rounded-full bg-teal/25 blur-[80px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_30%,#000_30%,transparent_75%)]"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-bright/20 bg-teal/[0.07] py-1.5 pr-3 pl-2">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-teal-bright shadow-[0_0_0_4px_rgba(53,228,236,0.15)]" />
          <span className="font-mono text-[0.65rem] tracking-[0.18em] text-[#cfe9ea] uppercase">Enki Daily · every weekday morning</span>
        </p>
        <h1 className="mt-6 font-display text-4xl leading-[1.02] font-semibold text-balance uppercase sm:text-6xl">
          AI news for founders.
          <br />
          <span className="bg-[linear-gradient(90deg,#35e4ec,#00adb5_60%,#6fd3d8)] bg-clip-text text-transparent">Five minutes</span> a day.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-[#aeb7c1] sm:text-lg">
          The AI stories that matter to your company, written in full from the best reporting and distilled into what to
          do next. Sharper decisions, the tools worth adopting, and fewer subscriptions you don&apos;t need.
        </p>
        <BeehiivEmbed form="home" className="mt-7 max-w-md" />
        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {TRUST.map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-full bg-teal/15 text-[0.55rem] text-teal-bright">&#10003;</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto mt-10 grid max-w-3xl border-t border-border text-left sm:grid-cols-3">
        {BENEFITS.map((b, i) => (
          <div key={b.k} className={i > 0 ? "border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pl-5" : "pt-4 sm:pr-5"}>
            <p className="font-mono text-[0.65rem] tracking-[0.16em] text-teal uppercase">{b.k}</p>
            <p className="mt-1.5 text-sm font-semibold">{b.t}</p>
            <p className="mt-1 pb-4 text-[0.8rem] leading-relaxed text-muted-foreground">{b.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `how-its-made.tsx`**

```tsx
import type { MakingStats } from "@/lib/news/issue";

const STEPS = [
  { t: "Read in full.", d: "We read every outlet's coverage of an event, not just the headline." },
  { t: "Merged and checked.", d: "The reporting becomes one story, checked against its sources, with every outlet credited." },
  { t: "What it means for you.", d: "Each story ends with what it means for founders: costs, platform risk, openings and what to watch." },
];

export function HowItsMade({ stats }: { stats: MakingStats }) {
  return (
    <section aria-labelledby="how-its-made" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">How it&apos;s made</p>
        <h2 id="how-its-made" className="font-display text-3xl font-semibold text-balance uppercase">
          Every story, read across the outlets.
        </h2>
        {stats.stories >= 3 ? (
          <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {`${stats.stories} stories · ${stats.outlets} outlets · ${stats.sources} sources merged in the last 7 days`}
          </p>
        ) : null}
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.t} className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 ring-hairline">
            <span aria-hidden="true" className="absolute -top-6 -right-2 font-display text-8xl font-semibold text-white/[0.03]">{i + 1}</span>
            <p className="relative font-semibold">{s.t}</p>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 7: Create `takeaway-anatomy.tsx`**

```tsx
import Link from "next/link";
import { ArticleBody } from "@/components/news/article-body";
import type { Issue } from "@/lib/news/issue";

const LABELS = ["Costs", "Platform risk", "Openings", "What to watch"];

export function TakeawayAnatomy({ issue }: { issue: Issue | null }) {
  const markdown = issue?.lead.founderMarkdown;
  if (!issue || !markdown) return null;
  return (
    <section aria-labelledby="takeaway-anatomy" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">The part you read it for</p>
        <h2 id="takeaway-anatomy" className="font-display text-3xl font-semibold text-balance uppercase">
          What &ldquo;for founders&rdquo; looks like.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every story closes with two to four points like these, drawn from the reporting and written for people running a company.
        </p>
        <ul className="flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <li key={l} className="rounded-full border border-teal-bright/25 px-3 py-1 font-mono text-[0.65rem] tracking-[0.14em] text-teal-bright uppercase">{l}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card/60 p-6 ring-hairline">
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">From today&apos;s lead story</p>
        <Link href={`/news/${issue.lead.slug}`} className="mt-2 block font-semibold text-pretty hover:text-teal-bright">
          {issue.lead.headline}
        </Link>
        <div className="mt-4">
          <ArticleBody body={markdown} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Create `subscribe-band.tsx`**

```tsx
import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";
import { cn } from "@/lib/utils";

export function SubscribeBand({ variant, id }: { variant: "compact" | "large"; id?: string }) {
  const large = variant === "large";
  return (
    <section
      id={id}
      data-subscribe-band
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border border-border text-center",
        large ? "px-5 py-16 sm:px-10 sm:py-20" : "px-5 py-10 sm:px-10",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-teal/20 blur-[80px]",
          large ? "top-1/2 h-[320px] w-[620px] max-w-[140%] -translate-y-1/2" : "-top-24 h-[220px] w-[520px] max-w-[140%]",
        )}
      />
      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
        {large ? (
          <>
            <h2 className="font-display text-3xl font-semibold text-balance uppercase sm:text-4xl">
              The brief founders read before the day starts.
            </h2>
            <p className="text-muted-foreground">Free, every weekday morning.</p>
          </>
        ) : (
          <h2 className="text-lg font-semibold text-balance">Get tomorrow&apos;s brief before your first meeting.</h2>
        )}
        <BeehiivEmbed form="home" lazy className="max-w-md" />
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Create `trending-tools.tsx`**

```tsx
import Link from "next/link";
import { ToolCard } from "@/components/shared/tool-card";
import type { Tool } from "@/lib/schemas";

export function TrendingTools({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="trending-tools" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Stay current</p>
          <h2 id="trending-tools" className="font-display text-3xl font-semibold uppercase">Tools worth knowing.</h2>
          <p className="text-sm text-muted-foreground">The products our stories keep coming back to.</p>
        </div>
        <Link href="/tools" className="text-sm font-semibold text-teal hover:text-teal-bright">Browse all tools &rarr;</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Create `home-faq.tsx`**

```tsx
const FAQ = [
  { q: "Is Enki Daily free?", a: "Yes, Enki Daily is free." },
  { q: "When does it arrive?", a: "Every weekday morning." },
  { q: "How long is it?", a: "About five minutes. Each story is short, and the full article is one click away on Enki." },
  { q: "Will you share my email?", a: "No. Your address is used only to send Enki Daily. The list is managed by our email provider, beehiiv, and is never sold." },
  { q: "How do I unsubscribe?", a: "Every email has a one-click unsubscribe link at the bottom." },
];

export function HomeFaq() {
  return (
    <section aria-labelledby="home-faq" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h2 id="home-faq" className="text-center font-display text-3xl font-semibold uppercase">Before you subscribe</h2>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card/60 ring-hairline">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group px-5 py-4 sm:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="text-teal transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 11: Verify**

Run: `pnpm vitest run src/components/home` then `pnpm typecheck` then `pnpm lint`
Expected: PASS. Run the dash check (Global Constraints) on every file in `src/components/home/`.

- [ ] **Step 12: Commit**

```bash
git add src/components/home/home-hero.tsx src/components/home/todays-issue.tsx src/components/home/todays-issue.test.tsx src/components/home/how-its-made.tsx src/components/home/takeaway-anatomy.tsx src/components/home/subscribe-band.tsx src/components/home/trending-tools.tsx src/components/home/home-faq.tsx
git commit -m "feat(home): Enki Daily hero, today's issue, how it's made, anatomy, tools, FAQ"
```

---

### Task 4: Sticky mobile subscribe bar

**Files:**
- Create: `src/components/home/sticky-subscribe-bar.tsx`, `src/components/home/sticky-subscribe-bar.test.tsx`

**Interfaces:**
- Consumes: `#subscribe` (hero, Task 3) and `[data-subscribe-band]` sections (Task 3).
- Produces: `<StickySubscribeBar />` (client). Pure helper `export function barVisible(state: { heroVisible: boolean; bandVisible: boolean; dismissed: boolean }): boolean`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StickySubscribeBar, barVisible } from "@/components/home/sticky-subscribe-bar";

type Callback = (entries: { target: Element; isIntersecting: boolean }[]) => void;
let observers: { cb: Callback; targets: Element[] }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      cb: Callback;
      targets: Element[] = [];
      constructor(cb: Callback) {
        this.cb = cb;
        observers.push(this);
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  document.body.innerHTML = '<section id="subscribe"></section><section data-subscribe-band></section>';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  try {
    sessionStorage.clear();
  } catch {}
});

function report(selector: string, isIntersecting: boolean) {
  const el = document.querySelector(selector)!;
  act(() => {
    for (const o of observers) if (o.targets.includes(el)) o.cb([{ target: el, isIntersecting }]);
  });
}

describe("barVisible", () => {
  it("shows only when the hero and bands are off screen and not dismissed", () => {
    expect(barVisible({ heroVisible: false, bandVisible: false, dismissed: false })).toBe(true);
    expect(barVisible({ heroVisible: true, bandVisible: false, dismissed: false })).toBe(false);
    expect(barVisible({ heroVisible: false, bandVisible: true, dismissed: false })).toBe(false);
    expect(barVisible({ heroVisible: false, bandVisible: false, dismissed: true })).toBe(false);
  });
});

describe("StickySubscribeBar", () => {
  it("appears once the hero scrolls away and hides over a band", () => {
    render(<StickySubscribeBar />);
    report("#subscribe", true);
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
    report("#subscribe", false);
    expect(screen.getByRole("region", { name: "Subscribe to Enki Daily" })).toBeTruthy();
    report("[data-subscribe-band]", true);
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
  });

  it("stays closed for the session after dismissal", () => {
    const { unmount } = render(<StickySubscribeBar />);
    report("#subscribe", false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
    unmount();
    render(<StickySubscribeBar />);
    report("#subscribe", false);
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
  });

  it("still works when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<StickySubscribeBar />);
    report("#subscribe", false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/components/home/sticky-subscribe-bar.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `sticky-subscribe-bar.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

const KEY = "enki-daily-bar-dismissed";

export function barVisible(s: { heroVisible: boolean; bandVisible: boolean; dismissed: boolean }): boolean {
  return !s.heroVisible && !s.bandVisible && !s.dismissed;
}

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Phones only: a slim bar that returns the reader to the hero form. */
export function StickySubscribeBar() {
  const [heroVisible, setHeroVisible] = useState(true);
  const [bandVisible, setBandVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    const hero = document.getElementById("subscribe");
    const bands = Array.from(document.querySelectorAll("[data-subscribe-band]"));
    const visibleBands = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        else {
          if (entry.isIntersecting) visibleBands.add(entry.target);
          else visibleBands.delete(entry.target);
          setBandVisible(visibleBands.size > 0);
        }
      }
    });
    if (hero) observer.observe(hero);
    bands.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, []);

  if (!barVisible({ heroVisible, bandVisible, dismissed })) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Private mode or blocked storage: closed for this page view only.
    }
  };

  const toForm = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("subscribe")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <section
      aria-label="Subscribe to Enki Daily"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-full border border-border bg-[#1b2028]/95 py-2 pr-2 pl-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur md:hidden"
    >
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold">Enki Daily</span>
        <span className="text-muted-foreground"> · free, every weekday</span>
      </p>
      <button type="button" onClick={toForm} className="h-9 shrink-0 rounded-full bg-teal px-4 text-sm font-semibold text-[#04171a]">
        Get it
      </button>
      <button type="button" onClick={dismiss} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
        &times;
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run to pass**

Run: `pnpm vitest run src/components/home/sticky-subscribe-bar.test.tsx`
Expected: PASS. (The "stays closed" test relies on real `sessionStorage` in jsdom.)

- [ ] **Step 5: Commit**

```bash
git add src/components/home/sticky-subscribe-bar.tsx src/components/home/sticky-subscribe-bar.test.tsx
git commit -m "feat(home): sticky mobile Enki Daily bar that returns to the hero form"
```

---

### Task 5: Routes: funnel at `/`, front page at `/news`, header Subscribe

**Files:**
- Modify (rewrite): `src/app/page.tsx`, `src/app/news/page.tsx`
- Modify: `src/components/layout/site-header.tsx` (the desktop "Explore" link only)
- Create: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 to 4; `getFeaturedTools` from `@/lib/content`; `siteConfig` from `@/lib/site`.

- [ ] **Step 1: Move the front page to `/news`.** Replace `src/app/news/page.tsx` with the current body of `src/app/page.tsx`, renaming the component `NewsFrontPage`, keeping every import and the JSX unchanged, with this metadata:

```ts
export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI news",
  description: "The day's AI stories for founders, written in full from the best reporting, with what each one means for your company.",
  alternates: { canonical: "/news" },
};
```

and, directly after the `DirectoryBand`, an "Older stories" link:

```tsx
      <Link href="/news/page/2" className="self-start text-sm font-semibold text-teal hover:text-teal-bright">
        Older stories &rarr;
      </Link>
```

Keep the `<h1 className="sr-only">AI news, curated by Enki</h1>`. The "All news" link inside the Latest section changes to `href="/news/page/2"` with text "Older stories".

- [ ] **Step 2: Write the new `src/app/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { HomeHero } from "@/components/home/home-hero";
import { TodaysIssue } from "@/components/home/todays-issue";
import { HowItsMade } from "@/components/home/how-its-made";
import { TakeawayAnatomy } from "@/components/home/takeaway-anatomy";
import { SubscribeBand } from "@/components/home/subscribe-band";
import { TrendingTools } from "@/components/home/trending-tools";
import { HomeFaq } from "@/components/home/home-faq";
import { StickySubscribeBar } from "@/components/home/sticky-subscribe-bar";
import { BeehiivScripts } from "@/components/newsletter/beehiiv-scripts";
import { getHomeIssueData } from "@/lib/news/issue-data";
import { getFeaturedTools } from "@/lib/content";

// Publishing a story revalidates "/" (admin actions), so today's issue stays current.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Enki Daily: AI news for founders, five minutes a day" },
  description: "The AI stories that matter to your company, with what to do next. Free, every weekday morning.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [{ issue, stats }, featured] = await Promise.all([getHomeIssueData(new Date()), getFeaturedTools()]);
  const tools = featured.filter((t) => !t.sponsored).slice(0, 6);

  return (
    <>
      <Container className="flex flex-col gap-20 pt-28 pb-24 sm:gap-24">
        <div className="flex flex-col gap-10">
          <HomeHero />
          <TodaysIssue issue={issue} />
        </div>
        <HowItsMade stats={stats} />
        <TakeawayAnatomy issue={issue} />
        <SubscribeBand variant="compact" />
        <TrendingTools tools={tools} />
        <HomeFaq />
        <SubscribeBand variant="large" />
      </Container>
      <StickySubscribeBar />
      <BeehiivScripts />
    </>
  );
}
```

Ruling carried from the spec: Trending tools excludes sponsored tools so the section carries no sponsored labels (spec 3.6). If the layout already renders JSON-LD for `/`, leave it untouched.

- [ ] **Step 3: Header button.** In `site-header.tsx`, change the desktop "Explore" link (the `Link` with `href="/tools"` and text `Explore`) to:

```tsx
          <Link
            href="/#subscribe"
            className="hidden items-center gap-1.5 rounded-full bg-mist px-4 py-1.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow-sm sm:inline-flex"
          >
            Subscribe
            <Icon name="ArrowRight" className="size-3.5" />
          </Link>
```

If any header unit test asserts the "Explore" text, update that assertion to "Subscribe".

- [ ] **Step 4: Write `tests/e2e/home.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("Enki Daily home and news", () => {
  test("the home page is the Enki Daily funnel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI news for founders");
    await expect(page.locator("#subscribe")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Before you subscribe" })).toBeVisible();
  });

  test("/news shows the front page", async ({ page }) => {
    await page.goto("/news");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI news, curated by Enki");
    await expect(page.getByRole("link", { name: /Older stories/ }).first()).toBeVisible();
  });

  test("/welcome confirms the signup", async ({ page }) => {
    await page.goto("/welcome?from=home");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're in.");
  });
});
```

(The `/welcome` test passes after Task 6; run only the first two now with `--grep`.)

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS.
Start `preview_start { name: "enki-dev" }`, then:
Run: `pnpm exec playwright test tests/e2e/home.spec.ts --grep "funnel|front page"` (if Playwright's config starts its own server, stop the preview first so port 3000 is free).
Expected: 2 passed.
Run: `MSYS_NO_PATHCONV=1 pnpm sweep -- --base http://localhost:3000 / /news /news/page/2 /tools`
Expected: all PASS at narrow and wide. Screenshot `/` at 390px (hero and Issue) and 1440px.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/news/page.tsx src/components/layout/site-header.tsx tests/e2e/home.spec.ts
git commit -m "feat(home): / becomes the Enki Daily funnel, the front page moves to /news"
```

---

### Task 6: Welcome page, story-end card, footer, unsubscribe, retire the old list

**Files:**
- Create: `src/app/welcome/page.tsx`
- Modify: `src/app/news/[slug]/page.tsx` (after the Sources section), `src/components/layout/site-footer.tsx`, `src/app/unsubscribe/page.tsx`, `src/lib/schemas.ts`, `src/lib/schemas.test.ts`, `src/lib/supabase/anon-writes.test.ts`, `src/lib/brand-copy.test.ts`, `handoff.md`
- Delete: `src/app/actions/newsletter.ts`, `src/app/actions/unsubscribe.ts`, `src/components/account/unsubscribe-form.tsx`

**Interfaces:**
- Consumes: `BeehiivEmbed`, `BeehiivScripts` (Task 2); `TodaysIssue` (Task 3); `getHomeIssueData` (Task 1).

- [ ] **Step 1: Extend the copy guard first** (`src/lib/brand-copy.test.ts`), add inside the `describe`:

```ts
  it("keeps Enki Daily copy free of dashes and reader counts", () => {
    const files = [
      "src/components/home/home-hero.tsx",
      "src/components/home/todays-issue.tsx",
      "src/components/home/how-its-made.tsx",
      "src/components/home/takeaway-anatomy.tsx",
      "src/components/home/subscribe-band.tsx",
      "src/components/home/trending-tools.tsx",
      "src/components/home/home-faq.tsx",
      "src/components/home/sticky-subscribe-bar.tsx",
      "src/app/welcome/page.tsx",
      "src/app/unsubscribe/page.tsx",
      "src/components/layout/site-footer.tsx",
    ];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toContain(EM_DASH);
      expect(text, path).not.toContain(EN_DASH);
      expect(text, path).not.toMatch(/\b\d[\d,.]*\+?\s*(readers|subscribers)\b/i);
    }
  });

  it("names the newsletter Enki Daily, not The Tablet", () => {
    const footer = readFileSync("src/components/layout/site-footer.tsx", "utf8");
    expect(footer).toContain("Enki Daily");
    expect(footer).not.toContain("The Tablet");
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/lib/brand-copy.test.ts`
Expected: FAIL (welcome page missing; footer still says The Tablet).

- [ ] **Step 3: Create `src/app/welcome/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { TodaysIssue } from "@/components/home/todays-issue";
import { getHomeIssueData } from "@/lib/news/issue-data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Welcome to Enki Daily",
  robots: { index: false, follow: false },
  alternates: { canonical: "/welcome" },
};

const STEPS = [
  { t: "Check your inbox", d: "If you don't see a confirmation email, check Promotions or Spam." },
  { t: "Add us to your contacts", d: "It keeps Enki Daily out of the spam folder." },
  { t: "Read today's stories", d: "The full articles are already on Enki.", href: "/news" },
];

export default async function WelcomePage() {
  const { issue } = await getHomeIssueData(new Date());
  return (
    <Container className="flex flex-col gap-12 pt-28 pb-24">
      <header className="relative mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute -top-10 left-1/2 h-[240px] w-[520px] max-w-[140%] -translate-x-1/2 rounded-full bg-teal/20 blur-[80px]" />
        <p className="relative font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki Daily</p>
        <h1 className="relative font-display text-5xl font-semibold uppercase">You&apos;re in.</h1>
        <p className="relative text-lg text-muted-foreground">Enki Daily arrives every weekday morning.</p>
      </header>
      <ol className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.t} className="rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
            <p className="font-mono text-[0.65rem] tracking-[0.16em] text-teal uppercase">{`0${i + 1}`}</p>
            {s.href ? (
              <Link href={s.href} className="mt-1.5 block font-semibold hover:text-teal-bright">{s.t} &rarr;</Link>
            ) : (
              <p className="mt-1.5 font-semibold">{s.t}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <TodaysIssue issue={issue} />
    </Container>
  );
}
```

- [ ] **Step 4: Story-end card.** In `src/app/news/[slug]/page.tsx`, add imports `import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";` and `import { BeehiivScripts } from "@/components/newsletter/beehiiv-scripts";`. Inside the `hasBody && story.body` branch, directly after the Sources `</section>`, add:

```tsx
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 ring-hairline sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-[220px] w-[360px] rounded-full bg-teal/15 blur-[70px]" />
              <p className="relative font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki Daily</p>
              <h2 className="relative mt-2 font-display text-2xl font-semibold text-balance uppercase">
                Get stories like this every weekday morning.
              </h2>
              <p className="relative mt-2 text-sm text-muted-foreground">
                The day&apos;s AI stories for founders, each with what it means for your company. Free.
              </p>
              <BeehiivEmbed form="story" lazy className="relative mt-5 max-w-md" />
              <BeehiivScripts />
            </section>
```

- [ ] **Step 5: Footer.** In `site-footer.tsx`: remove the imports of `useForm`, `zodResolver`, `toast`, `newsletterSchema`/`NewsletterValues`, `subscribe`, `Input`, `Honeypot`, and `Button` if no longer used; remove the form hook and `onSubmit`. Replace the Newsletter block with:

```tsx
          {/* Newsletter */}
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Enki Daily
            </span>
            <p className="text-sm text-muted-foreground">
              The day&apos;s AI stories for founders, every weekday morning.
            </p>
            <BeehiivEmbed form="footer" lazy />
          </div>
```

with `import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";`. Remove `"use client"` only if no hooks or event handlers remain in the file; `BeehiivEmbed` is itself a client component and works from a server component. Add `<BeehiivScripts />` at the end of the footer element (the footer is on every page, so pages that also render it elsewhere load the scripts once; `next/script` dedupes identical `src`).

- [ ] **Step 6: Unsubscribe.** Replace the body of `src/app/unsubscribe/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "How to stop receiving Enki Daily.",
  alternates: { canonical: "/unsubscribe" },
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki Daily</p>
        <h1 className="text-balance font-display text-3xl font-semibold">Unsubscribing from Enki Daily</h1>
        <p className="text-pretty text-muted-foreground">
          Every Enki Daily email has a one-click unsubscribe link at the bottom. Use it and you&apos;ll stop receiving
          emails right away.
        </p>
      </div>
    </Container>
  );
}
```

- [ ] **Step 7: Retire the old list code.**
  - Delete `src/app/actions/newsletter.ts`, `src/app/actions/unsubscribe.ts`, `src/components/account/unsubscribe-form.tsx`.
  - In `src/lib/schemas.ts`, remove the `newsletter form (footer)` block (`newsletterSchema`, `NewsletterValues`). In `src/lib/schemas.test.ts`, remove the tests and import for `newsletterSchema`.
  - In `src/lib/supabase/anon-writes.test.ts`, remove `"src/app/actions/newsletter.ts"` from its file list (keep the rest).
  - Keep `Honeypot` (used by `submit-form.tsx`) and the `newsletter`/`unsubscribe` keys in `src/lib/rate-limit.ts` (its tests use them).
  - Run `grep -rn "actions/newsletter\|actions/unsubscribe\|newsletterSchema\|unsubscribe-form" src tests` and expect no results.

- [ ] **Step 8: HANDOFF.** In `handoff.md`, add a short section under the IN-FLIGHT block: "Enki Daily home (2026-09-23)", stating: `/` is the funnel, `/news` is the front page, beehiiv embeds are configured in `src/lib/newsletter.ts` and empty until the owner creates the three forms (spec §4, §9), and the old `subscribers` table is unused.

- [ ] **Step 9: Verify**

Run: `pnpm verify`
Expected: PASS, including the new copy guards.
With `enki-dev` running:
Run: `pnpm exec playwright test tests/e2e/home.spec.ts`
Expected: 3 passed.
Run: `MSYS_NO_PATHCONV=1 pnpm sweep -- --base http://localhost:3000 / /news /welcome /unsubscribe /tools /news/gemini-hacked-three-real-companies-during-a-cybersecurity-31fc2b`
Expected: every route PASS at narrow and wide. Screenshots at 390px: the hero, the Issue, the sticky bar (scroll past the hero), a story's end card. Stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add src/app/welcome/page.tsx src/app/news/[slug]/page.tsx src/components/layout/site-footer.tsx src/app/unsubscribe/page.tsx src/lib/schemas.ts src/lib/schemas.test.ts src/lib/supabase/anon-writes.test.ts src/lib/brand-copy.test.ts handoff.md
git rm src/app/actions/newsletter.ts src/app/actions/unsubscribe.ts src/components/account/unsubscribe-form.tsx
git commit -m "feat(newsletter): welcome page, story-end card and footer on beehiiv; retire the old list"
```

---

### Task 7 (after the owner provides embed codes): wire the forms

Blocked on spec §9. When the owner pastes the three embed codes:
- [ ] Set each `NEWSLETTER.forms.*.src` to the iframe `src` from its code, and `hostedUrl` to the publication's subscribe page.
- [ ] Compare the script URLs and hosts in the codes with `BEEHIIV_EMBED_SCRIPT`, `BEEHIIV_ATTRIBUTION_SCRIPT` and the CSP lines; update all three places together if they differ.
- [ ] Measure the rendered form height at 390px and 1440px in the browser and set `height`/`mobileHeight` so nothing is clipped.
- [ ] Sweep `/`, a story page and `/welcome`; submit one real address on the home form and confirm the redirect to `/welcome?from=home`. Ask the owner before submitting: it adds a real subscriber.
- [ ] Commit `src/lib/newsletter.ts` (and `next.config.ts` if changed).
