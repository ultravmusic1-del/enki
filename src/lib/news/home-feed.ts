import { beats, type BeatSlug } from "@/data/beats";
import type { PublicStory } from "@/lib/news/stories";

/*
 * Every /news front-page rule lives here, pure, so it can be tested without a
 * database. The page only renders what this returns.
 *
 * The page is built around today's brief: the handful of stories that matter
 * today, each with its founder takeaway, readable in about five minutes.
 * Everything else is "Earlier this week", grouped by beat. A story appears in
 * exactly one place on the page.
 */

export const LEAD_WINDOW_HOURS = 48;
/** The brief is the stories published within this many hours of the newest one. */
export const BRIEF_WINDOW_HOURS = 24;
/** A thin news day is topped up with the next newest stories, up to this many. */
export const BRIEF_MIN = 3;
export const BRIEF_MAX = 6;
export const BEAT_WINDOW_DAYS = 7;
export const TICKER_WINDOW_DAYS = 7;
export const STORIES_PER_BEAT = 4;
export const POPULAR_COUNT = 5;
/** Most read is shown only once its top story has real traffic. */
export const POPULAR_MIN_TOP_VIEWS = 10;
/** The ticker stays hidden rather than showing a thin strip. */
export const TICKER_MIN_TOOLS = 3;
export const TICKER_MAX_TOOLS = 10;
const WORDS_PER_MINUTE = 230;

export type HomeFeed = {
  /** Today's brief, lead first. Empty only when nothing is published. */
  brief: PublicStory[];
  lead: PublicStory | null;
  leadToolSlugs: string[];
  /** Most-read stories not already in the brief; empty until traffic is real. */
  mostRead: PublicStory[];
  /** Earlier this week, by beat, with no story repeated from the brief or Most read. */
  beats: { slug: BeatSlug; name: string; stories: PublicStory[] }[];
  ticker: { slug: string; count: number }[];
};

const HOUR_MS = 3_600_000;

function isWithin(iso: string, now: Date, ms: number): boolean {
  return now.getTime() - new Date(iso).getTime() <= ms;
}

/** Minutes to read the brief as shown: headline, summary and founder takeaway of each story. */
export function briefMinutes(stories: PublicStory[]): number {
  const words = stories
    .map((s) => `${s.headline} ${s.summary} ${s.takeaway ?? ""}`)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function selectBrief(sorted: PublicStory[], now: Date): PublicStory[] {
  if (sorted.length === 0) return [];
  const newest = new Date(sorted[0].publishedAt).getTime();
  const featured = sorted.find((s) => s.featured && isWithin(s.publishedAt, now, LEAD_WINDOW_HOURS * HOUR_MS));
  const today = sorted.filter((s) => newest - new Date(s.publishedAt).getTime() <= BRIEF_WINDOW_HOURS * HOUR_MS);
  const pool = today.length >= BRIEF_MIN ? today : sorted.slice(0, BRIEF_MIN);
  const ordered = featured ? [featured, ...pool.filter((s) => s.id !== featured.id)] : pool;
  return ordered.slice(0, BRIEF_MAX);
}

export function buildHomeFeed({
  stories,
  toolSlugsByStory,
  popular,
  knownToolSlugs,
  now,
}: {
  stories: PublicStory[];
  toolSlugsByStory: Map<string, string[]>;
  popular: { storyId: string; views: number }[];
  knownToolSlugs: ReadonlySet<string>;
  now: Date;
}): HomeFeed {
  const sorted = [...stories].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const known = (slugs: string[] | undefined) => (slugs ?? []).filter((slug) => knownToolSlugs.has(slug));

  const brief = selectBrief(sorted, now);
  const lead = brief[0] ?? null;
  const shown = new Set(brief.map((s) => s.id));

  const byId = new Map(sorted.map((s) => [s.id, s]));
  const viewsByStoryId = new Map(popular.map((p) => [p.storyId, p.views]));
  const popularStories = popular
    .map((p) => byId.get(p.storyId))
    .filter((s): s is PublicStory => s !== undefined && !shown.has(s.id))
    .slice(0, POPULAR_COUNT);
  const topViews = popularStories.length > 0 ? (viewsByStoryId.get(popularStories[0].id) ?? 0) : 0;
  const mostRead = topViews >= POPULAR_MIN_TOP_VIEWS ? popularStories : [];
  for (const s of mostRead) shown.add(s.id);

  const beatWindowMs = BEAT_WINDOW_DAYS * 24 * HOUR_MS;
  const earlier = sorted.filter((s) => !shown.has(s.id) && isWithin(s.publishedAt, now, beatWindowMs));
  const beatSections = beats
    .map((beat) => ({
      slug: beat.slug,
      name: beat.name,
      stories: earlier.filter((s) => s.beat === beat.slug).slice(0, STORIES_PER_BEAT),
    }))
    .filter((section) => section.stories.length > 0);

  const tickerWindowMs = TICKER_WINDOW_DAYS * 24 * HOUR_MS;
  const counts = new Map<string, number>();
  for (const s of sorted) {
    if (!isWithin(s.publishedAt, now, tickerWindowMs)) continue;
    for (const slug of new Set(known(toolSlugsByStory.get(s.id)))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  const ranked = [...counts]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

  return {
    brief,
    lead,
    leadToolSlugs: lead ? known(toolSlugsByStory.get(lead.id)) : [],
    mostRead,
    beats: beatSections,
    ticker: ranked.length >= TICKER_MIN_TOOLS ? ranked.slice(0, TICKER_MAX_TOOLS) : [],
  };
}
