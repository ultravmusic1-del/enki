import Link from "next/link";
import { formatAge } from "@/lib/news/format-age";
import type { PublicStory } from "@/lib/news/stories";

export function CompactStoryList({
  stories,
  now,
  numbered = false,
}: {
  stories: PublicStory[];
  now: Date;
  numbered?: boolean;
}) {
  return (
    <ol className="flex flex-col divide-y divide-border">
      {stories.map((story, i) => (
        <li key={story.id} className="flex gap-3 py-3">
          {numbered ? (
            <span className="font-display text-lg leading-none text-teal tabular-nums">{i + 1}</span>
          ) : null}
          <Link href={`/news/${story.slug}`} className="group flex min-w-0 flex-col gap-1">
            <span className="leading-snug font-medium break-words text-pretty group-hover:text-teal">
              {story.headline}
            </span>
            <span className="font-mono text-xs break-words text-muted-foreground">
              {story.sourceName} · {formatAge(story.sourcePublishedAt ?? story.publishedAt, now)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
