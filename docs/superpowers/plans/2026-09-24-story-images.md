# Story Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give imageless stories their article's `og:image` at ingest (plus a one-off backfill), and show each story's image in the home page's "Today's brief" rows.

**Architecture:** A small, never-throwing `og-image.ts` module extracts and fetches `og:image`. `ingestAll` calls it for recent imageless feed items, bounded by count, concurrency and timeout. `Issue` stories carry `imageUrl`, and `TodaysIssue` renders them through the existing `StoryImage` (16:9 frame, placeholder when null).

**Tech Stack:** Next.js 16, TypeScript, Vitest + Testing Library, Supabase (MCP for the backfill), Playwright for screenshots.

**Spec:** `docs/superpowers/specs/2026-09-24-story-images-design.md`

## Global Constraints

- **User-agent:** article fetches send the same honest header as the feed fetcher: `EnkiNewsBot/1.0 (+${siteConfig.url}/news/about)`. (Measured 2026-09-24: TechCrunch, OpenAI, The Verge and Ars Technica all return 200 with `og:image` for it; a "Mozilla/5.0 (compatible; …)" variant got 403 from OpenAI.) This overrides the spec's "browser-like" wording.
- Only `https:` image URLs that pass `isHttpUrl` from `@/lib/safe-url` are stored.
- `og:image` fetching never throws and never fails an ingest run or an insert.
- Limits: items published within the last **24 h** of `now`; at most **10** fetches per source; concurrency **4**; **4 s** timeout; read at most **1 MB** per page.
- No new npm dependency. No migration. Images stay hotlinked.
- **No en dash (U+2013) or em dash (U+2014)** in any file this plan adds or edits. Never type a backslash-u escape (the edit tools decode them into real characters); build such characters with `String.fromCharCode`.
- Git: work on `main`, no branches, never push. Stage only the files each task names. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pre-commit runs `pnpm verify`; never `--no-verify`.
- Visual changes need `pnpm sweep` PASS at 390px and 1440px (in Git Bash: `MSYS_NO_PATHCONV=1 pnpm sweep -- --base http://localhost:3000 …`). The controller runs browser checks; implementers don't start servers.

## Review Focus

1. **Existing ingest tests must not hit the network:** `ingestAll`'s default image fetcher is the real one, and the existing tests use recent imageless items. Task 2 mocks `@/lib/news/og-image` for the whole test file and asserts no call escapes.
2. **Hostile or odd pages:** `og:image` with `content` before `property`, single quotes, `&amp;` in the URL, a relative path, `http:`, `javascript:` or `data:` values. Pinned in Task 1.
3. **A slow or huge page** must not stall ingest: the timeout aborts, and reading stops at 1 MB. Pinned in Task 1.
4. **A fetch rejection** (the injected fetcher throws) still inserts the story with `imageUrl: null`. Pinned in Task 2.
5. **Long headlines in a brief row with a thumbnail** at 1024px and 390px: no overflow, and the thumbnail stays 16:9. Checked by the controller's measurements in Task 3.

---

### Task 1: `og-image.ts`

**Files:**
- Create: `src/lib/news/og-image.ts`, `src/lib/news/og-image.test.ts`

**Interfaces:**
- Produces:
  - `export const OG_TIMEOUT_MS = 4_000;`
  - `export const OG_MAX_BYTES = 1_000_000;`
  - `export function extractOgImage(html: string, pageUrl: string): string | null`
  - `export async function fetchOgImage(url: string, fetchImpl: typeof fetch = fetch): Promise<string | null>`

- [ ] **Step 1: Write the failing tests** (`src/lib/news/og-image.test.ts`)

```ts
import { describe, it, expect, vi } from "vitest";
import { extractOgImage, fetchOgImage, OG_MAX_BYTES } from "@/lib/news/og-image";

const PAGE = "https://techcrunch.com/2026/09/18/a-story/";

describe("extractOgImage", () => {
  it("reads property=og:image", () => {
    expect(extractOgImage('<head><meta property="og:image" content="https://cdn.example.com/a.jpg" /></head>', PAGE)).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("accepts content before property, single quotes and name=", () => {
    expect(extractOgImage("<meta content='https://cdn.example.com/b.jpg' property='og:image'>", PAGE)).toBe(
      "https://cdn.example.com/b.jpg",
    );
    expect(extractOgImage('<meta name="og:image" content="https://cdn.example.com/c.jpg">', PAGE)).toBe(
      "https://cdn.example.com/c.jpg",
    );
  });

  it("decodes entities in the URL", () => {
    expect(extractOgImage('<meta property="og:image" content="https://cdn.example.com/d.jpg?w=1200&amp;h=675">', PAGE)).toBe(
      "https://cdn.example.com/d.jpg?w=1200&h=675",
    );
  });

  it("resolves a relative URL against the page", () => {
    expect(extractOgImage('<meta property="og:image" content="/img/e.jpg">', PAGE)).toBe("https://techcrunch.com/img/e.jpg");
  });

  it("prefers og:image:secure_url, then og:image, then twitter:image", () => {
    expect(
      extractOgImage(
        '<meta name="twitter:image" content="https://t.example.com/t.jpg"><meta property="og:image" content="https://o.example.com/o.jpg"><meta property="og:image:secure_url" content="https://s.example.com/s.jpg">',
        PAGE,
      ),
    ).toBe("https://s.example.com/s.jpg");
    expect(extractOgImage('<meta name="twitter:image" content="https://t.example.com/t.jpg">', PAGE)).toBe(
      "https://t.example.com/t.jpg",
    );
  });

  it("rejects non-https and script URLs", () => {
    expect(extractOgImage('<meta property="og:image" content="http://cdn.example.com/f.jpg">', PAGE)).toBeNull();
    expect(extractOgImage('<meta property="og:image" content="javascript:alert(1)">', PAGE)).toBeNull();
    expect(extractOgImage('<meta property="og:image" content="data:image/png;base64,AAAA">', PAGE)).toBeNull();
  });

  it("returns null when there is no image meta", () => {
    expect(extractOgImage("<html><head><title>x</title></head></html>", PAGE)).toBeNull();
  });
});

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
}

describe("fetchOgImage", () => {
  it("fetches the page and returns its og:image", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('<meta property="og:image" content="https://cdn.example.com/a.jpg">'));
    expect(await fetchOgImage(PAGE, fetchImpl as unknown as typeof fetch)).toBe("https://cdn.example.com/a.jpg");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String((init.headers as Record<string, string>)["user-agent"])).toMatch(/^EnkiNewsBot\/1\.0 /);
    expect(init.signal).toBeDefined();
  });

  it("resolves null on a non-2xx response, a non-HTML response and a thrown error", async () => {
    expect(await fetchOgImage(PAGE, (async () => htmlResponse("", { status: 404 })) as unknown as typeof fetch)).toBeNull();
    expect(
      await fetchOgImage(
        PAGE,
        (async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch,
      ),
    ).toBeNull();
    expect(await fetchOgImage(PAGE, (async () => { throw new Error("boom"); }) as unknown as typeof fetch)).toBeNull();
  });

  it("stops reading after OG_MAX_BYTES", async () => {
    const chunk = new TextEncoder().encode("x".repeat(64_000));
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.length;
        if (pulled > OG_MAX_BYTES * 3) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const fetchImpl = (async () => new Response(stream, { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    expect(await fetchOgImage(PAGE, fetchImpl)).toBeNull();
    expect(pulled).toBeLessThanOrEqual(OG_MAX_BYTES + 2 * chunk.length);
  });

  it("rejects a non-https page URL without fetching", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchOgImage("http://example.com/a", fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/lib/news/og-image.test.ts`
Expected: FAIL, cannot resolve `@/lib/news/og-image`.

- [ ] **Step 3: Implement `src/lib/news/og-image.ts`**

```ts
import { siteConfig } from "@/lib/site";
import { isHttpUrl } from "@/lib/safe-url";

/**
 * The article page's own share image, for feed items that carry no image.
 * Hotlinked like feed images; never throws, so it can never fail an ingest.
 */

export const OG_TIMEOUT_MS = 4_000;
export const OG_MAX_BYTES = 1_000_000;

/** In priority order. */
const KEYS = ["og:image:secure_url", "og:image", "twitter:image"];

const META = /<meta\b[^>]*>/gi;

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function httpsImage(raw: string, pageUrl: string): string | null {
  try {
    const url = new URL(decodeEntities(raw.trim()), pageUrl).toString();
    return url.startsWith("https://") && isHttpUrl(url) ? url : null;
  } catch {
    return null;
  }
}

export function extractOgImage(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(META)) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (content && KEYS.includes(key) && !found.has(key)) found.set(key, content);
  }
  for (const key of KEYS) {
    const raw = found.get(key);
    const url = raw ? httpsImage(raw, pageUrl) : null;
    if (url) return url;
  }
  return null;
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < OG_MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return text;
}

export async function fetchOgImage(url: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!url.startsWith("https://") || !isHttpUrl(url)) return null;
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(OG_TIMEOUT_MS),
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent": `EnkiNewsBot/1.0 (+${siteConfig.url}/news/about)`,
        accept: "text/html,application/xhtml+xml;q=0.9",
      },
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("html")) return null;
    return extractOgImage(await readCapped(response), response.url || url);
  } catch {
    return null;
  }
}
```

Note: `response.url` is empty for a `Response` built in a test, hence `|| url`.

- [ ] **Step 4: Run to pass**

Run: `pnpm vitest run src/lib/news/og-image.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/news/og-image.ts src/lib/news/og-image.test.ts
git commit -m "feat(news): read an article's og:image, safely and within limits"
```

---

### Task 2: Ingest fills missing images

**Files:**
- Modify: `src/lib/news/ingest.ts`, `src/lib/news/ingest.test.ts`

**Interfaces:**
- Consumes: `fetchOgImage` (Task 1).
- Produces: `IngestDeps.fetchImage?: (url: string) => Promise<string | null>` (default `fetchOgImage`); exported constants `OG_WINDOW_HOURS = 24`, `MAX_OG_FETCHES_PER_SOURCE = 10`, `OG_CONCURRENCY = 4`.

- [ ] **Step 1: Stop the existing tests reaching the network.** At the top of `src/lib/news/ingest.test.ts`, after the vitest import, add:

```ts
const fetchOgImageMock = vi.hoisted(() => vi.fn(async (_url: string): Promise<string | null> => null));
vi.mock("@/lib/news/og-image", () => ({ fetchOgImage: fetchOgImageMock }));
```

and in the file's existing describes (or a top-level `beforeEach`), reset it: `beforeEach(() => fetchOgImageMock.mockReset().mockResolvedValue(null));` (import `beforeEach` from vitest).

- [ ] **Step 2: Write the failing tests** (append to `ingest.test.ts`)

```ts
describe("og:image for imageless items", () => {
  const source = { id: "s1", name: "TechCrunch", feedUrl: "https://tc.example/feed" };
  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toUTCString();

  it("fills a recent imageless item from its article's og:image", async () => {
    const { store, inserted } = fakeStore([source]);
    const fetchImage = vi.fn(async (url: string) => `https://img.example/${url.split("/").pop()}.jpg`);
    await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => rssWith([{ title: "Fresh", link: "https://tc.example/fresh", date: hoursAgo(2) }]),
      fetchImage,
    });
    expect(fetchImage).toHaveBeenCalledWith("https://tc.example/fresh");
    expect(inserted[0].imageUrl).toBe("https://img.example/fresh.jpg");
  });

  it("skips items older than 24 hours and items without a date", async () => {
    const { store, inserted } = fakeStore([source]);
    const fetchImage = vi.fn(async () => "https://img.example/x.jpg");
    await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () =>
        rssWith([
          { title: "Old", link: "https://tc.example/old", date: hoursAgo(30) },
          { title: "Undated", link: "https://tc.example/undated" },
        ]),
      fetchImage,
    });
    expect(fetchImage).not.toHaveBeenCalled();
    expect(inserted.every((s) => s.imageUrl === null)).toBe(true);
  });

  it("never fetches for an item that already has a feed image", async () => {
    const { store, inserted } = fakeStore([source]);
    const fetchImage = vi.fn(async () => "https://img.example/og.jpg");
    const feed = `<rss version="2.0"><channel><title>t</title><item><title>Pic</title><link>https://tc.example/pic</link><pubDate>${hoursAgo(1)}</pubDate><enclosure url="https://img.example/feed.jpg" type="image/jpeg" /></item></channel></rss>`;
    await ingestAll({ store, tools, now: NOW, fetchFeed: async () => feed, fetchImage });
    expect(fetchImage).not.toHaveBeenCalled();
    expect(inserted[0].imageUrl).toBe("https://img.example/feed.jpg");
  });

  it("fetches at most 10 per source", async () => {
    const { store } = fakeStore([source]);
    const fetchImage = vi.fn(async () => null);
    const items = Array.from({ length: 15 }, (_, i) => ({ title: `T${i}`, link: `https://tc.example/${i}`, date: hoursAgo(1) }));
    await ingestAll({ store, tools, now: NOW, fetchFeed: async () => rssWith(items), fetchImage });
    expect(fetchImage).toHaveBeenCalledTimes(10);
  });

  it("still inserts the story when the image fetch rejects", async () => {
    const { store, inserted } = fakeStore([source]);
    const fetchImage = vi.fn(async () => {
      throw new Error("network down");
    });
    const summary = await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => rssWith([{ title: "Fresh", link: "https://tc.example/fresh", date: hoursAgo(2) }]),
      fetchImage,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].imageUrl).toBeNull();
    expect(summary.failed).toEqual([]);
  });

  it("uses the real og:image fetcher by default (mocked in this file)", async () => {
    const { store } = fakeStore([source]);
    fetchOgImageMock.mockResolvedValue("https://img.example/default.jpg");
    await ingestAll({
      store,
      tools,
      now: NOW,
      fetchFeed: async () => rssWith([{ title: "Fresh", link: "https://tc.example/fresh", date: hoursAgo(2) }]),
    });
    expect(fetchOgImageMock).toHaveBeenCalledWith("https://tc.example/fresh");
  });
});
```

(Check the `enclosure` item shape against `parse-feed.ts`: an `enclosure` whose `type` starts with `image/` and whose `url` is https becomes `imageUrl`. Adjust the fixture only if the parser needs another field, and say so in the report.)

- [ ] **Step 3: Run to see them fail**

Run: `pnpm vitest run src/lib/news/ingest.test.ts`
Expected: the new tests FAIL (`fetchImage` is not called / images stay null); existing tests still pass.

- [ ] **Step 4: Implement in `src/lib/news/ingest.ts`**

Add the import and constants:

```ts
import { fetchOgImage } from "@/lib/news/og-image";

/** The cron runs daily, so items newer than this are the ones not seen before. */
export const OG_WINDOW_HOURS = 24;
export const MAX_OG_FETCHES_PER_SOURCE = 10;
export const OG_CONCURRENCY = 4;
```

Add `fetchImage?: (url: string) => Promise<string | null>;` to `IngestDeps`, and `fetchImage = fetchOgImage,` to `ingestAll`'s destructured parameters.

Add this helper above `ingestAll`:

```ts
/**
 * Fill `imageUrl` from each article's og:image for recent items whose feed
 * carried no image. Bounded (count, concurrency, per-fetch timeout inside the
 * fetcher) and never throws: a failed fetch leaves the item imageless.
 */
export async function withOgImages(
  items: FeedItem[],
  now: Date,
  fetchImage: (url: string) => Promise<string | null>,
): Promise<FeedItem[]> {
  const cutoff = now.getTime() - OG_WINDOW_HOURS * 3_600_000;
  const candidates = items
    .filter((item) => item.imageUrl === null && item.publishedAt !== null && item.publishedAt.getTime() >= cutoff)
    .slice(0, MAX_OG_FETCHES_PER_SOURCE);
  const found = new Map<string, string>();
  for (let i = 0; i < candidates.length; i += OG_CONCURRENCY) {
    await Promise.all(
      candidates.slice(i, i + OG_CONCURRENCY).map(async (item) => {
        try {
          const url = await fetchImage(item.url);
          if (url) found.set(item.url, url);
        } catch {
          // An image is a nice-to-have; the story is still queued without one.
        }
      }),
    );
  }
  return found.size === 0 ? items : items.map((item) => (found.has(item.url) ? { ...item, imageUrl: found.get(item.url)! } : item));
}
```

In `ingestAll`, change:

```ts
        const items = selectRecent(parseFeed(await fetchFeed(source.feedUrl)), now);
```

to:

```ts
        const items = await withOgImages(selectRecent(parseFeed(await fetchFeed(source.feedUrl)), now), now, fetchImage);
```

- [ ] **Step 5: Run to pass, then the whole news suite**

Run: `pnpm vitest run src/lib/news/ingest.test.ts` then `pnpm vitest run src/lib/news`
Expected: PASS; no test performs a real network request.

- [ ] **Step 6: Commit**

```bash
git add src/lib/news/ingest.ts src/lib/news/ingest.test.ts
git commit -m "feat(news): ingest fills a missing image from the article's og:image"
```

---

### Task 3: Images in Today's brief

**Files:**
- Modify: `src/lib/news/issue.ts`, `src/lib/news/issue.test.ts`, `src/lib/news/issue-data.ts`, `src/components/home/todays-issue.tsx`, `src/components/home/todays-issue.test.tsx`

**Interfaces:**
- Consumes: `StoryImage` from `@/components/front-page/story-image` (`{ src: string | null; label?: string; className?: string; priority?: boolean }`, 16:9 frame, placeholder when `src` is null).
- Produces: `IssueStoryInput.imageUrl: string | null`; `IssueStory.imageUrl: string | null`.

- [ ] **Step 1: Failing tests.**

In `src/lib/news/issue.test.ts`, add `imageUrl: null` to the `story()` factory defaults, and add:

```ts
  it("carries each story's image through", () => {
    const issue = buildIssue([story({ slug: "a", imageUrl: "https://img.example/a.jpg" }), story({ slug: "b", imageUrl: null })], NOW_FOR_ISSUE)!;
    expect(issue.stories.map((s) => s.imageUrl)).toEqual(["https://img.example/a.jpg", null]);
  });
```

(`buildIssue` takes `(inputs, now)`; use whatever `now` constant the file's other `buildIssue` tests use, and name it accordingly.)

In `src/components/home/todays-issue.test.tsx`, add `imageUrl` to both fixture stories (`"https://img.example/gemini.jpg"` for the first, `null` for the second) and add:

```ts
  it("shows each story's image, or the placeholder when it has none", () => {
    const { container } = render(<TodaysIssue issue={ISSUE} />);
    const rows = container.querySelectorAll("ol > li");
    expect(rows[0].querySelector("img")?.getAttribute("src")).toBe("https://img.example/gemini.jpg");
    expect(rows[1].querySelector("img")).toBeNull();
    expect(rows[1].querySelector("[data-story-image-placeholder]")).not.toBeNull();
  });

  it("renders the outlets once per row", () => {
    const { container } = render(<TodaysIssue issue={ISSUE} />);
    const first = container.querySelectorAll("ol > li")[0];
    expect(first.textContent?.match(/Ars Technica/g)).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/lib/news/issue.test.ts src/components/home/todays-issue.test.tsx`
Expected: FAIL (type errors on `imageUrl`, no `img` in rows, outlets rendered twice).

- [ ] **Step 3: Implement.**

`src/lib/news/issue.ts`: add `imageUrl: string | null;` to `IssueStoryInput` and to `IssueStory`, and `imageUrl: s.imageUrl,` in the `shown.map` that builds `stories`.

`src/lib/news/issue-data.ts`: add `imageUrl: s.imageUrl,` to the `IssueStoryInput` object built per story.

`src/components/home/todays-issue.tsx`: add `import { StoryImage } from "@/components/front-page/story-image";` and replace the row's `<Link …>…</Link>` with:

```tsx
                <Link
                  href={`/news/${story.slug}`}
                  className="group grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 px-5 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[3rem_minmax(0,1fr)_11rem] sm:gap-x-5 sm:px-6"
                >
                  <StoryImage
                    src={story.imageUrl}
                    label={story.beatName}
                    className="col-span-2 w-full sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:self-start"
                  />
                  <span aria-hidden="true" className="font-display text-2xl font-semibold text-transparent [-webkit-text-stroke:1px_#3b4552] group-hover:[-webkit-text-stroke:1px_#35e4ec] sm:col-start-1 sm:row-start-1">
                    {pad(i + 1)}
                  </span>
                  <span className="min-w-0 sm:col-start-2 sm:row-start-1">
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
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {story.outlets.map((o) => (
                        <span key={o} className="rounded-md border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{o}</span>
                      ))}
                    </span>
                  </span>
                </Link>
```

Layout notes: below `sm` the image spans both columns on the first grid row (above the numeral and text); from `sm` it moves to a third, 11rem (176px) column on the same row as the text. The right-hand outlet column is gone; outlets render once, under the takeaway.

- [ ] **Step 4: Run to pass, then the gate**

Run: `pnpm vitest run src/lib/news/issue.test.ts src/components/home/todays-issue.test.tsx` then `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/news/issue.ts src/lib/news/issue.test.ts src/lib/news/issue-data.ts src/components/home/todays-issue.tsx src/components/home/todays-issue.test.tsx
git commit -m "feat(home): today's brief shows each story's image"
```

- [ ] **Step 6 (controller): Browser check.** With `enki-dev` running: `MSYS_NO_PATHCONV=1 pnpm sweep -- --base http://localhost:3000 / /welcome /news` (PASS at narrow and wide); with Playwright, measure every `ol > li .aspect-video` frame in the brief at 390px, 1024px and 1440px (ratio 1.78, no document overflow) and screenshot the brief at each width.

---

### Task 4 (controller, after Task 3): Backfill

- [ ] List every `published` or `pending` story with `image_url is null` (Supabase MCP, read-only).
- [ ] For each, fetch its `source_url`'s `og:image` with the Task 1 rules (a local Node script importing nothing from the app is fine: same user-agent, 4 s timeout, https only), and show the owner the table of slug and image URL.
- [ ] After the owner's OK, write each with `update public.stories set image_url = '<url>' where id = '<id>' and image_url is null;` through the Supabase MCP, then re-list to confirm, and check `/news` and `/` in the browser.
