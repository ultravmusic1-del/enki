import Link from "next/link";
import { formatAge } from "@/lib/news/format-age";
import type { PublicStory } from "@/lib/news/stories";

/**
 * Headline list for the archive, beat pages and "More in {Beat}". A server
 * component: the relative time is computed here, never on the client.
 */
export function StoryList({
  stories,
  now,
  showBeat = true,
}: {
  stories: PublicStory[];
  now: Date;
  showBeat?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {stories.map((story) => (
        <li key={story.id} className="py-5">
          <Link href={`/news/${story.slug}`} className="group flex flex-col gap-1.5">
            <span className="font-display text-lg leading-snug font-semibold break-words text-pretty group-hover:text-teal">
              {story.headline}
            </span>
            <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">
              {story.summary}
            </span>
            <span className="font-mono text-xs break-words text-muted-foreground">
              {story.sourceName} · {formatAge(story.sourcePublishedAt ?? story.publishedAt, now)}
              {showBeat ? ` · ${story.beatName}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
