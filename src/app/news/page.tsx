import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { BeatRow } from "@/components/news/beat-row";
import { NewsSearchForm } from "@/components/news/news-search-form";
import { TickerStrip } from "@/components/front-page/ticker-strip";
import { DailyBrief } from "@/components/front-page/daily-brief";
import { StoryRail } from "@/components/front-page/story-rail";
import { HomeSidebar } from "@/components/front-page/home-sidebar";
import { BeatSection } from "@/components/front-page/beat-section";
import { DirectoryBand } from "@/components/front-page/directory-band";
import { getHomeFeed } from "@/lib/news/home";
import { briefMinutes } from "@/lib/news/home-feed";
import { listActiveBeats, listPublishedStories } from "@/lib/news/stories";
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
  const [feed, allTools, featuredAll, stats, { total }, activeBeats] = await Promise.all([
    getHomeFeed(now),
    getAllTools(),
    getFeaturedTools(),
    getStats(),
    listPublishedStories({ page: 1 }),
    listActiveBeats(),
  ]);

  const bySlug = new Map(allTools.map((tool) => [tool.slug, tool]));
  const resolve = (slugs: string[]) =>
    slugs.map((slug) => bySlug.get(slug)).filter((tool): tool is Tool => tool !== undefined);
  const ticker = feed.ticker.flatMap(({ slug, count }) => {
    const tool = bySlug.get(slug);
    return tool ? [{ tool, count }] : [];
  });
  const topTools = [...allTools].sort((a, b) => b.editorScore - a.editorScore).slice(0, 5);
  const hasMorePages = pageCount(total) > 1;

  return (
    <Container className="flex flex-col gap-8 pt-28 pb-20">
      <BeatRow available={activeBeats} />

      {feed.lead ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <DailyBrief
              stories={feed.brief}
              leadTools={resolve(feed.leadToolSlugs)}
              minutes={briefMinutes(feed.brief)}
              now={now}
            />
            <div className="flex min-w-0 flex-col gap-6">
              <NewsSearchForm />
              <StoryRail title="Most read" stories={feed.mostRead} now={now} />
              <HomeSidebar topTools={topTools} className="hidden lg:flex" />
            </div>
          </div>

          <TickerStrip items={ticker} />

          {feed.beats.length > 0 ? (
            <section aria-labelledby="earlier-heading" className="flex flex-col gap-5">
              <h2 id="earlier-heading" className="font-display text-2xl font-semibold">
                Earlier this week
              </h2>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {feed.beats.map((beat) => (
                  <BeatSection key={beat.slug} slug={beat.slug} name={beat.name} stories={beat.stories} now={now} />
                ))}
              </div>
            </section>
          ) : null}

          <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {hasMorePages ? (
              <Link href="/news/page/2" className="font-semibold text-teal hover:text-teal-bright">
                Older stories &rarr;
              </Link>
            ) : null}
            <Link href="/news/about" className="text-muted-foreground hover:text-foreground">
              How Enki covers news
            </Link>
            <Link href="/news/corrections" className="text-muted-foreground hover:text-foreground">
              Corrections
            </Link>
          </p>

          <HomeSidebar topTools={topTools} className="lg:hidden" />
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-semibold">Today&apos;s brief</h1>
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
            The first stories are coming soon. Meanwhile, the directory is below.
          </p>
        </>
      )}

      <DirectoryBand
        toolCount={stats.toolCount}
        categoryCount={stats.categoryCount}
        featured={featuredAll.slice(0, 3)}
      />
    </Container>
  );
}
