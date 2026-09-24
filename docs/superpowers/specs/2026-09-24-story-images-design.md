# Story images: design

**Date:** 2026-09-24 · **Status:** approved in conversation, awaiting written review
**Builds on:** `2026-09-23-enki-daily-home-design.md` (the home page's "The Issue").

## 0. Why

Stories get their image from the RSS feed item. TechCrunch's feed carries none,
so a third of live stories have no image (3 of 9 on 2026-09-24), and the home
page's "Today's brief" shows no images at all. The owner wants more stories to
have images, properly sized, with the home page's brief rows showing them.

Already shipped separately (commit `dbbd627`): every story image renders in a
16:9 frame with the crop anchored above centre, and a story without an image
shows a designed Enki placeholder (`StoryImage`, `src: string | null`).

**Success:** a newly ingested story whose feed has no image gets its article's
`og:image`; the existing imageless stories are backfilled; the home brief rows
show each story's image (or the placeholder) at 16:9 at every width, without
overflow.

## 1. Decisions taken

| Question | Decision |
|---|---|
| Image source | The article page's **`og:image`**, for feed items that have no image. Feed images stay as they are. |
| Hosting | **Hotlinked**, as today (no copying or caching of publisher images). |
| When | **At ingest**, bounded (§2). Plus a **one-off backfill** of existing stories (§3). |
| Merged-source fallback | **Not built.** Anon reads can't see merged rows; every checked article has its own `og:image`. |
| New placements | **Home "Today's brief" rows only.** Story pages and lists unchanged. |

## 2. Ingest: `og:image` for imageless items

`src/lib/news/og-image.ts`:
- `extractOgImage(html: string, pageUrl: string): string | null`: the first
  `<meta property="og:image" content="…">` (also accept `name="og:image"`,
  `og:image:secure_url`, and `name="twitter:image"` as a last resort), with HTML
  entities decoded, resolved against `pageUrl` if relative, and accepted only if
  it is an `https:` URL that passes the existing `isHttpUrl` check. Otherwise
  `null`.
- `fetchOgImage(url: string, fetchPage?): Promise<string | null>`: GET the
  article with the feed fetcher's honest `EnkiNewsBot/1.0` user-agent (all four
  checked sites answer it) and `accept: text/html`, a **4 s**
  timeout, reading at most **1 MB** of the body (the `<head>` is enough).
  Non-2xx, timeout, non-HTML or any error resolves `null`; it never throws.

`src/lib/news/ingest.ts` (inside the per-source loop, before inserting):
- Candidates: items with `imageUrl === null` **and** `publishedAt` within the
  last **24 hours** of `now` (the cron runs daily, so these are the new items;
  older ones were seen by an earlier run). Items with no date are skipped.
- At most **10** candidates per source, fetched with a concurrency of **4**.
- A found image fills `imageUrl` before `insertStory`. A failure leaves `null`.
- `fetchOgImage` is injectable through `IngestDeps` (`fetchImage?`) so tests
  never touch the network.
- Budget: at most 3 rounds of 4 s per source, sources in parallel, well inside
  the route's `maxDuration = 60`.

## 3. Backfill (one-off, owner-visible)

For every **published or pending** story with `image_url is null`: fetch its
`source_url`'s `og:image` with the same rules, then show the owner the list
(slug, image URL) before writing. The write is a single `update stories set
image_url = … where id = … and image_url is null` per row, run through the
Supabase MCP as the controller. No committed script, no migration.

## 4. Home "Today's brief" rows

- `IssueStoryInput` and `IssueStory` gain `imageUrl: string | null`, filled
  from `PublicStory.imageUrl` in `getHomeIssueData`.
- `TodaysIssue` row layout:
  - **sm and up:** grid `numeral | text | thumbnail`. The thumbnail is
    `StoryImage` at 16:9, **176px** wide (`w-44`), top-aligned. The outlet chips
    move under the takeaway (the right-hand outlet column goes).
  - **Below sm:** the thumbnail sits above the beat label at full width.
  - No image: `StoryImage`'s placeholder (label: the beat name).
  - Decorative (`alt=""`), inside the row's existing link.
- `/welcome` reuses `TodaysIssue`, so it gets the same rows.

## 5. Testing

- **Unit:** `extractOgImage` (property and name forms, attribute order,
  entities, relative URL, `http:` rejected, `javascript:` rejected, twitter
  fallback, none found). `fetchOgImage` (non-2xx, timeout, non-HTML, thrown
  error all resolve `null`; stops reading after 1 MB). Ingest: a recent
  imageless item gets the fetched image; an old one, one with a feed image, and
  one with no date are not fetched; the cap of 10; a fetch failure still inserts
  the story.
- **Issue:** `buildIssue` carries `imageUrl`; `TodaysIssue` renders a
  `StoryImage` per row, the placeholder when null.
- **Visual:** sweep `/`, `/welcome`, `/news` at 390px and 1440px; screenshots of
  the brief at 390px, 1024px and 1440px; every thumbnail frame measures 16:9.

## 6. Out of scope

Copying or proxying images; images on story pages, lists, beat or archive
pages; merged-source image fallback; an admin image override.
