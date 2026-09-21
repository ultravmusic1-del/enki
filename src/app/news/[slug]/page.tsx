import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { AffiliateDisclosure } from "@/components/shared/affiliate-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import { StoryToolCard } from "@/components/news/story-tool-card";
import { StoryList } from "@/components/news/story-list";
import { breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/structured-data";
import { formatAge } from "@/lib/news/format-age";
import { storyRobots } from "@/lib/news/story-meta";
import { getPublishedStory, getStoryTools, listMoreInBeat } from "@/lib/news/stories";
import { safeExternalHref } from "@/lib/safe-url";

// Rendered on demand and cached; admin publish/unpublish revalidates /news.
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) return { title: "Story not found", robots: { index: false, follow: false } };
  return {
    title: story.headline,
    description: story.summary,
    alternates: { canonical: `/news/${story.slug}` },
    robots: storyRobots(story.take),
    openGraph: {
      type: "article",
      title: story.headline,
      description: story.summary,
      publishedTime: story.publishedAt,
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) notFound();

  const [tools, more] = await Promise.all([
    getStoryTools(story.id),
    listMoreInBeat(story.beat, story.id),
  ]);
  const now = new Date();
  const reportedAt = story.sourcePublishedAt ?? story.publishedAt;
  const indexable = storyRobots(story.take).index;

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "News", path: "/news" },
          { name: story.beatName, path: `/news/beat/${story.beat}` },
          { name: story.headline, path: `/news/${story.slug}` },
        ])}
      />
      {indexable ? <JsonLd data={newsArticleJsonLd(story)} /> : null}

      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <nav
            aria-label="Breadcrumb"
            className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
          >
            <Link href="/news" className="hover:text-foreground">
              News
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <Link href={`/news/beat/${story.beat}`} className="text-teal hover:text-teal-bright">
              {story.beatName}
            </Link>
          </nav>
          <h1 className="font-display text-3xl leading-tight font-semibold break-words text-balance sm:text-4xl">
            {story.headline}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <a
              href={safeExternalHref(story.sourceSiteUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-foreground hover:text-teal"
            >
              {story.sourceName}
            </a>
            <span aria-hidden>·</span>
            <time dateTime={reportedAt}>{formatAge(reportedAt, now)}</time>
            <span aria-hidden>·</span>
            <span>Summary by Enki</span>
          </p>
        </header>

        <p className="text-lg leading-relaxed text-pretty">{story.summary}</p>

        {story.take ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-6 ring-hairline">
            <h2 className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki&apos;s take</h2>
            <p className="leading-relaxed whitespace-pre-line text-pretty">{story.take}</p>
          </section>
        ) : null}

        <a
          href={safeExternalHref(story.sourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-[#04171a] transition-colors hover:bg-teal-bright"
        >
          <span className="break-words">Read the full story at {story.sourceName}</span>
          <Icon name="ArrowUpRight" className="size-4 shrink-0" />
        </a>

        {tools.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">Tools in this story</h2>
            <AffiliateDisclosure className="text-xs text-muted-foreground" />
            <div className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <StoryToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        ) : null}

        {more.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">More in {story.beatName}</h2>
            <StoryList stories={more} now={now} showBeat={false} />
          </section>
        ) : null}

        <p className="text-sm text-muted-foreground">
          <Link href="/news/about" className="hover:text-foreground hover:underline">
            How Enki covers news
          </Link>
        </p>
      </article>
    </Container>
  );
}
