import { getAllTools } from "@/lib/content";
import { buildHomeFeed, type HomeFeed } from "@/lib/news/home-feed";
import {
  getPopularStoryViews,
  getToolSlugsForStories,
  listRecentStories,
} from "@/lib/news/stories";

/** Loads the homepage's data in three parallel reads, then builds every section. */
export async function getHomeFeed(now: Date = new Date()): Promise<HomeFeed> {
  const stories = await listRecentStories();
  const [toolSlugsByStory, popular, tools] = await Promise.all([
    getToolSlugsForStories(stories.map((s) => s.id)),
    stories.length > 0 ? getPopularStoryViews() : Promise.resolve([]),
    getAllTools(),
  ]);
  return buildHomeFeed({
    stories,
    toolSlugsByStory,
    popular,
    knownToolSlugs: new Set(tools.map((t) => t.slug)),
    now,
  });
}
