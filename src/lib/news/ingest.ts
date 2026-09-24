import { siteConfig } from "@/lib/site";
import { matchTools, type MatchableTool } from "@/lib/news/match-tools";
import { parseFeed, type FeedItem } from "@/lib/news/parse-feed";
import { fetchOgImage } from "@/lib/news/og-image";

export const INGEST_WINDOW_HOURS = 72;
export const MAX_ITEMS_PER_SOURCE = 30;
export const FEED_TIMEOUT_MS = 10_000;
const MAX_FEED_CHARS = 2_000_000;

/** The cron runs daily, so items newer than this are the ones not seen before. */
export const OG_WINDOW_HOURS = 24;
export const MAX_OG_FETCHES_PER_SOURCE = 10;
export const OG_CONCURRENCY = 4;

export type IngestSource = { id: string; name: string; feedUrl: string };

export type IngestStory = {
  sourceId: string;
  sourceUrl: string;
  headline: string;
  excerpt: string | null;
  imageUrl: string | null;
  sourcePublishedAt: string | null;
  toolSlugs: string[];
};

/** Where ingestion reads sources from and writes stories to. */
export interface IngestStore {
  listSources(): Promise<IngestSource[]>;
  /** Resolves true for a new row, false for a duplicate. */
  insertStory(story: IngestStory): Promise<boolean>;
  touchSource(id: string, error: string | null): Promise<void>;
}

export type IngestDeps = {
  store: IngestStore;
  tools: readonly MatchableTool[];
  fetchFeed?: (url: string) => Promise<string>;
  /** The article page's og:image for feed items without an image. */
  fetchImage?: (url: string) => Promise<string | null>;
  now?: Date;
  report?: (error: unknown, source: IngestSource) => void;
};

export type IngestSummary = {
  sources: number;
  fetched: number;
  inserted: number;
  /** Names of sources that could not be fetched or parsed, or whose every insert failed. */
  failed: string[];
};

export async function fetchFeedText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    cache: "no-store",
    headers: {
      "user-agent": `EnkiNewsBot/1.0 (+${siteConfig.url}/news/about)`,
      accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Feed responded ${response.status}`);
  const body = await response.text();
  if (body.length > MAX_FEED_CHARS) throw new Error("Feed is larger than 2 MB");
  return body;
}

/** Items from the ingest window, newest-first as the feed ordered them, capped per source. */
export function selectRecent(items: FeedItem[], now: Date): FeedItem[] {
  const cutoff = now.getTime() - INGEST_WINDOW_HOURS * 3_600_000;
  return items
    .filter((item) => item.publishedAt === null || item.publishedAt.getTime() >= cutoff)
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

function toStory(item: FeedItem, sourceId: string, tools: readonly MatchableTool[]): IngestStory {
  return {
    sourceId,
    sourceUrl: item.url,
    // Array.from splits on code points, not UTF-16 code units, so this never
    // cuts a surrogate pair in half.
    headline: Array.from(item.title).slice(0, 300).join(""),
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    sourcePublishedAt: item.publishedAt?.toISOString() ?? null,
    toolSlugs: matchTools(`${item.title}\n${item.excerpt ?? ""}`, tools),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A reporter is diagnostic, not load-bearing: its own failure must never hide the original error. */
function safeReport(
  report: (error: unknown, source: IngestSource) => void,
  error: unknown,
  source: IngestSource,
): void {
  try {
    report(error, source);
  } catch {
    // swallowed on purpose
  }
}

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

/**
 * Fetch every active source and queue its recent items as pending stories.
 *
 * One broken feed never fails the run: it is reported, recorded on the source,
 * and skipped. Only a failure to list sources (a bad secret, the database
 * down) rejects, because then nothing ran at all.
 */
export async function ingestAll({
  store,
  tools,
  fetchFeed = fetchFeedText,
  fetchImage = fetchOgImage,
  now = new Date(),
  report = () => {},
}: IngestDeps): Promise<IngestSummary> {
  const sources = await store.listSources();
  const summary: IngestSummary = { sources: sources.length, fetched: 0, inserted: 0, failed: [] };

  await Promise.all(
    sources.map(async (source) => {
      try {
        const items = await withOgImages(selectRecent(parseFeed(await fetchFeed(source.feedUrl)), now), now, fetchImage);
        summary.fetched += items.length;
        let insertErrors = 0;
        let firstInsertError: string | null = null;
        for (const item of items) {
          try {
            if (await store.insertStory(toStory(item, source.id, tools))) summary.inserted += 1;
          } catch (error) {
            insertErrors += 1;
            firstInsertError ??= message(error);
            safeReport(report, error, source);
          }
        }
        // Every attempt threw: nothing about this source's fetch actually
        // reached the store, so it is a failure, not a healthy empty run.
        if (items.length > 0 && insertErrors === items.length) {
          summary.failed.push(source.name);
          await store
            .touchSource(source.id, firstInsertError)
            .catch((touchError) => safeReport(report, touchError, source));
        } else {
          await store.touchSource(source.id, null);
        }
      } catch (error) {
        summary.failed.push(source.name);
        safeReport(report, error, source);
        await store
          .touchSource(source.id, message(error))
          .catch((touchError) => safeReport(report, touchError, source));
      }
    }),
  );

  summary.failed.sort();
  return summary;
}
