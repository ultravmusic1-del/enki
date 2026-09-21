import { beats, type BeatSlug } from "@/data/beats";
import type { PublicStory } from "@/lib/news/stories";

/*
 * Every homepage rule lives here, pure, so it can be tested without a
 * database. Spec §7. The page only renders what this returns.
 */

export const LEAD_WINDOW_HOURS = 48;
export const BEAT_WINDOW_DAYS = 7;
export const TICKER_WINDOW_DAYS = 7;
export const STORIES_PER_BEAT = 4;
export const LATEST_COUNT = 5;
export const POPULAR_COUNT = 5;
/** Popular is shown only once its top story has real traffic (spec §7.3). */
export const POPULAR_MIN_TOP_VIEWS = 10;
/** The ticker stays hidden rather than showing a thin strip (spec §7.2). */
export const TICKER_MIN_TOOLS = 3;
export const TICKER_MAX_TOOLS = 10;

export type HomeFeed = {
  lead: PublicStory | null;
  leadToolSlugs: string[];
  rail: { title: "Popular" | "Latest"; stories: PublicStory[] };
  beats: { slug: BeatSlug; name: string; stories: PublicStory[] }[];
  latest: PublicStory[];
  ticker: { slug: string; count: number }[];
};

const HOUR_MS = 3_600_000;

function isWithin(iso: string, now: Date, ms: number): boolean {
  return now.getTime() - new Date(iso).getTime() <= ms;
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

  const lead =
    sorted.find((s) => s.featured && isWithin(s.publishedAt, now, LEAD_WINDOW_HOURS * HOUR_MS)) ??
    sorted[0] ??
    null;
  const rest = sorted.filter((s) => s.id !== lead?.id);

  const byId = new Map(sorted.map((s) => [s.id, s]));
  const viewsByStoryId = new Map(popular.map((p) => [p.storyId, p.views]));
  const popularStories = popular
    .map((p) => byId.get(p.storyId))
    .filter((s): s is PublicStory => s !== undefined && s.id !== lead?.id)
    .slice(0, POPULAR_COUNT);
  const topRailViews = popularStories.length > 0 ? (viewsByStoryId.get(popularStories[0].id) ?? 0) : 0;
  const rail: HomeFeed["rail"] =
    popularStories.length > 0 && topRailViews >= POPULAR_MIN_TOP_VIEWS
      ? { title: "Popular", stories: popularStories }
      : { title: "Latest", stories: rest.slice(0, POPULAR_COUNT) };

  const inRail = new Set(rail.stories.map((s) => s.id));
  const latest = rest.filter((s) => !inRail.has(s.id)).slice(0, LATEST_COUNT);

  const beatWindowMs = BEAT_WINDOW_DAYS * 24 * HOUR_MS;
  const beatSections = beats
    .map((beat) => ({
      slug: beat.slug,
      name: beat.name,
      stories: rest
        .filter((s) => s.beat === beat.slug && isWithin(s.publishedAt, now, beatWindowMs))
        .slice(0, STORIES_PER_BEAT),
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
    lead,
    leadToolSlugs: lead ? known(toolSlugsByStory.get(lead.id)) : [],
    rail,
    beats: beatSections,
    latest,
    ticker: ranked.length >= TICKER_MIN_TOOLS ? ranked.slice(0, TICKER_MAX_TOOLS) : [],
  };
}
