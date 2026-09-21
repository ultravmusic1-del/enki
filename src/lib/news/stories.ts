import { getBeat, type BeatSlug } from "@/data/beats";
import { getToolBySlug } from "@/lib/content";
import type { Tool } from "@/lib/schemas";
import { isIndexableTake } from "@/lib/news/schemas";
import { MORE_IN_BEAT, pageRange } from "@/lib/news/story-meta";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Public reads of published stories.
 *
 * Uses the cookieless anon client, so RLS limits every query to
 * status = 'published' even if a filter here were dropped; the explicit
 * status filters are defence in depth. `story_excerpts` is never read here:
 * the publisher's text is admin-only by design.
 *
 * Every read degrades instead of throwing. A paused free-tier database gives
 * an empty archive and a 404 story, never a crashed render.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The read timeout. 2.5 s at request time so a paused database degrades
 * quickly; much longer during `next build`, where parallel page generation
 * saturates the event loop and a short timer fires before healthy responses
 * are processed (seen: every build-time story read timed out, baking empty
 * pages).
 */
export function dbTimeoutMs(phase: string | undefined = process.env.NEXT_PHASE): number {
  return phase === "phase-production-build" ? 20_000 : 2_500;
}

const PUBLIC_STORY_COLUMNS =
  "id, slug, headline, summary, take, beat, image_url, source_name, source_site_url, source_url, source_published_at, published_at, featured";

export type PublicStoryRow = {
  id: string;
  slug: string | null;
  headline: string;
  summary: string | null;
  take: string | null;
  beat: string | null;
  image_url: string | null;
  source_name: string;
  source_site_url: string;
  source_url: string;
  source_published_at: string | null;
  published_at: string | null;
  featured: boolean;
};

export type PublicStory = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  take: string | null;
  beat: BeatSlug;
  beatName: string;
  imageUrl: string | null;
  sourceName: string;
  sourceSiteUrl: string;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  publishedAt: string;
  featured: boolean;
};

export function toPublicStory(row: PublicStoryRow): PublicStory | null {
  const beat = row.beat ? getBeat(row.beat) : undefined;
  if (!row.slug || !row.summary || !row.published_at || !beat) return null;
  return {
    id: row.id,
    slug: row.slug,
    headline: row.headline,
    summary: row.summary,
    take: row.take,
    beat: beat.slug,
    beatName: beat.name,
    imageUrl: row.image_url,
    sourceName: row.source_name,
    sourceSiteUrl: row.source_site_url,
    sourceUrl: row.source_url,
    sourcePublishedAt: row.source_published_at,
    publishedAt: row.published_at,
    featured: row.featured,
  };
}

function toPublicStories(rows: unknown): PublicStory[] {
  return ((rows ?? []) as PublicStoryRow[])
    .map(toPublicStory)
    .filter((s): s is PublicStory => s !== null);
}

/** The query's result, or null on error, throw or timeout (each logged). */
async function withTimeout<R extends { error: unknown }>(
  query: PromiseLike<R>,
  label: string,
): Promise<R | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), dbTimeoutMs());
  });
  try {
    const result = await Promise.race([query, timeout]);
    if (result === null) {
      console.error(`[enki] ${label} timed out`);
      return null;
    }
    if (result.error) {
      // PGRST103: PostgREST's answer to a range past the end of the result
      // set (e.g. an archive page number beyond the last page). That is an
      // empty result, not a failure, so it is not logged as one.
      const code = (result.error as { code?: string } | null)?.code;
      if (code !== "PGRST103") {
        console.error(`[enki] ${label} failed`, result.error);
      }
      return null;
    }
    return result;
  } catch (error) {
    console.error(`[enki] ${label} threw`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPublishedStory(slug: string): Promise<PublicStory | null> {
  if (!SLUG_RE.test(slug)) return null;
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(PUBLIC_STORY_COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    "getPublishedStory",
  );
  return result?.data ? toPublicStory(result.data as unknown as PublicStoryRow) : null;
}

/** The story's tools in position order, skipping any no longer in the directory. */
export async function getStoryTools(storyId: string): Promise<Tool[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("story_tools")
      .select("tool_slug, position")
      .eq("story_id", storyId)
      .order("position"),
    "getStoryTools",
  );
  const slugs = ((result?.data ?? []) as { tool_slug: string }[]).map((r) => r.tool_slug);
  const tools = await Promise.all(slugs.map((slug) => getToolBySlug(slug)));
  return tools.filter((t): t is Tool => t !== undefined);
}

export async function listPublishedStories(
  opts: { page?: number; beat?: BeatSlug } = {},
): Promise<{ stories: PublicStory[]; total: number }> {
  const { from, to } = pageRange(opts.page ?? 1);
  let query = createAnonClient()
    .from("stories")
    .select(PUBLIC_STORY_COLUMNS, { count: "exact" })
    .eq("status", "published");
  if (opts.beat) query = query.eq("beat", opts.beat);
  const result = await withTimeout(
    query.order("published_at", { ascending: false }).range(from, to),
    "listPublishedStories",
  );
  if (!result) return { stories: [], total: 0 };
  const stories = toPublicStories(result.data);
  return { stories, total: result.count ?? stories.length };
}

export async function listMoreInBeat(beat: BeatSlug, excludeId: string): Promise<PublicStory[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(PUBLIC_STORY_COLUMNS)
      .eq("status", "published")
      .eq("beat", beat)
      .neq("id", excludeId)
      .order("published_at", { ascending: false })
      .limit(MORE_IN_BEAT),
    "listMoreInBeat",
  );
  return toPublicStories(result?.data);
}

/** Stories whose take makes them indexable, for the sitemap. */
export async function listIndexableStories(): Promise<{ slug: string; publishedAt: string }[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select("slug, take, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000),
    "listIndexableStories",
  );
  const rows = (result?.data ?? []) as { slug: string | null; take: string | null; published_at: string | null }[];
  return rows.flatMap((r) =>
    r.slug && r.published_at && isIndexableTake(r.take)
      ? [{ slug: r.slug, publishedAt: r.published_at }]
      : [],
  );
}

/** Enough stories for the homepage's windows at current volume (5-15 a day). */
export const HOME_STORY_LIMIT = 200;

export async function listRecentStories(limit: number = HOME_STORY_LIMIT): Promise<PublicStory[]> {
  const result = await withTimeout(
    createAnonClient()
      .from("stories")
      .select(PUBLIC_STORY_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit),
    "listRecentStories",
  );
  return toPublicStories(result?.data);
}

/** Tool slugs per story, in position order, for many stories in one query. */
export async function getToolSlugsForStories(storyIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (storyIds.length === 0) return map;
  const result = await withTimeout(
    createAnonClient()
      .from("story_tools")
      .select("story_id, tool_slug, position")
      .in("story_id", storyIds)
      .order("position"),
    "getToolSlugsForStories",
  );
  for (const row of (result?.data ?? []) as { story_id: string; tool_slug: string }[]) {
    map.set(row.story_id, [...(map.get(row.story_id) ?? []), row.tool_slug]);
  }
  return map;
}

/** Most-viewed published stories in the window (aggregate counts only). */
export async function getPopularStoryViews(
  hours = 48,
  limit = 5,
): Promise<{ storyId: string; views: number }[]> {
  const result = await withTimeout(
    createAnonClient().rpc("popular_stories", { p_hours: hours, p_limit: limit }),
    "getPopularStoryViews",
  );
  return ((result?.data ?? []) as { story_id: string; views: number }[]).map((r) => ({
    storyId: r.story_id,
    views: Number(r.views),
  }));
}
