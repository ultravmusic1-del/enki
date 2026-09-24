import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import type { PublicStory } from "@/lib/news/stories";
import { formatAge, formatDay, formatExactTime } from "@/lib/news/format-age";
import { StoryImage } from "@/components/front-page/story-image";
import { FounderTakeaway } from "@/components/news/founder-takeaway";

/**
 * Today's brief: the /news front page's main column. The stories that matter
 * today, lead first, each with its founder takeaway, so a reader knows what
 * happened and why it matters without opening a story.
 */
export function DailyBrief({
  stories,
  leadTools,
  minutes,
  now,
}: {
  stories: PublicStory[];
  leadTools: Tool[];
  minutes: number;
  now: Date;
}) {
  const [lead, ...rest] = stories;
  if (!lead) return null;
  const newest = stories.reduce((a, b) => (b.publishedAt > a.publishedAt ? b : a)).publishedAt;
  const count = `${stories.length} ${stories.length === 1 ? "story" : "stories"}`;

  return (
    <section
      aria-labelledby="brief-heading"
      className="flex min-w-0 flex-col rounded-2xl border border-border bg-card/60 ring-hairline"
    >
      <header className="flex flex-col gap-1.5 border-b border-border px-5 py-5 sm:px-6">
        <p className="font-mono text-xs text-teal">
          <time dateTime={newest}>{formatDay(newest)}</time>
        </p>
        <h1 id="brief-heading" className="font-display text-3xl font-semibold text-balance sm:text-4xl">
          Today&apos;s brief
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {count} that matter to founders, and what each one means for you. {minutes} min read.
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          Last updated <time dateTime={newest}>{formatExactTime(newest)}</time>
        </p>
      </header>

      <ol className="flex flex-col divide-y divide-border">
        <li data-testid="lead-story" className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <StoryImage src={lead.imageUrl} label={lead.beatName} priority className="w-full" />
          <BriefText story={lead} index={1} now={now} lead />
          {leadTools.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tools in this story">
              {leadTools.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="inline-flex rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs text-teal transition-colors hover:bg-teal/20"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        {rest.map((story, i) => (
          <li
            key={story.id}
            className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:px-6"
          >
            <BriefText story={story} index={i + 2} now={now} />
            <StoryImage src={story.imageUrl} label={story.beatName} className="hidden w-full self-start sm:block" />
          </li>
        ))}
      </ol>
    </section>
  );
}

function BriefText({ story, index, now, lead = false }: { story: PublicStory; index: number; now: Date; lead?: boolean }) {
  return (
    <div className="flex min-w-0 gap-3 sm:gap-4">
      <span aria-hidden="true" className="w-6 shrink-0 font-display text-xl leading-7 font-semibold text-teal tabular-nums">
        {index}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-mono text-xs break-words text-muted-foreground">
          <span className="text-teal">{story.beatName}</span> · {story.sourceName} ·{" "}
          {formatAge(story.publishedAt, now)}
        </p>
        <h2
          className={
            lead
              ? "font-sans text-2xl leading-tight font-semibold tracking-tight break-words text-balance"
              : "font-sans text-lg leading-snug font-semibold tracking-normal break-words text-pretty"
          }
        >
          <Link href={`/news/${story.slug}`} className="hover:text-teal">
            {story.headline}
          </Link>
        </h2>
        {lead ? <p className="text-pretty text-muted-foreground">{story.summary}</p> : null}
        <FounderTakeaway text={story.takeaway} />
        {!lead && !story.takeaway ? (
          <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">{story.summary}</p>
        ) : null}
      </div>
    </div>
  );
}
