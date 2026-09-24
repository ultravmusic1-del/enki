import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { AffiliateDisclosure } from "@/components/shared/affiliate-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import { StoryToolCard } from "@/components/news/story-tool-card";
import { StoryList } from "@/components/news/story-list";
import { StoryViewPing } from "@/components/news/story-view-ping";
import { BeatRow } from "@/components/news/beat-row";
import { ArticleBody, FounderSection } from "@/components/news/article-body";
import { StoryImage } from "@/components/front-page/story-image";
import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";
import { BeehiivScripts } from "@/components/newsletter/beehiiv-scripts";
import { breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/structured-data";
import { formatAge, formatExactTime } from "@/lib/news/format-age";
import { splitSources } from "@/lib/news/primary-sources";
import { correctionsFor, lastUpdatedAt, NEWS_DESK_EMAIL, NEWS_EDITOR } from "@/data/newsroom";
import { storyRobots } from "@/lib/news/story-meta";
import {
  getPublishedStory,
  getStoryTools,
  getStorySources,
  listActiveBeats,
  listMoreInBeat,
  type StorySource,
} from "@/lib/news/stories";
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
    robots: storyRobots(story.bodyWords),
    openGraph: {
      type: "article",
      title: story.headline,
      description: story.summary,
      publishedTime: story.publishedAt,
      ...(lastUpdatedAt(story.slug) ? { modifiedTime: lastUpdatedAt(story.slug) ?? undefined } : {}),
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) notFound();

  const [tools, more, fetchedSources, activeBeats] = await Promise.all([
    getStoryTools(story.id),
    listMoreInBeat(story.beat, story.id),
    getStorySources(story.id),
    listActiveBeats(),
  ]);
  const sources: StorySource[] =
    fetchedSources.length > 0
      ? fetchedSources
      : [{ name: story.sourceName, siteUrl: story.sourceSiteUrl, url: story.sourceUrl }];
  const outletNames = [...new Set(sources.map((s) => s.name))];
  const hasBody = story.body !== null && story.bodyWords > 0;
  const now = new Date();
  const reportedAt = story.sourcePublishedAt ?? story.publishedAt;
  const indexable = storyRobots(story.bodyWords).index;
  const storyCorrections = correctionsFor(story.slug);
  const updatedAt = lastUpdatedAt(story.slug);
  const { primary, reporting } = splitSources(sources, story.body);
  const reportEmail = NEWS_EDITOR?.email ?? NEWS_DESK_EMAIL;

  return (
    <Container className="pt-28 pb-20">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "News", path: "/news" },
          { name: story.beatName, path: `/news/beat/${story.beat}` },
          { name: story.headline, path: `/news/${story.slug}` },
        ])}
      />
      {indexable ? <JsonLd data={newsArticleJsonLd(story, sources, updatedAt)} /> : null}

      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <StoryViewPing storyId={story.id} />
        <header className="flex flex-col gap-4">
          <BeatRow className="mb-2" available={activeBeats} />
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
          <h1 className="font-sans text-3xl leading-tight font-semibold tracking-tight break-words text-balance sm:text-4xl">
            {story.headline}
          </h1>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-foreground">By Enki</span>
              <span aria-hidden>·</span>
              <span>
                {NEWS_EDITOR ? `Edited by ${NEWS_EDITOR.name}, ${NEWS_EDITOR.role}` : "Checked by the Enki news desk"}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
              <span>
                Published <time dateTime={story.publishedAt}>{formatExactTime(story.publishedAt)}</time>
              </span>
              {updatedAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-foreground">
                    Updated <time dateTime={updatedAt}>{formatExactTime(updatedAt)}</time>
                  </span>
                </>
              ) : null}
            </p>
            {hasBody ? (
              <p className="break-words">Reporting from {outletNames.join(", ")}</p>
            ) : (
              <p className="break-words">
                Reported by{" "}
                <a
                  href={safeExternalHref(story.sourceSiteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-teal"
                >
                  {story.sourceName}
                </a>{" "}
                · <time dateTime={reportedAt}>{formatAge(reportedAt, now)}</time>
              </p>
            )}
          </div>
        </header>

        {story.imageUrl ? <StoryImage src={story.imageUrl} priority className="w-full" /> : null}

        <p className="text-lg leading-relaxed text-pretty">{story.summary}</p>

        {hasBody && story.body ? (
          <>
            <FounderSection body={story.body} />
            <div className="flex flex-col gap-4">
              <h2 className="font-mono text-xs tracking-[0.3em] text-teal uppercase">The story</h2>
              <ArticleBody body={story.body} includeFounders={false} />
            </div>
            <section aria-labelledby="sources-heading" className="flex flex-col gap-4 border-t border-border pt-6">
              <h2 id="sources-heading" className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
                Sources
              </h2>
              {primary.length > 0 ? (
                <SourceGroup title="Primary sources" links={primary} />
              ) : null}
              <SourceGroup
                title={primary.length > 0 ? "Reporting" : undefined}
                links={reporting.map((r) => ({ name: r.name, url: r.url }))}
              />
            </section>
            {storyCorrections.length > 0 ? (
              <section
                aria-labelledby="corrections-heading"
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 ring-hairline"
              >
                <h2 id="corrections-heading" className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
                  {storyCorrections.length === 1 ? "Correction" : "Corrections"}
                </h2>
                <ul className="flex flex-col gap-2 text-sm">
                  {storyCorrections.map((c) => (
                    <li key={c.at}>
                      <time dateTime={c.at} className="font-mono text-xs text-muted-foreground">
                        {formatExactTime(c.at)}
                      </time>
                      <p className="mt-1 text-pretty">{c.note}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 ring-hairline sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-[220px] w-[360px] rounded-full bg-teal/15 blur-[70px]" />
              <p className="relative font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki Daily</p>
              <h2 className="relative mt-2 font-display text-2xl font-semibold text-balance">
                Get stories like this every weekday morning.
              </h2>
              <p className="relative mt-2 text-sm text-muted-foreground">
                The day&apos;s AI stories for founders, each with what it means for your company. Free.
              </p>
              <BeehiivEmbed form="story" lazy className="relative mt-5 max-w-md" />
              <BeehiivScripts />
            </section>
          </>
        ) : (
          <>
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
          </>
        )}

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

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Link href="/news/about" className="hover:text-foreground hover:underline">
            How Enki covers news
          </Link>
          <Link href="/news/corrections" className="hover:text-foreground hover:underline">
            Corrections
          </Link>
          <a
            href={`mailto:${reportEmail}?subject=${encodeURIComponent(`Correction: ${story.headline}`)}`}
            className="hover:text-foreground hover:underline"
          >
            Report an error
          </a>
        </p>
      </article>
    </Container>
  );
}

function SourceGroup({ title, links }: { title?: string; links: { name: string; url: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((link) => (
          <li key={link.url} className="min-w-0">
            <a
              href={safeExternalHref(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <span className="break-words">{link.name}</span>
              <Icon name="ArrowUpRight" className="size-3.5 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
