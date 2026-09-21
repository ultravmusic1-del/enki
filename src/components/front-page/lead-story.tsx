import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import type { PublicStory } from "@/lib/news/stories";
import { formatAge } from "@/lib/news/format-age";
import { StoryImage } from "@/components/front-page/story-image";

export function LeadStory({ story, tools, now }: { story: PublicStory; tools: Tool[]; now: Date }) {
  const reportedAt = story.sourcePublishedAt ?? story.publishedAt;
  return (
    <article className="grid gap-5 rounded-2xl border border-border bg-card/60 p-5 ring-hairline sm:p-6 md:grid-cols-2">
      {story.imageUrl ? <StoryImage src={story.imageUrl} priority className="aspect-video w-full md:aspect-auto md:min-h-56" /> : null}
      <div className={story.imageUrl ? "flex flex-col gap-3" : "flex flex-col gap-3 md:col-span-2"}>
        <p className="font-mono text-xs tracking-wide text-teal uppercase">{story.beatName}</p>
        <h2 className="font-display text-2xl leading-tight font-semibold break-words text-balance sm:text-3xl">
          <Link href={`/news/${story.slug}`} className="hover:text-teal">
            {story.headline}
          </Link>
        </h2>
        <p className="text-pretty text-muted-foreground">{story.summary}</p>
        <p className="font-mono text-xs break-words text-muted-foreground">
          {story.sourceName} · {formatAge(reportedAt, now)}
        </p>
        {tools.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
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
      </div>
    </article>
  );
}
