import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "How Enki covers news",
  description:
    "Where Enki's AI news comes from, how stories are written from their sources, and how tool links work.",
  alternates: { canonical: "/news/about" },
};

export default function NewsAboutPage() {
  return (
    <Container className="pt-28 pb-20">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 text-pretty text-muted-foreground">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-foreground">How Enki covers news</h1>
        </header>
        <p>
          Enki follows a set of AI news sources every day and picks the stories worth your time.
          Each story is written by Enki from the reporting of the outlets it lists as sources, and
          every one of them is linked. Their original reporting belongs to them.
        </p>
        <p>
          The section headed &ldquo;What it means for founders&rdquo; is Enki&apos;s own analysis:
          what the news changes for people building companies. Where outlets disagree on a detail,
          we leave it out rather than guess.
        </p>
        <p>
          Some stories list the AI tools they mention. Those links may earn Enki a commission if
          you sign up, and that never influences which stories we run or how we summarise them.
          More in our{" "}
          <Link href="/privacy#affiliate" className="text-teal hover:underline">
            affiliate policy
          </Link>
          .
        </p>
        <p>
          Spotted a mistake? Email{" "}
          <a className="text-teal hover:underline" href="mailto:enkidirectory@gmail.com">
            enkidirectory@gmail.com
          </a>{" "}
          and we will fix it.
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
