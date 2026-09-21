import Link from "next/link";
import { Container } from "@/components/shared/container";
import { StoryList } from "@/components/news/story-list";
import { NewsPagination } from "@/components/news/news-pagination";
import { beats, type BeatSlug } from "@/data/beats";
import type { PublicStory } from "@/lib/news/stories";
import { cn } from "@/lib/utils";

/** Shared layout for /news, its later pages, and the beat pages. */
export function NewsArchive({
  title,
  description,
  stories,
  emptyMessage,
  activeBeat,
  page = 1,
  pageCount = 1,
}: {
  title: string;
  description: string;
  stories: PublicStory[];
  emptyMessage: string;
  activeBeat?: BeatSlug;
  page?: number;
  pageCount?: number;
}) {
  const now = new Date();
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-balance">{title}</h1>
          <p className="text-pretty text-muted-foreground">{description}</p>
          <nav aria-label="Beats" className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/news"
              aria-current={activeBeat ? undefined : "page"}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                activeBeat
                  ? "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground"
                  : "border-teal/40 bg-teal/10 text-teal",
              )}
            >
              Latest
            </Link>
            {beats.map((beat) => (
              <Link
                key={beat.slug}
                href={`/news/beat/${beat.slug}`}
                aria-current={activeBeat === beat.slug ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  activeBeat === beat.slug
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
                )}
              >
                {beat.name}
              </Link>
            ))}
          </nav>
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
