# News Repositioning Implementation Plan (merge 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every piece of site-wide copy and metadata describe Enki as it now is: an AI news front page with a vetted tool directory. This fixes the wrong `enki.tools` domain on social-share images and brings the pivot into the roadmap.

**Architecture:** Copy and metadata only. No new routes, data or components.
- The site description flows from one constant (`siteConfig.description`) into the root metadata, the web manifest, the Organization/WebSite JSON-LD and `llms.txt`, so it changes once.
- The share-image domain is derived from `CANONICAL_SITE_URL` in both image routes, so it can't drift again.
- A small guard test pins the two failure modes this merge fixes.

**Tech Stack:** Next.js 16 App Router, `next/og`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md`, §8.2–8.3 and §11 item 4, with the §0 amendments. §8.1 (`/tools`) already shipped in merge 3.

## Global Constraints

- **No em dash (U+2014) or en dash (U+2013)** in any user-facing string this plan adds or edits.
- **Keep the tagline "Wisdom for the age of AI" and the domain `enkitools.com`** (spec §1).
- **"Oracle" framing stays on `/tools`** (spec §8.1): the hero there is unchanged. It leaves only the site-wide copy.
- **No copy claims who writes summaries**, and there is no AI disclosure (§0 amendments 1–2).
- **Git:** work on `main`, no branches, never push. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The pre-commit hook runs `pnpm verify`; never use `--no-verify`.

## Review Focus

1. **A share of any page shows the right domain.** Both the root and tool share images read `enkitools.com`. Covered by the guard test (Task 1) and by rendering both images (Task 3).
2. **Nothing site-wide still calls Enki only a directory.** Covered by the guard test's description check (Task 1) and by reading the footer and `llms.txt` (Task 3).
3. **The affiliate disclosure is honest on story pages**: it must cover story tool links, not just ratings. Covered in Task 1's copy and checked on a story page in Task 3.

---

## The new copy (owner-approved before implementation)

| Where | New text |
|---|---|
| `siteConfig.description` | `Enki is AI news, curated: the day's most important AI stories in clear summaries, with a vetted directory of the tools behind them.` |
| Footer blurb | `AI news, curated. The day's stories in clear summaries, plus a vetted directory of the tools behind them.` |
| Root share-image pills | `AI news` · `Tool directory` · `enkitools.com` |
| Root share-image `alt` | `Enki: Wisdom for the age of AI` |
| Affiliate disclosure | `We may earn a commission if you sign up through our links. It never affects our ratings or which stories we cover.` |
| Privacy, affiliate paragraph (last two sentences) | `This includes tool links on news stories. Affiliate relationships never influence our editor scores, verdicts, rankings, or which stories we cover and how we summarise them. Those are decided independently of any commercial arrangement.` |
| Root `keywords` | `"AI news", "AI news today", "AI tools", "AI directory", "AI tool reviews", "AI tool comparison", "Enki"` |

---

### Task 1: Site-wide copy, share images and `llms.txt`

**Files:**
- Modify: `src/lib/site.ts` (`description`)
- Modify: `src/app/layout.tsx` (`keywords`)
- Modify: `src/components/layout/site-footer.tsx` (blurb)
- Modify: `src/app/opengraph-image.tsx` (alt and pills)
- Modify: `src/app/tools/[slug]/opengraph-image.tsx` (domain)
- Modify: `src/app/llms.txt/route.ts` (news section)
- Modify: `src/components/shared/affiliate-disclosure.tsx`
- Modify: `src/app/privacy/page.tsx`
- Create: `src/lib/brand-copy.test.ts`

**Interfaces:**
- Consumes:
  - `siteConfig` and `CANONICAL_SITE_URL` from `@/lib/site`
  - `beats` from `@/data/beats`
- Produces: copy only; nothing imports new names.

- [ ] **Step 1: Write the failing guard test**

```ts
// src/lib/brand-copy.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { siteConfig } from "@/lib/site";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** Files whose visible copy this merge rewrote. */
const COPY_FILES = [
  "src/components/layout/site-footer.tsx",
  "src/components/shared/affiliate-disclosure.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/tools/[slug]/opengraph-image.tsx",
];

describe("site-wide brand copy", () => {
  it("describes Enki as news first", () => {
    expect(siteConfig.description.toLowerCase()).toContain("news");
    expect(siteConfig.description.toLowerCase()).not.toContain("oracle for ai tools");
  });

  it("never prints the old enki.tools domain on a share image or page", () => {
    for (const path of COPY_FILES) {
      expect(readFileSync(path, "utf8"), path).not.toContain("enki.tools");
    }
  });

  it("has no em or en dash in the rewritten copy", () => {
    for (const text of [siteConfig.description, readFileSync("src/components/shared/affiliate-disclosure.tsx", "utf8")]) {
      expect(text.includes(EM_DASH) || text.includes(EN_DASH)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/brand-copy.test.ts`
Expected: all three FAIL, on the current description, the `enki.tools` text, and the disclosure's em dash.

- [ ] **Step 3: Apply the copy table above**, exactly as written:
  - `src/lib/site.ts`: replace the `description` string.
  - `src/app/layout.tsx`: replace the `keywords` array with the table's list.
  - `src/components/layout/site-footer.tsx`: replace the blurb paragraph's text, keeping the `<p>` and its classes.
  - `src/components/shared/affiliate-disclosure.tsx`: the `Link` still wraps the words `We may earn a commission`. The text after it becomes ` if you sign up through our links. It never affects our ratings or which stories we cover.`
  - `src/app/privacy/page.tsx`: the affiliate paragraph keeps its first sentence ("Some outbound links to tools are affiliate links, meaning Enki may earn a commission if you sign up or purchase through them, at no extra cost to you."). Its remainder becomes the table's text.

- [ ] **Step 4: Share images.**
  - **`src/app/opengraph-image.tsx`:**
    - `alt` becomes `` `${siteConfig.name}: ${siteConfig.tagline}` ``
    - the three pill texts become `AI news`, `Tool directory`, and the canonical host
    - add `import { CANONICAL_SITE_URL } from "@/lib/site";` if it isn't imported, and render the host as `{new URL(CANONICAL_SITE_URL).host}`
  - **`src/app/tools/[slug]/opengraph-image.tsx`:** replace the literal `enki.tools` (around line 227) with `{new URL(CANONICAL_SITE_URL).host}`, importing `CANONICAL_SITE_URL` from `@/lib/site`.

  `CANONICAL_SITE_URL` is `https://enkitools.com`, so the host is `enkitools.com`. Use it rather than `siteConfig.url`, which would print a preview deployment's host on preview builds.

- [ ] **Step 5: `llms.txt`.** In `src/app/llms.txt/route.ts`:
  - import `beats` from `@/data/beats`
  - insert this block directly after the description line and its blank line, before `## Categories`:

```ts
    "## News",
    `- [AI news front page](${base}/): the day's most important AI stories`,
    `- [All news](${base}/news): every published story, newest first`,
    ...beats.map((beat) => `- [${beat.name}](${base}/news/beat/${beat.slug})`),
    `- [How Enki covers news](${base}/news/about)`,
    "",
```

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `pnpm vitest run src/lib/brand-copy.test.ts && pnpm typecheck && pnpm lint`
Expected: the 3 guard tests pass, and everything is clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/site.ts src/app/layout.tsx src/components/layout/site-footer.tsx src/app/opengraph-image.tsx "src/app/tools/[slug]/opengraph-image.tsx" src/app/llms.txt/route.ts src/components/shared/affiliate-disclosure.tsx src/app/privacy/page.tsx src/lib/brand-copy.test.ts
git commit -m "feat(brand): describe Enki as AI news first, and fix the share-image domain"
```

---

### Task 2: Bring the pivot into the roadmap

**Files:**
- Modify: `docs/roadmap.md` (a new phase)
- Modify: `handoff.md` §12 (remove the "exception while in flight" note)

- [ ] **Step 1: Add the phase.** In `docs/roadmap.md`, insert a new section directly before `## 7. External review claims that did not survive verification`. Its status table reflects the real state as of this merge:

```markdown
## Phase N — The news pivot (2026-09-19 onward)

Enki became an AI news front page with the tool directory as its second
product. Spec: `docs/superpowers/specs/2026-09-19-ai-news-pivot-design.md`
(read its §0 amendments first). Each merge has its own plan in
`docs/superpowers/plans/`.

| Merge | What | Status |
|---|---|---|
| 1 | Feed ingestion, the admin news queue, daily cron | **Done**, live |
| 2 | Story pages, `/news`, beats, `/news/about`, view counting, sitemap | **Done**, live |
| 3 | The news homepage, header nav and beat row, `/tools` gets the hero | **Done**, live |
| 4 | Site-wide copy and metadata, share-image domain, this phase | **Done** |

**Open, in priority order:**
- **Owner:** create the Vercel Firewall rule `enki-story-view` (30/minute per IP). View counting is not rate limited until then.
- **Affiliate coverage.** News is mostly about ChatGPT, Claude and Gemini, and none of them has an affiliate programme. Tool cards on those stories earn nothing. Revenue depends on stories that mention tools that do (for example Perplexity), or on adding tools that have programmes.
- **Publishing cadence.** Stories only reach the homepage when someone publishes them from `/admin/news`. The daily cron fills the queue; it does not publish.
- **CI is red on the dependency audit** (`pnpm audit --prod --audit-level high`, pre-existing advisories in `next`, `sharp`, `@sentry/nextjs`, `@react-three/drei` and `browserslist`).
```

Replace `N` with the next phase number after the last existing phase (the file currently ends at Phase 6, so this is **Phase 7**). Renumber the later `## 7.` heading if the file numbers its non-phase sections to match, and report what you did.

- [ ] **Step 2: Update the handoff.** In `handoff.md` §12, delete the paragraph that begins `**Exception while it is in flight:**`. The roadmap now carries the pivot.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md handoff.md
git commit -m "docs(roadmap): the news pivot is a roadmap phase"
```

---

### Task 3: Verification (controller)

- [ ] Run `pnpm verify && pnpm build`.
- [ ] Serve with `preview_start enki-dev` and run:
  `MSYS_NO_PATHCONV=1 pnpm sweep -- / /tools /news/gemini-hacked-three-real-companies-during-a-cybersecurity-31fc2b /privacy`.
  All pairs must PASS.
- [ ] Render both share images and look at them:
  - `/opengraph-image`
  - `/tools/cursor/opengraph-image`, whose URL must be read from the `og:image` meta on `/tools/cursor`

  Each must read `enkitools.com`.
- [ ] Read `/llms.txt`: it has a News section with the five beats.
- [ ] On the Gemini story page, check that the disclosure reads the new line.
- [ ] Update `handoff.md` §0 to say merge 4 is done, and commit. Stop the server. Do not push unless asked.
