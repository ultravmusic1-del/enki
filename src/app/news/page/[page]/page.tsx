import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArchive } from "@/components/news/news-archive";
import { listPublishedStories } from "@/lib/news/stories";
import { pageCount, parsePageParam } from "@/lib/news/story-meta";

export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parsePageParam((await params).page);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  return {
    title: `AI news, page ${page}`,
    alternates: { canonical: `/news/page/${page}` },
    // Crawlable for discovery, but /news is the page that should rank.
    robots: { index: false, follow: true },
  };
}

export default async function NewsArchivePage({ params }: Props) {
  const page = parsePageParam((await params).page);
  if (!page) notFound();

  const { stories, total } = await listPublishedStories({ page });
  const pages = pageCount(total);
  if (page > pages || stories.length === 0) notFound();

  return (
    <NewsArchive
      title="AI news"
      description={`Page ${page} of the archive.`}
      stories={stories}
      emptyMessage=""
      page={page}
      pageCount={pages}
    />
  );
}
