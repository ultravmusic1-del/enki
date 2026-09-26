import { Container } from "@/components/shared/container";
import { StoryList } from "@/components/news/story-list";
import { NewsPagination } from "@/components/news/news-pagination";
import { BeatRow } from "@/components/news/beat-row";
import { NewsSearchForm } from "@/components/news/news-search-form";
import type { BeatSlug } from "@/data/beats";
import type { PublicStory } from "@/lib/news/stories";

/** Shared layout for /news, its later pages, and the beat pages. */
export function NewsArchive({
  title,
  description,
  stories,
  emptyMessage,
  activeBeat,
  page = 1,
  pageCount = 1,
  availableBeats,
  searchQuery,
}: {
  title: string;
  description: string;
  stories: PublicStory[];
  emptyMessage: string;
  activeBeat?: BeatSlug;
  page?: number;
  pageCount?: number;
  /** Beats with published stories, for the beat row (null or omitted: all). */
  availableBeats?: readonly BeatSlug[] | null;
  /** Set on the search page, to prefill the search box. */
  searchQuery?: string;
}) {
  const now = new Date();
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-balance">{title}</h1>
          <p className="text-pretty text-muted-foreground">{description}</p>
          <BeatRow className="pt-2" available={availableBeats} />
          <NewsSearchForm defaultValue={searchQuery} className="max-w-md" />
        </header>

        {stories.length > 0 ? (
          <StoryList stories={stories} now={now} showBeat={!activeBeat} />
        ) : (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
            {emptyMessage}
          </p>
        )}

        <NewsPagination page={page} pageCount={pageCount} />
      </div>
    </Container>
  );
}
