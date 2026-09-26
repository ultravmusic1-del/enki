import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { NEWS_DESK_EMAIL, NEWS_EDITOR } from "@/data/newsroom";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "How Enki covers news",
  description:
    "Where Enki's AI news comes from, how stories are written and edited, how corrections work, and how tool links work.",
  path: "/news/about",
});

export default function NewsAboutPage() {
  return (
    <Container className="pt-28 pb-20">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 text-pretty text-muted-foreground">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-foreground">How Enki covers news</h1>
        </header>
        <p>
          Enki follows a set of AI news sources every day and picks the stories worth a founder&apos;s time.
          Each story is written by Enki from the reporting of the outlets it lists as sources, and every one of
          them is linked. Their original reporting belongs to them. Where a company, lab, regulator or paper
          published the underlying material, the story lists it first as a primary source.
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">What a story looks like</h2>
        <p>
          Every story opens with &ldquo;What it means for founders&rdquo;, Enki&apos;s own analysis of what the
          news changes for people building companies. The story itself follows, kept short: what happened, what
          is still uncertain, and what to watch next. We spend few words recapping other outlets. Where outlets
          disagree on a detail, we leave it out rather than guess, and company claims are attributed, never
          stated as fact.
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">Who is responsible</h2>
        <p>
          {NEWS_EDITOR
            ? `Every story is edited by ${NEWS_EDITOR.name}, ${NEWS_EDITOR.role}, before it is published.`
            : "Every story is checked against its sources by the Enki news desk before it is published."}{" "}
          Each story shows the exact time it was published and, if it has been corrected, when it was last
          updated. Times are in UTC.
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">Corrections</h2>
        <p>
          When we get something wrong, we fix it and say so at the foot of the story. Every correction is listed
          on the{" "}
          <Link href="/news/corrections" className="text-teal hover:underline">
            corrections page
          </Link>
          . Spotted a mistake? Email{" "}
          <a className="text-teal hover:underline" href={`mailto:${NEWS_EDITOR?.email ?? NEWS_DESK_EMAIL}`}>
            {NEWS_EDITOR?.email ?? NEWS_DESK_EMAIL}
          </a>
          .
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">Tool links</h2>
        <p>
          Some stories list the AI tools they mention. Those links may earn Enki a commission if you sign up,
          and that never influences which stories we run or how we write them. More in our{" "}
          <Link href="/privacy#affiliate" className="text-teal hover:underline">
            affiliate policy
          </Link>
          .
        </p>
        <p>
          <Link href="/news" className="text-teal hover:underline">
            Back to the news
          </Link>
        </p>
      </article>
    </Container>
  );
}
