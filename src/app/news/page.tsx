import type { Metadata } from "next";
import { NewsArchive } from "@/components/news/news-archive";
import { listPublishedStories } from "@/lib/news/stories";
import { pageCount } from "@/lib/news/story-meta";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI news",
  description: "The day's AI news, summarised, with the tools each story mentions.",
  alternates: { canonical: "/news" },
};

export default async function NewsPage() {
  const { stories, total } = await listPublishedStories({ page: 1 });
  return (
    <NewsArchive
      title="AI news"
      description="The day's AI news, summarised, with the tools each story mentions."
      stories={stories}
      emptyMessage="The first stories are coming soon."
      page={1}
      pageCount={pageCount(total)}
    />
  );
}
