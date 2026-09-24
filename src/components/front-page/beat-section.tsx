import Link from "next/link";
import type { PublicStory } from "@/lib/news/stories";
import { Icon } from "@/components/shared/icon";
import { StoryImage } from "@/components/front-page/story-image";
import { CompactStoryList } from "@/components/front-page/compact-story-list";

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
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold">
        <Link href={`/news/beat/${slug}`} className="inline-flex items-center gap-1 hover:text-teal">
          {name}
          <Icon name="ChevronRight" className="size-4" />
        </Link>
      </h2>
      {/* Always a 16:9 frame, so the beat columns line up whether or not a story has an image. */}
      <StoryImage src={first.imageUrl} className="w-full" />
      <Link
        href={`/news/${first.slug}`}
        className="font-display text-lg leading-snug font-semibold break-words text-pretty hover:text-teal"
      >
        {first.headline}
      </Link>
      {others.length > 0 ? <CompactStoryList stories={others} now={now} /> : null}
    </section>
  );
}
