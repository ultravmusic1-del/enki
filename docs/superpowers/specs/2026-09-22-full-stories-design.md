# Full stories on Enki: design

**Date:** 2026-09-22 · **Status:** approved in conversation, awaiting written review
**Builds on:** `2026-09-19-ai-news-pivot-design.md` (read its §0 amendments).
Where this spec and that one disagree, this one wins.

## 0. Why

A story page today is a 40 to 320 character summary plus "Read the full story
at {Source}". It sends the reader away and keeps nothing for Enki. The owner
wants each story to be a full article on Enki, written from several outlets'
coverage of the same event, with an original section on what it means for
founders.

**Success:** a reader gets the whole event and a founder's angle without
leaving Enki; story pages carry enough original text to rank; source links
remain as credit, not as the destination.

## 1. Decisions taken

| Question | Decision |
|---|---|
| Who writes articles | **Claude, in sessions**, after reading every source. There is still no automated LLM step in the ingest pipeline. |
| Article shape | **400 to 700 words**: a lede, what happened (from all sources), then a headed **"What it means for founders"** section of 2 to 4 points. Hard limits enforced in the database: 300 to 1,200 words. |
| Audience | **Founders.** The founder section is the part no aggregated outlet provides. |
| Data model | **Extend `stories`** (option A). Duplicate coverage is **merged** into one story and becomes its sources, instead of being rejected. |
| Byline | **"By Enki"**, replacing "Summary by Enki". No AI disclosure, and no copy says who or what writes (unchanged owner decision). |
| Indexing | A page is indexable when its **body is 300+ words**. Replaces the 300-character-take rule. |
| Markdown | A small in-house renderer for a restricted subset. No new dependency, no raw HTML. |

## 2. Data model

One migration, applied through Supabase and recorded in HANDOFF §4.

- `stories.body text null`: the article in restricted Markdown (§4).
- `stories.merged_into uuid null references stories(id)`: set only when
  `status = 'merged'`. A check constraint enforces
  `(status = 'merged') = (merged_into is not null)`.
- The `status` check gains `'merged'`. The anon read policy is unchanged: it
  exposes `published` only, so merged rows stay private like rejected ones.
- `summary` (40 to 320 characters) stays and becomes the standfirst and the meta
  description.
- `take` stays in the table so nothing old breaks, but the editor no longer
  writes it. The founder section inside `body` replaces it.

### 2.1 RPCs

All admin RPCs keep the existing pattern: `security definer`, an admin check,
parameters prefixed `p_` (see the name-shadowing lesson).

- **`admin_publish_story`** gains `p_body text`. When `p_body` is not null it
  must:
  - contain 300 to 1,200 words (split on whitespace)
  - contain no U+2013 or U+2014
  - contain a line exactly `## What it means for founders`

  A null body is still accepted, so a summary-only publish keeps working for
  the four legacy stories until they are rewritten.
- **New `admin_merge_story(p_story_id uuid, p_into_id uuid)`**: admin only.
  Refuses when the two ids are equal, when the target is `merged` or
  `rejected`, or when the row being merged is `published`. Sets
  `status = 'merged'` and `merged_into = p_into_id`.
- **Unmerge** reuses `admin_set_story_status(..., 'pending')`, which is changed
  to clear `merged_into` whenever the new status is not `merged`.
- **Public sources:** the story read in `src/lib/news/stories.ts` returns the
  story's own source plus its merged rows' `source_name`, `source_site_url` and
  `source_url`. Because anon cannot read merged rows, this goes through a
  `security definer` function `story_sources(p_story_id)` that returns only
  those three columns, and only when the parent story is published.

## 3. Admin: `/admin/news`

- **Editor** (`story-editor.tsx`): the take field is replaced by a large body
  textarea with a live word count (red outside 300 to 1,200), a dash warning,
  and a warning when the founder heading is missing. Headline, summary, beat,
  featured and tools are unchanged.
- **Sources panel:** the editor lists the story's own source and every merged
  row, each linked, so the writer has a checklist of what to read.
- **Merge:** each queue row gets **"Merge into…"**, a picker of recent pending
  and published stories. Merging into a published story is allowed, so late
  coverage can be added to it. A merged row shows under its parent with an
  "Unmerge" action.
- **Editing a published story** is a republish through the same editor.
  `published_at` does not change. There is no `updated_at` in this merge.

### 3.1 Workflow per story (Claude, in session)

1. Merge duplicate coverage into the best row.
2. Read every source in full. The Verge and Ars Technica block the fetch tool:
   read them in a browser tab.
3. Write the headline, summary and body to §5.
4. Pick the beat, prune incidental tool suggestions ("OpenAI" and "Anthropic"
   over-suggest), publish.

The owner must be signed in inside the browser pane. Claude never types the
password.

## 4. Body format and renderer

`src/lib/news/article-body.ts`: a pure function from the body string to React
elements. Supported:

- paragraphs, separated by a blank line
- `## ` headings (rendered as `h2`)
- `- ` list items (consecutive items form one `ul`)
- `**bold**`
- `[text](https://…)` links, rendered with `rel="noopener"` and opened in a
  new tab

Anything else renders as literal text. There is no HTML passthrough and no
`dangerouslySetInnerHTML`. Link targets other than `https:` render as plain
text.

## 5. Editorial rules

These also go in the memory file `news-summaries-by-claude`.

- Write from **every merged source, read in full**. One source is acceptable
  when that is all the coverage.
- **Synthesis, never rewriting.** No sentence copied or closely paraphrased from
  a publisher. Facts are combined in Enki's own structure and words.
- **Quotes:** at most one short quote from a person per story, attributed to the
  person and to the outlet that reported it.
- **Disagreement:** where outlets disagree, leave the disputed detail out.
- **Company claims are attributed** ("OpenAI says"), not stated as fact.
- **Founder section:** 2 to 4 concrete points on costs, platform risk,
  openings, or what to watch. No investment advice. Never choose or angle a
  story for affiliate commission.
- **Style:** no em or en dashes; headline rewritten in Enki's voice; summary is
  plain fact.
- **Reject** promos (conference ticket posts and the like) and items that are
  not news.

## 6. Story page: `/news/[slug]`

Top to bottom:

1. Beat breadcrumb and headline (unchanged).
2. Meta line: **"By Enki"**, publish time, and "Reporting from {source names}".
3. The summary as the standfirst.
4. The body. The "What it means for founders" section gets a subtle teal rule.
5. **"Sources"**: every source as a plain external link with `rel="noopener"`,
   not routed through `/go`. Replaces "Read the full story at {Source}".
6. "Tools in this story", "More in {Beat}" and the "How Enki covers news" link,
   unchanged.

A story with no body (the legacy four) keeps the current layout, including the
single source link, until it is rewritten.

**Metadata**

- `storyRobots` takes the body and indexes at 300+ words; otherwise
  `noindex, follow`.
- Indexable pages emit `NewsArticle` JSON-LD with `author` as the Enki
  Organization, `isBasedOn` listing the source URLs, `datePublished` and
  `wordCount`.
- Description is the summary. The OG image is unchanged.

## 7. Other surfaces

- Homepage, `/news`, pages and beats: no change. They already show headline and
  summary and link to the Enki page.
- `/news/about`: reworded to say stories are written by Enki from the reporting
  of the linked outlets, the founder section is Enki's analysis, and the
  outlets own their original reporting. It says nothing about who or what
  writes.
- "Summary by Enki" becomes "By Enki" everywhere, including tests that pin it.

## 8. Testing

- `article-body.test.ts`: every supported construct; raw HTML and `javascript:`
  links come out as text; unknown syntax falls back to text.
- `story-meta` and `schemas` tests: word-count indexing, body validation
  (length, dashes, founder heading), byline string.
- `actions.test.ts`: publish with a body; merge and unmerge; refusal on
  self-merge and merge into a merged row.
- Live database, both directions: `admin_publish_story` accepts a valid body
  and refuses each invalid case; `admin_merge_story` accepts a valid merge and
  refuses the bad ones; `story_sources` returns nothing for an unpublished
  parent.
- `pnpm audit:rls` gains one check: anon cannot read `merged` rows.
- `pnpm sweep -- / /tools /news /news/<a rewritten story>` passes at 390px and
  1440px, plus a screenshot of the story page for typography.

## 9. Delivery

One merge, in order: migration and RPCs, body renderer, story page, admin
editor and merge, copy. Then, in session:

1. Rewrite the four published stories as full articles, merging their existing
   duplicate rows (now rejected) back in as sources.
2. Publish the five stories researched on 2026-09-22 (OpenAI math advisory
   group, the AI hallucination and the Chinese ship, Google's CC, the Muse
   zero-day, Trump's "AI Force") as full articles, merging their duplicates.

## 10. Out of scope

Automatic duplicate grouping, `updated_at` and an "Updated" label, images inside
articles, author pages, newsletters.
