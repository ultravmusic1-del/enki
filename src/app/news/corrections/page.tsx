import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { corrections, NEWS_DESK_EMAIL } from "@/data/newsroom";
import { formatExactTime } from "@/lib/news/format-age";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "News corrections",
  description:
    "Every correction Enki has made to a published story, with the date and what changed.",
  path: "/news/corrections",
});

export default function CorrectionsPage() {
  const all = [...corrections].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Container className="pt-28 pb-20">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 text-pretty text-muted-foreground">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-foreground">Corrections</h1>
        </header>
        <p>
          When a published story gets something wrong, Enki fixes it, says so at the foot of the story, moves
          its &ldquo;Updated&rdquo; time and lists the correction here. Stories are never quietly rewritten to
          hide a mistake.
        </p>
        {all.length > 0 ? (
          <ol className="flex flex-col divide-y divide-border border-y border-border">
            {all.map((c) => (
              <li key={`${c.slug}-${c.at}`} className="flex flex-col gap-1.5 py-4">
                <time dateTime={c.at} className="font-mono text-xs">
                  {formatExactTime(c.at)}
                </time>
                <p className="text-foreground">{c.note}</p>
                <Link href={`/news/${c.slug}`} className="text-sm text-teal hover:underline">
                  Read the corrected story
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm ring-hairline">
            No corrections so far. This page lists every one we make.
          </p>
        )}
        <p>
          Spotted a mistake? Email{" "}
          <a className="text-teal hover:underline" href={`mailto:${NEWS_DESK_EMAIL}`}>
            {NEWS_DESK_EMAIL}
          </a>{" "}
          with the story and what is wrong.
        </p>
        <p>
          <Link href="/news/about" className="text-teal hover:underline">
            How Enki covers news
          </Link>
        </p>
      </article>
    </Container>
  );
}
