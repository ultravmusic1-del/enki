import type { Metadata } from "next";
import { NewsArchive } from "@/components/news/news-archive";
import { listActiveBeats, searchStories, SEARCH_LIMIT } from "@/lib/news/stories";
import { normalizeQuery, searchTerms } from "@/lib/news/search";

// Results depend on the query string, so this page renders per request.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = normalizeQuery((await searchParams).q);
  return {
    title: q ? `Search: ${q}` : "Search the news",
    // Search results are thin, query-shaped pages; keep them out of the index.
    robots: { index: false, follow: true },
    alternates: { canonical: "/news/search" },
  };
}

export default async function NewsSearchPage({ searchParams }: Props) {
  const q = normalizeQuery((await searchParams).q);
  const searchable = searchTerms(q).length > 0;
  const [stories, activeBeats] = await Promise.all([
    searchable ? searchStories(q) : Promise.resolve([]),
    listActiveBeats(),
  ]);

  let description = "Search every story Enki has published, by company, product, person or topic.";
  if (searchable) {
    const count = stories.length >= SEARCH_LIMIT ? `The ${SEARCH_LIMIT} newest stories` : `${stories.length} ${stories.length === 1 ? "story" : "stories"}`;
    description = `${count} matching “${q}”, newest first.`;
  } else if (q) {
    description = "Use at least two letters or numbers.";
  }

  return (
    <NewsArchive
      title="Search the news"
      description={description}
      stories={stories}
      emptyMessage={searchable ? `No stories match “${q}” yet. Try a company or product name.` : "Type a company, product or topic above."}
      availableBeats={activeBeats}
      searchQuery={q}
    />
  );
}
