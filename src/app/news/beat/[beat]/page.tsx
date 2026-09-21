import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArchive } from "@/components/news/news-archive";
import { beats, getBeat } from "@/data/beats";
import { listPublishedStories } from "@/lib/news/stories";

export const revalidate = 300;
export function generateStaticParams() {
  return beats.map((beat) => ({ beat: beat.slug }));
}

type Props = { params: Promise<{ beat: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const beat = getBeat((await params).beat);
  if (!beat) return { title: "Beat not found" };
  return {
    title: `${beat.name} news`,
    description: `The latest AI news on ${beat.name.toLowerCase()}, summarised.`,
    alternates: { canonical: `/news/beat/${beat.slug}` },
  };
}

export default async function BeatPage({ params }: Props) {
  const beat = getBeat((await params).beat);
  if (!beat) notFound();

  // Deliberately unpaginated: the latest 30 (plan deviation 2).
  const { stories } = await listPublishedStories({ beat: beat.slug });
  return (
    <NewsArchive
      title={`${beat.name} news`}
      description={`The latest AI news on ${beat.name.toLowerCase()}, summarised.`}
      stories={stories}
      emptyMessage={`No ${beat.name} stories yet.`}
      activeBeat={beat.slug}
    />
  );
}
