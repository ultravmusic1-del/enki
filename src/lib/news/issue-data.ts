import { buildIssue, makingStats, type Issue, type IssueStoryInput, type MakingStats } from "@/lib/news/issue";
import { getStorySources, listRecentFullStories } from "@/lib/news/stories";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's issue and the last 7 days' figures, from published full stories. Never throws. */
export async function getHomeIssueData(now: Date): Promise<{ issue: Issue | null; stats: MakingStats }> {
  const stories = await listRecentFullStories(30);
  const since = now.getTime() - 7 * DAY_MS;
  const needed = stories.filter((s, i) => i < 3 || s.featured || new Date(s.publishedAt).getTime() >= since);
  const inputs: IssueStoryInput[] = await Promise.all(
    needed.map(async (s) => {
      const sources = await getStorySources(s.id);
      return {
        slug: s.slug,
        headline: s.headline,
        summary: s.summary,
        beat: s.beat,
        beatName: s.beatName,
        body: s.body,
        bodyWords: s.bodyWords,
        publishedAt: s.publishedAt,
        featured: s.featured,
        sources: sources.length > 0 ? sources.map((x) => x.name) : [s.sourceName],
      };
    }),
  );
  return { issue: buildIssue(inputs), stats: makingStats(inputs, now) };
}
