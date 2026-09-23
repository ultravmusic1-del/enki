import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { BeatRow } from "@/components/news/beat-row";
import { TickerStrip } from "@/components/front-page/ticker-strip";
import { LeadStory } from "@/components/front-page/lead-story";
import { StoryRail } from "@/components/front-page/story-rail";
import { HomeSidebar } from "@/components/front-page/home-sidebar";
import { BeatSection } from "@/components/front-page/beat-section";
import { CompactStoryList } from "@/components/front-page/compact-story-list";
import { DirectoryBand } from "@/components/front-page/directory-band";
import { getHomeFeed } from "@/lib/news/home";
import { listPublishedStories } from "@/lib/news/stories";
import { pageCount } from "@/lib/news/story-meta";
import { getAllTools, getFeaturedTools, getStats } from "@/lib/content";
import type { Tool } from "@/lib/schemas";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI news",
  description: "The day's AI stories for founders, written in full from the best reporting, with what each one means for your company.",
  alternates: { canonical: "/news" },
};

export default async function NewsFrontPage() {
  const now = new Date();
  const [feed, allTools, featuredAll, stats, { total }] = await Promise.all([
    getHomeFeed(now),
    getAllTools(),
    getFeaturedTools(),
    getStats(),
    listPublishedStories({ page: 1 }),
  ]);

  const bySlug = new Map(allTools.map((tool) => [tool.slug, tool]));
  const resolve = (slugs: string[]) =>
    slugs.map((slug) => bySlug.get(slug)).filter((tool): tool is Tool => tool !== undefined);
  const ticker = feed.ticker.flatMap(({ slug, count }) => {
    const tool = bySlug.get(slug);
    return tool ? [{ tool, count }] : [];
  });
  const topTools = [...allTools].sort((a, b) => b.editorScore - a.editorScore).slice(0, 5);
  const hasRail = feed.rail.stories.length > 0;
  const hasMorePages = pageCount(total) > 1;

  return (
    <Container className="flex flex-col gap-8 pt-28 pb-20">
      <h1 className="sr-only">AI news, curated by Enki</h1>
      <BeatRow />

      {feed.lead ? (
        <>
          <TickerStrip items={ticker} />

          <div
            className={
              hasRail
                ? "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            }
          >
            <LeadStory story={feed.lead} tools={resolve(feed.leadToolSlugs)} now={now} />
            <StoryRail title={feed.rail.title} stories={feed.rail.stories} now={now} />
            {/* Desktop position; on phones the sidebar comes after the beats (spec §7.7). */}
            <HomeSidebar topTools={topTools} className="hidden lg:flex" />
          </div>

          {feed.beats.length > 0 || feed.latest.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {feed.beats.map((beat) => (
                <BeatSection key={beat.slug} slug={beat.slug} name={beat.name} stories={beat.stories} now={now} />
              ))}
              {feed.latest.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h2 className="font-display text-xl font-semibold">Latest</h2>
                  <CompactStoryList stories={feed.latest} now={now} />
                  {hasMorePages ? (
                    <Link href="/news/page/2" className="text-sm text-teal hover:text-teal-bright">
                      Older stories
                    </Link>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}

          <HomeSidebar topTools={topTools} className="lg:hidden" />
        </>
      ) : (
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
          The first stories are coming soon. Meanwhile, the directory is below.
        </p>
      )}

      <DirectoryBand
        toolCount={stats.toolCount}
        categoryCount={stats.categoryCount}
        featured={featuredAll.slice(0, 3)}
      />
      {hasMorePages ? (
        <Link href="/news/page/2" className="self-start text-sm font-semibold text-teal hover:text-teal-bright">
          Older stories &rarr;
        </Link>
      ) : null}
    </Container>
  );
}
