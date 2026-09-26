import Link from "next/link";
import type { PublicStory } from "@/lib/news/stories";
import { Icon } from "@/components/shared/icon";
import { formatAge } from "@/lib/news/format-age";
import { CompactStoryList } from "@/components/front-page/compact-story-list";
import { FounderTakeaway } from "@/components/news/founder-takeaway";

/** One beat under "Earlier this week": its newest story with the founder takeaway, then headlines. */
export function BeatSection({
  slug,
  name,
  stories,
  now,
}: {
  slug: string;
  name: string;
  stories: PublicStory[];
  now: Date;
}) {
  const [first, ...others] = stories;
  if (!first) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">
        <Link href={`/news/beat/${slug}`} className="inline-flex items-center gap-1 hover:text-teal">
          {name}
          <Icon name="ChevronRight" className="size-4" />
        </Link>
      </h3>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <Link
          href={`/news/${first.slug}`}
          className="leading-snug font-semibold break-words text-pretty hover:text-teal"
        >
          {first.headline}
        </Link>
        <p className="font-mono text-xs break-words text-muted-foreground">
          {first.sourceName} · {formatAge(first.publishedAt, now)}
        </p>
        <FounderTakeaway text={first.takeaway} />
      </div>
      {others.length > 0 ? <CompactStoryList stories={others} now={now} /> : null}
    </section>
  );
}
