import { siteConfig } from "@/lib/site";
import { matchTools, type MatchableTool } from "@/lib/news/match-tools";
import { parseFeed, type FeedItem } from "@/lib/news/parse-feed";

export const INGEST_WINDOW_HOURS = 72;
export const MAX_ITEMS_PER_SOURCE = 30;
export const FEED_TIMEOUT_MS = 10_000;
const MAX_FEED_CHARS = 2_000_000;

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
  now?: Date;
  report?: (error: unknown, source: IngestSource) => void;
};

export type IngestSummary = {
  sources: number;
  fetched: number;
  inserted: number;
  /** Names of sources that could not be fetched or parsed. */
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
    headline: item.title.slice(0, 300),
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    sourcePublishedAt: item.publishedAt?.toISOString() ?? null,
    toolSlugs: matchTools(`${item.title}\n${item.excerpt ?? ""}`, tools),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  now = new Date(),
  report = () => {},
}: IngestDeps): Promise<IngestSummary> {
  const sources = await store.listSources();
  const summary: IngestSummary = { sources: sources.length, fetched: 0, inserted: 0, failed: [] };

  await Promise.all(
    sources.map(async (source) => {
      try {
        const items = selectRecent(parseFeed(await fetchFeed(source.feedUrl)), now);
        summary.fetched += items.length;
        for (const item of items) {
          try {
            if (await store.insertStory(toStory(item, source.id, tools))) summary.inserted += 1;
          } catch (error) {
            report(error, source);
          }
        }
        await store.touchSource(source.id, null);
      } catch (error) {
        summary.failed.push(source.name);
        report(error, source);
        await store.touchSource(source.id, message(error)).catch((touchError) => report(touchError, source));
      }
    }),
  );

  summary.failed.sort();
  return summary;
}
